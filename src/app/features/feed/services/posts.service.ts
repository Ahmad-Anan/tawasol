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
  FeedOnlyFilter,
  LikeToggleApiResponse,
  MutatedPost,
  Post,
  SharePostApiResponse,
  SinglePostApiResponse,
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
  // `PostsService` is also injected by ProfileService now (see mergePosts) purely to reuse
  // this as a shared post store — a profile page has no interest in the feed itself. Gating
  // `feedResource` behind this (a `resource`'s `params` returning `undefined` skips the loader
  // entirely, per Angular's resource docs) means merely constructing PostsService no longer
  // fires an unwanted `GET /posts/feed`. Without this, that stray request used to resolve
  // *after* ProfileService.mergePosts() and wipe `_posts` back down to just the feed's own
  // page — the feed's own effect below replaces `_posts` outright on a cursor-less load, with
  // no idea a profile page had merged anything into it.
  private readonly _feedRequested = signal(false);
  // `only` defaults to `following` server-side (which, per docs/api-reference.md > GET
  // /posts/feed, already includes the signed-in user's own posts but no one else's) — an
  // account that isn't following anyone would otherwise only ever see their own posts, so the
  // client always sends an explicit value rather than relying on that default. 'all' matches
  // the feed's original pre-filter-UI behaviour, so it stays the starting value here.
  private readonly _onlyFilter = signal<FeedOnlyFilter>('all');
  // `null` = no hasImage filter applied (send nothing). `true`/`false` are real, server-verified
  // filter values — see docs/api-reference.md > GET /posts/feed.
  private readonly _hasImageFilter = signal<boolean | null>(null);

  // State for PostDetailPage's single-post permalink view. Separate from `_posts`/`hasMore`
  // above (the feed's own accumulated list) — a permalink load neither replaces nor appends to
  // that list, it just upserts the one post into the shared store via `mergePosts` below, same
  // as ProfileService/BookmarksService already do.
  private readonly _singlePostLoading = signal(false);
  private readonly _singlePostError = signal(false);

  readonly posts = this._posts.asReadonly();
  readonly hasMore = this._hasMore.asReadonly();
  readonly onlyFilter = this._onlyFilter.asReadonly();
  readonly hasImageFilter = this._hasImageFilter.asReadonly();
  readonly singlePostLoading = this._singlePostLoading.asReadonly();
  readonly singlePostError = this._singlePostError.asReadonly();

  /**
   * Which empty-state message fits the current filter combination — a "no posts at all" empty
   * feed reads very differently from "you're not following anyone yet" or "no posts of yours
   * have an image". Kept as one computed here (not scattered `@if`s in the template) since it's
   * purely a function of the two filter signals.
   */
  readonly emptyStateKey = computed(() => {
    if (this._hasImageFilter() !== null) {
      return 'feed.emptyFiltered';
    }
    switch (this._onlyFilter()) {
      case 'following':
        return 'feed.emptyFollowing';
      case 'me':
        return 'feed.emptyMe';
      default:
        return 'feed.empty';
    }
  });

  /**
   * Cursor-based (not page-based) infinite scroll: `_cursor` is set to the id of the last
   * loaded post to fetch the next page. A fixed page number would skip or duplicate posts if
   * new ones are created while the user is scrolling — see docs/api-reference.md > GET
   * /posts/feed for why cursor mode was chosen over page mode here.
   *
   * `only`/`hasImage` are read here too, not in a second resource — changing either flows
   * through this exact same `params`/`stream` pair `_cursor` already uses, so there's no second
   * reactive source that could race with this one (see the commit that fixed the feed/profile
   * race condition: a second resource for "the same underlying request, triggered a different
   * way" is exactly the shape that bug had).
   */
  private readonly feedResource = rxResource({
    params: () =>
      this._feedRequested()
        ? { cursor: this._cursor(), only: this._onlyFilter(), hasImage: this._hasImageFilter() }
        : undefined,
    stream: ({ params }) => {
      let httpParams = new HttpParams().set('limit', FEED_PAGE_SIZE).set('only', params.only);
      if (params.hasImage !== null) {
        httpParams = httpParams.set('hasImage', String(params.hasImage));
      }
      if (params.cursor) {
        httpParams = httpParams.set('cursor', params.cursor);
      }
      return this.http.get<FeedApiResponse>(`${API_BASE_URL}/posts/feed`, { params: httpParams });
    },
  });

  readonly isLoading = computed(() => this.feedResource.isLoading() && this._posts().length === 0);
  readonly isLoadingMore = computed(() => this.feedResource.isLoading() && this._posts().length > 0);
  readonly loadError = computed(() => (this._posts().length === 0 ? this.feedResource.error() : undefined));
  /** Distinct from `loadError`: a failure fetching a *later* page, with earlier posts already on screen. */
  readonly loadMoreError = computed(() => (this._posts().length > 0 ? this.feedResource.error() : undefined));

  constructor() {
    // Appends a page onto the accumulated list instead of the resource's default "replace
    // the whole value" behaviour. `_cursor` only ever changes from `loadMore()`, so this
    // never fires for a reason other than "a new page of posts arrived".
    effect(() => {
      // hasValue(), not value(): value() throws while the resource is in its error state (a
      // failed request), which surfaced as an uncaught error on every failed load.
      if (!this.feedResource.hasValue()) {
        return;
      }
      const response = this.feedResource.value();
      this._posts.update((existing) =>
        this._cursor() ? [...existing, ...response.data.posts] : response.data.posts,
      );
      // The very first request (no `cursor` sent yet) always comes back in page mode, not
      // cursor mode — the API switches shape purely on whether `cursor` was present in the
      // query string (see docs/api-reference.md > GET /posts/feed). Page mode signals "another
      // page exists" via the *presence* of `pagination.nextPage` as a key (its absence, not a
      // `null` value, means no more pages) — mirror that here instead of assuming page mode
      // always means "done", which used to kill infinite scroll after the first page.
      this._hasMore.set(
        response.meta.feedMode === 'cursor'
          ? response.meta.cursor.hasMore
          : response.meta.pagination.nextPage !== undefined,
      );
    });
  }

  /** Called once by FeedPage on mount — see `_feedRequested`. A no-op on every call after the first. */
  start(): void {
    this._feedRequested.set(true);
  }

  /**
   * `GET /posts/:id` — called explicitly by PostDetailPage on mount, never merely by injection
   * (same race-condition lesson as everywhere else in this service). Upserts into the shared
   * `_posts` store via `mergePosts` so the returned post renders through the same `PostCard`
   * (and keeps working for like/bookmark/share/edit/delete) as every other list in the app.
   */
  async loadPost(postId: string): Promise<void> {
    this._singlePostLoading.set(true);
    this._singlePostError.set(false);
    try {
      const response = await firstValueFrom(this.http.get<SinglePostApiResponse>(`${API_BASE_URL}/posts/${postId}`));
      this.mergePosts([response.data.post]);
    } catch {
      this._singlePostError.set(true);
    } finally {
      this._singlePostLoading.set(false);
    }
  }

  setOnlyFilter(value: FeedOnlyFilter): void {
    if (value === this._onlyFilter()) {
      return;
    }
    this._onlyFilter.set(value);
    this.resetPagination();
  }

  setHasImageFilter(value: boolean | null): void {
    if (value === this._hasImageFilter()) {
      return;
    }
    this._hasImageFilter.set(value);
    this.resetPagination();
  }

  /**
   * A changed filter means the accumulated `_posts` list no longer reflects "everything up to
   * `_cursor`" — it reflects the *previous* filter's posts. Clearing `_posts` immediately (not
   * waiting for the new response) avoids a flash of stale, wrong-filter posts while the new
   * request is in flight; resetting `_cursor` stops the next response being interpreted as "a
   * later page of the old filter" (see the constructor effect's cursor-truthy append check).
   */
  private resetPagination(): void {
    this._posts.set([]);
    this._cursor.set(undefined);
    this._hasMore.set(true);
  }

  /** Retries a failed first page (`loadError`) — the params didn't change, so reload in place. */
  retryLoad(): void {
    if (!this.feedResource.isLoading()) {
      this.feedResource.reload();
    }
  }

  loadMore(): void {
    if (!this._hasMore() || this.feedResource.isLoading()) {
      return;
    }
    // A failed loadMore() leaves `_cursor` already set to this same last-post id, so setting
    // it again wouldn't change the signal's value and the resource wouldn't refetch — retry
    // that case by reloading instead of re-deriving the cursor.
    if (this.loadMoreError()) {
      this.feedResource.reload();
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

  /**
   * Upserts posts fetched from somewhere other than the feed itself (currently: a profile
   * page's `GET /users/:id/posts`) into this same store. `PostCard` always mutates through
   * `PostsService` regardless of which list rendered it, so any list that wants like/bookmark/
   * share/edit/delete to actually show up needs its posts to live here, not in a separate
   * per-feature copy. Existing entries are left as-is on a merge — whichever copy is already
   * here is the freshest, since every mutation method above already patches it in place.
   */
  mergePosts(posts: Post[]): void {
    this._posts.update((existing) => {
      const knownIds = new Set(existing.map((post) => post.id));
      const additions = posts.filter((post) => !knownIds.has(post.id));
      return additions.length > 0 ? [...existing, ...additions] : existing;
    });
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
