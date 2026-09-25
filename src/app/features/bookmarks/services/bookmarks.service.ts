import { HttpClient, HttpParams } from '@angular/common/http';
import { Service, computed, effect, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { API_BASE_URL } from '../../../core/constants/api';
import type { Post } from '../../feed/feed.interface';
import { PostsService } from '../../feed/services/posts.service';
import type { BookmarksApiResponse } from '../bookmarks.interface';

const BOOKMARKS_PAGE_SIZE = 10;

/**
 * Signal-based state for the bookmarks list, following the same shape as PostsService/
 * ProfileService. Posts read from PostsService's shared store (see PostsService.mergePosts)
 * so PostCard's like/bookmark/share/edit/delete keep working unmodified here — and, uniquely
 * for this list, so an unbookmark is reflected as the post *disappearing*: `posts` filters on
 * `bookmarked === true`, which PostsService.toggleBookmark already flips in the shared store,
 * so no extra wiring is needed for a post to drop off this list the moment it's unbookmarked.
 *
 * IMPORTANT (see docs/api-reference.md and the commit that fixed the feed/profile race):
 * `bookmarksResource` must NOT start fetching merely because this service gets constructed —
 * ProfileService already showed that pattern silently races and stomps on another feature's
 * merged posts. `params` returns `undefined` (skipping the loader entirely, per Angular's
 * resource docs) until `start()` is called explicitly by BookmarksPage.
 */
@Service()
export class BookmarksService {
  private readonly http = inject(HttpClient);
  private readonly postsService = inject(PostsService);

  private readonly _requested = signal(false);
  private readonly _page = signal(1);
  private readonly _postIds = signal<string[]>([]);
  private readonly _hasMore = signal(true);

  private readonly bookmarksResource = rxResource({
    params: () => (this._requested() ? { page: this._page() } : undefined),
    stream: ({ params }) => {
      const httpParams = new HttpParams().set('page', params.page).set('limit', BOOKMARKS_PAGE_SIZE);
      return this.http.get<BookmarksApiResponse>(`${API_BASE_URL}/users/bookmarks`, { params: httpParams });
    },
  });

  readonly isLoading = computed(() => this.bookmarksResource.isLoading() && this._postIds().length === 0);
  readonly isLoadingMore = computed(() => this.bookmarksResource.isLoading() && this._postIds().length > 0);
  readonly loadError = computed(() => (this._postIds().length === 0 ? this.bookmarksResource.error() : undefined));
  readonly loadMoreError = computed(() => (this._postIds().length > 0 ? this.bookmarksResource.error() : undefined));
  readonly hasMore = this._hasMore.asReadonly();

  /**
   * Filters on `bookmarked === true` (not just "known to PostsService") so an unbookmark —
   * anywhere in the app, not just from this page — makes the post disappear from here
   * reactively, without this service needing to know a toggle happened.
   */
  readonly posts = computed(() => {
    const byId = new Map(this.postsService.posts().map((post) => [post.id, post]));
    return this._postIds()
      .map((id) => byId.get(id))
      .filter((post): post is Post => post !== undefined && post.bookmarked === true);
  });

  constructor() {
    effect(() => {
      // hasValue(), not value(): value() throws in the resource's error state — see PostsService.
      if (!this.bookmarksResource.hasValue()) {
        return;
      }
      const response = this.bookmarksResource.value();
      this.postsService.mergePosts(response.data.bookmarks);
      const ids = response.data.bookmarks.map((post) => post.id);
      this._postIds.update((existing) => (this._page() > 1 ? [...existing, ...ids] : ids));
      this._hasMore.set(response.meta.pagination.nextPage !== undefined);
    });
  }

  /** Called once by BookmarksPage on mount — see the class doc comment. A no-op after the first call. */
  start(): void {
    this._requested.set(true);
  }

  loadMore(): void {
    if (!this._hasMore() || this.bookmarksResource.isLoading()) {
      return;
    }
    if (this.loadMoreError()) {
      this.bookmarksResource.reload();
      return;
    }
    this._page.update((page) => page + 1);
  }
}
