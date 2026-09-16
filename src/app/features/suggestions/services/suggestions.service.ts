import { HttpClient, HttpParams } from '@angular/common/http';
import { Service, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { API_BASE_URL } from '../../../core/constants/api';
import { ProfileService } from '../../profile/services/profile.service';
import type { SuggestionsApiResponse } from '../suggestions.interface';

const SUGGESTIONS_LIMIT = 5;

/**
 * Signal-based state for the "suggested friends" widget, following the same shape as
 * BookmarksService: private writable signals internally, readonly signals exposed, `@Service()`
 * singleton. Only ever shows one page — this is a small sidebar widget, not a paginated list —
 * so there's no `loadMore()`/cursor here.
 *
 * IMPORTANT (the recurring race-condition lesson in this codebase — see PostsService/
 * BookmarksService's own doc comments): `suggestionsResource` must NOT start fetching merely
 * because this service gets constructed. `params` returns `undefined` until `start()` is
 * called explicitly by the widget component.
 */
@Service()
export class SuggestionsService {
  private readonly http = inject(HttpClient);
  private readonly profileService = inject(ProfileService);

  private readonly _requested = signal(false);
  /** Ids the widget has already followed this session — filtered out of `suggestions` immediately, no need to wait for a refetch. */
  private readonly _followedIds = signal<ReadonlySet<string>>(new Set());
  private readonly _followingIds = signal<ReadonlySet<string>>(new Set());
  private readonly _followErrorIds = signal<ReadonlySet<string>>(new Set());

  private readonly suggestionsResource = rxResource({
    params: () => (this._requested() ? {} : undefined),
    stream: () => {
      const params = new HttpParams().set('limit', SUGGESTIONS_LIMIT);
      return this.http.get<SuggestionsApiResponse>(`${API_BASE_URL}/users/suggestions`, { params });
    },
  });

  readonly isLoading = computed(() => this.suggestionsResource.isLoading());
  readonly loadError = computed(() => this.suggestionsResource.error());
  readonly suggestions = computed(() => {
    const followed = this._followedIds();
    return (this.suggestionsResource.value()?.data.suggestions ?? []).filter((user) => !followed.has(user._id));
  });

  /** Called once by the widget on mount. A no-op on every call after the first. */
  start(): void {
    this._requested.set(true);
  }

  isFollowing(userId: string): boolean {
    return this._followingIds().has(userId);
  }

  hasFollowError(userId: string): boolean {
    return this._followErrorIds().has(userId);
  }

  async follow(userId: string): Promise<void> {
    if (this._followingIds().has(userId)) {
      return;
    }
    this._followingIds.update((ids) => new Set(ids).add(userId));
    this._followErrorIds.update((ids) => without(ids, userId));
    try {
      await this.profileService.followUserId(userId);
      this._followedIds.update((ids) => new Set(ids).add(userId));
    } catch {
      this._followErrorIds.update((ids) => new Set(ids).add(userId));
    } finally {
      this._followingIds.update((ids) => without(ids, userId));
    }
  }
}

function without<T>(set: ReadonlySet<T>, value: T): ReadonlySet<T> {
  if (!set.has(value)) {
    return set;
  }
  const next = new Set(set);
  next.delete(value);
  return next;
}
