import { HttpClient, HttpParams } from '@angular/common/http';
import { Service, computed, effect, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../../../core/constants/api';
import { AuthService } from '../../../core/services/auth.service';
import type {
  BookmarkToggleApiResponse,
  CreateOrEditPostApiResponse,
  FeedApiResponse,
  LikeToggleApiResponse,
  MutatedPost,
  Post,
  SharePostApiResponse,
} from '../feed.interface';

const FEED_PAGE_SIZE = 10;

export interface PostFormPayload {
  body?: string;
  image?: File | null;
}

/**
 * Signal-based state for the feed, following the same shape as AuthService/ThemeService:
 * private writable signals internally, readonly signals exposed, `@Service()` singleton.
 */
@Service()
export class PostsService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);

  private readonly _cursor = signal<string | undefined>(undefined);
  private readonly _posts = signal<Post[]>([]);
  private readonly _hasMore = signal(true);

  readonly posts = this._posts.asReadonly();
  readonly hasMore = this._hasMore.asReadonly();

  /**
   * Cursor-based (not page-based) infinite scroll: `_cursor` is set to the id of the last
   * loaded post to fetch the next page. A fixed page number would skip or duplicate posts if
   * new ones are created while the user is scrolling — see docs/api-reference.md > GET
   * /posts/feed for why cursor mode was chosen over page mode here.
   */
  private readonly feedResource = rxResource({
    params: () => ({ cursor: this._cursor() }),
    stream: ({ params }) => {
      let httpParams = new HttpParams().set('limit', FEED_PAGE_SIZE);
      if (params.cursor) {
        httpParams = httpParams.set('cursor', params.cursor);
      }
      return this.http.get<FeedApiResponse>(`${API_BASE_URL}/posts/feed`, { params: httpParams });
    },
  });

  readonly isLoading = computed(() => this.feedResource.isLoading() && this._posts().length === 0);
  readonly isLoadingMore = computed(() => this.feedResource.isLoading() && this._posts().length > 0);
  readonly loadError = computed(() => (this._posts().length === 0 ? this.feedResource.error() : undefined));

  constructor() {
    // Appends a page onto the accumulated list instead of the resource's default "replace
    // the whole value" behaviour. `_cursor` only ever changes from `loadMore()`, so this
    // never fires for a reason other than "a new page of posts arrived".
    effect(() => {
      const response = this.feedResource.value();
      if (!response) {
        return;
      }
      this._posts.update((existing) =>
        this._cursor() ? [...existing, ...response.data.posts] : response.data.posts,
      );
      this._hasMore.set(response.meta.feedMode === 'cursor' ? response.meta.cursor.hasMore : false);
    });
  }

  loadMore(): void {
    if (!this._hasMore() || this.feedResource.isLoading()) {
      return;
    }
    const lastPost = this._posts().at(-1);
    if (lastPost) {
      this._cursor.set(lastPost.id);
    }
  }

  async createPost(payload: PostFormPayload): Promise<void> {
    const response = await firstValueFrom(
      this.http.post<CreateOrEditPostApiResponse>(`${API_BASE_URL}/posts`, this.buildFormData(payload)),
    );
    this._posts.update((existing) => [this.toDisplayPost(response.data.post), ...existing]);
  }

  /** Not wired to any UI yet in this pass — see the feed feature summary for why. */
  async editPost(postId: string, payload: PostFormPayload): Promise<void> {
    const response = await firstValueFrom(
      this.http.put<CreateOrEditPostApiResponse>(`${API_BASE_URL}/posts/${postId}`, this.buildFormData(payload)),
    );
    const edited = response.data.post;
    this.patchPost(postId, { body: edited.body, image: edited.image });
  }

  /** Not wired to any UI yet in this pass — see the feed feature summary for why. */
  async deletePost(postId: string): Promise<void> {
    await firstValueFrom(this.http.delete(`${API_BASE_URL}/posts/${postId}`));
    this._posts.update((existing) => existing.filter((post) => post.id !== postId));
  }

  async toggleLike(postId: string): Promise<void> {
    const response = await firstValueFrom(
      this.http.put<LikeToggleApiResponse>(`${API_BASE_URL}/posts/${postId}/like`, {}),
    );
    // Only `liked`/`likesCount` are trustworthy here — the nested `post` is missing
    // commentsCount/topComment/bookmarked and its `user` carries extra profile stats that
    // don't belong on the locally-held post. See docs/api-reference.md > PUT
    // /posts/:id/like.
    this.patchPost(postId, { likes: response.data.post.likes, likesCount: response.data.likesCount });
  }

  async toggleBookmark(postId: string): Promise<void> {
    const response = await firstValueFrom(
      this.http.put<BookmarkToggleApiResponse>(`${API_BASE_URL}/posts/${postId}/bookmark`, {}),
    );
    // `bookmarksCount` in this response is the signed-in user's total bookmark count across
    // the app, not a per-post stat — only `bookmarked` describes this post. See
    // docs/api-reference.md > PUT /posts/:id/bookmark.
    this.patchPost(postId, { bookmarked: response.data.bookmarked });
  }

  async sharePost(postId: string): Promise<void> {
    const response = await firstValueFrom(
      this.http.post<SharePostApiResponse>(`${API_BASE_URL}/posts/${postId}/share`, {}),
    );
    const original = this._posts().find((post) => post.id === postId);
    this._posts.update((existing) => [response.data.post, ...existing]);
    if (original) {
      // The API doesn't return the original post's updated sharesCount, only the brand-new
      // share-post's (which is 0) — bump it locally since we know a share of it just
      // succeeded.
      this.patchPost(postId, { sharesCount: original.sharesCount + 1 });
    }
  }

  isLikedBy(post: Post, userId: string | undefined): boolean {
    return !!userId && post.likes.includes(userId);
  }

  private patchPost(postId: string, patch: Partial<Post>): void {
    this._posts.update((existing) => existing.map((post) => (post.id === postId ? { ...post, ...patch } : post)));
  }

  private buildFormData(payload: PostFormPayload): FormData {
    const formData = new FormData();
    if (payload.body) {
      formData.set('body', payload.body);
    }
    if (payload.image) {
      formData.set('image', payload.image);
    }
    return formData;
  }

  /**
   * POST/PUT /posts return the "slim" shape (see docs/api-reference.md) — `user` is a bare id
   * string and several list-only fields don't exist at all. Fill in what we already know
   * (the signed-in user, whose shape matches `PostAuthor`) and default the rest, so the new
   * post can render as a normal feed card immediately instead of waiting on a full reload.
   */
  private toDisplayPost(mutated: MutatedPost): Post {
    const me = this.authService.user();
    return {
      ...mutated,
      user: me
        ? { _id: me._id, name: me.name, username: me.username, photo: me.photo }
        : { _id: mutated.user, name: '', username: '', photo: '' },
      commentsCount: 0,
      topComment: null,
      sharesCount: 0,
      bookmarked: false,
    };
  }
}
