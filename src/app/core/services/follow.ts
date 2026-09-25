import { HttpClient } from '@angular/common/http';
import { Service, inject, signal } from '@angular/core';
import { Subject, firstValueFrom } from 'rxjs';
import type { FollowToggleApiResponse } from '../../features/profile/profile.interface';
import { API_BASE_URL } from '../constants/api';

/**
 * A change to a follower count caused by a follow/unfollow, broadcast so every place showing
 * counts can stay in sync (see ProfileService). `followersDelta` is the change to the target's
 * followers — and, equally, to the signed-in user's following count. `followersCount` is the
 * target's new total when the server has reported it.
 */
export interface FollowCountChange {
  userId: string;
  followersDelta: number;
  followersCount?: number;
}

export type FollowFailure = 'follow' | 'unfollow';

/**
 * The single source of truth for "does the signed-in user follow X?" across the app — the
 * profile header and the suggested-friends widget both read and write through here, so a
 * follow in one place shows everywhere at once.
 *
 * Updates are optimistic: the new state (and counts) apply immediately, the request runs, and
 * the state is then reconciled with the server's answer or rolled back if the request fails.
 * Only one request per user can be in flight — see `isPending` — which is what stops a double
 * click from firing `PUT /users/:id/follow` twice.
 *
 * That endpoint is a *toggle* (see docs/api-reference.md), not "set": it returns whether the
 * user is followed afterwards. If our local belief was stale, the server's answer wins.
 */
@Service()
export class FollowService {
  private readonly http = inject(HttpClient);

  private readonly states = signal<ReadonlyMap<string, boolean>>(new Map());
  private readonly pending = signal<ReadonlySet<string>>(new Set());
  private readonly failures = signal<ReadonlyMap<string, FollowFailure>>(new Map());
  private readonly countChanges = new Subject<FollowCountChange>();

  readonly countChanges$ = this.countChanges.asObservable();

  /** Whether the signed-in user follows `userId`, or `fallback` if nothing is known yet. */
  isFollowing(userId: string, fallback = false): boolean {
    return this.states().get(userId) ?? fallback;
  }

  /** A request for `userId` is in flight — its buttons should be disabled. */
  isPending(userId: string): boolean {
    return this.pending().has(userId);
  }

  /** Which action last failed for `userId` (cleared by the next attempt), if any. */
  failure(userId: string): FollowFailure | null {
    return this.failures().get(userId) ?? null;
  }

  /** Records the server's view (e.g. a loaded profile's `isFollowing`) unless a request is in flight. */
  seed(userId: string, following: boolean): void {
    if (!this.isPending(userId)) {
      this.states.update((states) => withEntry(states, userId, following));
    }
  }

  follow(userId: string): Promise<void> {
    return this.setFollowing(userId, true);
  }

  unfollow(userId: string): Promise<void> {
    return this.setFollowing(userId, false);
  }

  private async setFollowing(userId: string, following: boolean): Promise<void> {
    if (this.isPending(userId) || this.isFollowing(userId) === following) {
      return;
    }
    const delta = following ? 1 : -1;
    this.pending.update((ids) => new Set(ids).add(userId));
    this.failures.update((failures) => withoutKey(failures, userId));
    this.states.update((states) => withEntry(states, userId, following));
    this.countChanges.next({ userId, followersDelta: delta });

    try {
      const response = await firstValueFrom(
        this.http.put<FollowToggleApiResponse>(`${API_BASE_URL}/users/${userId}/follow`, {}),
      );
      const actual = response.data.following;
      this.states.update((states) => withEntry(states, userId, actual));
      // Normally 0. Non-zero only if our belief was stale, so the toggle went the other way.
      this.countChanges.next({
        userId,
        followersDelta: (actual ? 1 : -1) - delta,
        followersCount: response.data.followersCount,
      });
    } catch {
      this.states.update((states) => withEntry(states, userId, !following));
      this.countChanges.next({ userId, followersDelta: -delta });
      this.failures.update((failures) =>
        withEntry(failures, userId, following ? 'follow' : 'unfollow'),
      );
    } finally {
      this.pending.update((ids) => {
        const next = new Set(ids);
        next.delete(userId);
        return next;
      });
    }
  }
}

function withEntry<K, V>(map: ReadonlyMap<K, V>, key: K, value: V): ReadonlyMap<K, V> {
  return new Map(map).set(key, value);
}

function withoutKey<K, V>(map: ReadonlyMap<K, V>, key: K): ReadonlyMap<K, V> {
  if (!map.has(key)) {
    return map;
  }
  const next = new Map(map);
  next.delete(key);
  return next;
}
