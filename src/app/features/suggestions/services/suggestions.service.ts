import { HttpClient, HttpParams } from '@angular/common/http';
import { Service, computed, effect, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { API_BASE_URL } from '../../../core/constants/api';
import type { SuggestedUser, SuggestionsApiResponse } from '../suggestions.interface';

const SUGGESTIONS_PAGE_SIZE = 10;

/**
 * Signal-based state for the "suggested friends" widget, following the same page-based
 * pagination shape as BookmarksService (`_page` signal, accumulate onto `_suggestions`,
 * `hasMore` from `pagination.nextPage`'s presence) — verified live (see
 * docs/api-reference.md > GET /users/suggestions) that this endpoint's pagination is real
 * (distinct, non-overlapping pages over a large pool), not just a fixed-size cap, so real
 * infinite scroll is safe to build against it.
 *
 * IMPORTANT (the recurring race-condition lesson in this codebase — see PostsService/
 * BookmarksService's own doc comments): `suggestionsResource` must NOT start fetching merely
 * because this service gets constructed. `params` returns `undefined` until `start()` is
 * called explicitly by the widget component.
 */
@Service()
export class SuggestionsService {
  private readonly http = inject(HttpClient);

  private readonly _requested = signal(false);
  private readonly _page = signal(1);
  private readonly _suggestions = signal<SuggestedUser[]>([]);
  private readonly _hasMore = signal(true);

  private readonly suggestionsResource = rxResource({
    params: () => (this._requested() ? { page: this._page() } : undefined),
    stream: ({ params }) => {
      const httpParams = new HttpParams()
        .set('page', params.page)
        .set('limit', SUGGESTIONS_PAGE_SIZE);
      return this.http.get<SuggestionsApiResponse>(`${API_BASE_URL}/users/suggestions`, {
        params: httpParams,
      });
    },
  });

  readonly isLoading = computed(
    () => this.suggestionsResource.isLoading() && this._suggestions().length === 0,
  );
  readonly isLoadingMore = computed(
    () => this.suggestionsResource.isLoading() && this._suggestions().length > 0,
  );
  readonly loadError = computed(() =>
    this._suggestions().length === 0 ? this.suggestionsResource.error() : undefined,
  );
  readonly loadMoreError = computed(() =>
    this._suggestions().length > 0 ? this.suggestionsResource.error() : undefined,
  );
  readonly hasMore = this._hasMore.asReadonly();

  /**
   * Everyone suggested so far. Someone followed from here deliberately *stays* in the list, showing
   * "Following" (see FollowButton/FollowService), so the follow can be undone right away; the
   * next refresh drops them, since the API already excludes people you follow (see start()).
   */
  readonly suggestions = this._suggestions.asReadonly();

  constructor() {
    // Appends a page onto the accumulated list instead of the resource's default "replace the
    // whole value" behaviour — same pattern as PostsService/BookmarksService.
    effect(() => {
      // hasValue(), not value(): value() throws in the resource's error state — see PostsService.
      if (!this.suggestionsResource.hasValue()) {
        return;
      }
      const response = this.suggestionsResource.value();
      this._suggestions.update((existing) =>
        this._page() > 1 ? [...existing, ...response.data.suggestions] : response.data.suggestions,
      );
      this._hasMore.set(response.meta.pagination.nextPage !== undefined);
    });
  }

  /**
   * Called by the widget on every mount, not just the first — unlike PostsService/
   * BookmarksService's `start()`, this one deliberately refetches from page 1 each time
   * (verified live: `GET /users/suggestions` already excludes anyone already followed, so a
   * fresh fetch is enough to reflect it). This is the "next refresh" that drops people you
   * followed: while the widget stays mounted they remain listed as "Following" so the follow
   * can be undone (follow state itself is shared app-wide through FollowService, so a follow
   * made on a profile page already shows here as "Following" too).
   */
  start(): void {
    if (!this._requested()) {
      this._requested.set(true);
      return;
    }
    this._suggestions.set([]);
    this._hasMore.set(true);
    this._page.set(1);
    this.suggestionsResource.reload();
  }

  loadMore(): void {
    if (!this._hasMore() || this.suggestionsResource.isLoading()) {
      return;
    }
    if (this.loadMoreError()) {
      this.suggestionsResource.reload();
      return;
    }
    this._page.update((page) => page + 1);
  }
}
