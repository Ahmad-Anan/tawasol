import { HttpClient, HttpParams } from '@angular/common/http';
import { Service, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, firstValueFrom, forkJoin, map, of, switchMap, tap } from 'rxjs';
import { API_BASE_URL } from '../../../core/constants/api';
import { AuthService } from '../../../core/services/auth.service';
import { DemoAccountService } from '../../../core/services/demo-account';
import { FollowService } from '../../../core/services/follow';
import type { BookmarksApiResponse } from '../../bookmarks/bookmarks.interface';
import type { Post } from '../../feed/feed.interface';
import { PostsService } from '../../feed/services/posts.service';
import type {
  MyProfileApiResponse,
  ProfileUser,
  UploadPhotoApiResponse,
  UserPostsApiResponse,
  UserProfileApiResponse,
} from '../profile.interface';

/**
 * Signal-based state for a viewed profile, following the same shape as PostsService: private
 * writable signals internally, readonly signals exposed, `@Service()` singleton. Unlike
 * PostsService there's only ever one profile "loaded" at a time — `load()` replaces it, it
 * doesn't accumulate a list — so the singleton just holds whichever profile route is current.
 */
@Service()
export class ProfileService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly demoAccount = inject(DemoAccountService);
  // Follow state lives in FollowService (shared with the suggested-friends widget); this service
  // only seeds it from the loaded profile and keeps the profile's counts in sync with it.
  private readonly followService = inject(FollowService);
  // PostCard always mutates through PostsService (like/bookmark/share/edit/delete), regardless
  // of which list rendered it — see PostsService.mergePosts. So this profile's posts read the
  // actual, always-current post objects from there, and only track *which* ids (and in what
  // order) `GET /users/:id/posts` said belong to this profile.
  private readonly postsService = inject(PostsService);

  private readonly _profile = signal<ProfileUser | null>(null);
  private readonly _postIds = signal<string[]>([]);
  /**
   * From `meta.pagination.total`, not `posts().length` — the endpoint caps at 40 posts (see
   * docs/api-reference.md), so for a prolific user this is the only accurate count. It isn't
   * decremented on a local delete (a real, minor drift) since re-fetching just to keep a
   * counter exact isn't worth it here.
   */
  private readonly _postsTotal = signal(0);
  /**
   * Only ever populated for the signed-in user's own profile (see `load()`) — there's no
   * endpoint for *another* user's bookmark count, and it wouldn't be a public stat anyway.
   * `null` means "not applicable" (someone else's profile), distinct from `0` bookmarks.
   */
  private readonly _bookmarksCount = signal<number | null>(null);
  private readonly _isLoading = signal(false);
  private readonly _loadError = signal(false);
  /** The id `load()` was last called with, so `retryLoad()` can re-request it. */
  private lastRequestedUserId: string | null = null;
  private readonly _isUploadingPhoto = signal(false);
  private readonly _uploadError = signal(false);

  readonly profile = this._profile.asReadonly();
  readonly postsTotal = this._postsTotal.asReadonly();
  readonly bookmarksCount = this._bookmarksCount.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly loadError = this._loadError.asReadonly();
  readonly isUploadingPhoto = this._isUploadingPhoto.asReadonly();
  readonly uploadError = this._uploadError.asReadonly();

  readonly isOwnProfile = computed(() => this._profile()?._id === this.authService.user()?._id);

  /** Whether the signed-in user follows the loaded profile (via FollowService, so it's shared). */
  readonly isFollowing = computed(() => {
    const profile = this._profile();
    return profile ? this.followService.isFollowing(profile._id) : false;
  });
  /** A follow/unfollow request for the loaded profile is in flight. */
  readonly isTogglingFollow = computed(() => {
    const profile = this._profile();
    return profile ? this.followService.isPending(profile._id) : false;
  });
  /** The follow/unfollow that last failed (and was rolled back) for the loaded profile, if any. */
  readonly followError = computed(() => {
    const profile = this._profile();
    return profile ? this.followService.failure(profile._id) : null;
  });

  async toggleFollow(): Promise<void> {
    const profile = this._profile();
    if (!profile) {
      return;
    }
    await (this.isFollowing()
      ? this.followService.unfollow(profile._id)
      : this.followService.follow(profile._id));
  }

  readonly posts = computed(() => {
    const byId = new Map(this.postsService.posts().map((post) => [post.id, post]));
    return this._postIds()
      .map((id) => byId.get(id))
      .filter((post): post is Post => post !== undefined);
  });

  /**
   * Every `load()` call feeds this stream, and `switchMap` below unsubscribes from the previous
   * profile's requests — which cancels the in-flight HTTP calls — as soon as a new id arrives.
   * So only the latest request can ever write to state: navigating quickly from profile A to
   * profile B can no longer let A's slower response land on top of B's page.
   */
  private readonly loadRequests = new Subject<string>();

  constructor() {
    this.loadRequests
      .pipe(
        tap(() => {
          this._isLoading.set(true);
          this._loadError.set(false);
          this._profile.set(null);
          this._postIds.set([]);
          this._bookmarksCount.set(null);
        }),
        switchMap((userId) =>
          this.fetchProfile(userId).pipe(
            map((result) => ({ ok: true as const, result })),
            catchError(() => of({ ok: false as const })),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((outcome) => {
        if (outcome.ok) {
          const { profileResult, postsResponse, bookmarksCount } = outcome.result;
          this._profile.set(profileResult.user);
          if (!this.isOwnProfile()) {
            this.followService.seed(profileResult.user._id, profileResult.isFollowing);
          }
          this.postsService.mergePosts(postsResponse.data.posts);
          this._postIds.set(postsResponse.data.posts.map((post) => post.id));
          this._postsTotal.set(postsResponse.meta.pagination.total);
          this._bookmarksCount.set(bookmarksCount);
        } else {
          this._loadError.set(true);
        }
        this._isLoading.set(false);
      });

    // Keep the loaded profile's counts in step with follows/unfollows made anywhere (this
    // profile's own button, or the suggested-friends widget/dialog): the target's follower
    // count, and — when this is the signed-in user's own profile — their following count.
    this.followService.countChanges$.pipe(takeUntilDestroyed()).subscribe((change) => {
      const profile = this._profile();
      if (!profile) {
        return;
      }
      if (profile._id === change.userId) {
        this._profile.set({
          ...profile,
          followersCount:
            change.followersCount ?? Math.max(0, profile.followersCount + change.followersDelta),
        });
      } else if (this.isOwnProfile() && change.followersDelta !== 0) {
        this._profile.set({
          ...profile,
          followingCount: Math.max(0, profile.followingCount + change.followersDelta),
        });
      }
    });
  }

  /** Retries a failed `load()` for the same profile. */
  retryLoad(): void {
    if (this.lastRequestedUserId !== null && !this._isLoading()) {
      this.load(this.lastRequestedUserId);
    }
  }

  load(userId: string): void {
    this.lastRequestedUserId = userId;
    this.loadRequests.next(userId);
  }

  private fetchProfile(userId: string) {
    const isOwn = userId === this.authService.user()?._id;
    // Fired together, not one after another — the profile, the post list, and (for one's own
    // profile) the bookmarks count are independent reads (see docs/api-reference.md), so
    // there's no reason to make the user wait for each round trip in sequence. `limit=1` on
    // the bookmarks request — only `meta.pagination.total` is read, the bookmarks themselves
    // are irrelevant here (BookmarksService owns the actual list).
    return forkJoin({
      profileResult: isOwn
        ? this.http
            .get<MyProfileApiResponse>(`${API_BASE_URL}/users/profile-data`)
            .pipe(map((response) => ({ user: response.data.user, isFollowing: false })))
        : this.http
            .get<UserProfileApiResponse>(`${API_BASE_URL}/users/${userId}/profile`)
            .pipe(
              map((response) => ({
                user: response.data.user,
                isFollowing: response.data.isFollowing,
              })),
            ),
      postsResponse: this.http.get<UserPostsApiResponse>(`${API_BASE_URL}/users/${userId}/posts`),
      bookmarksCount: isOwn
        ? this.http
            .get<BookmarksApiResponse>(`${API_BASE_URL}/users/bookmarks`, {
              params: new HttpParams().set('limit', 1),
            })
            .pipe(map((response): number | null => response.meta.pagination.total))
        : of(null),
    });
  }

  async uploadPhoto(file: File): Promise<void> {
    // The public demo account's photo is fixed (the UI disables the control too — this is the
    // backstop so no code path can change it).
    if (this._isUploadingPhoto() || this.demoAccount.isDemo()) {
      return;
    }
    this._isUploadingPhoto.set(true);
    this._uploadError.set(false);
    try {
      const formData = new FormData();
      formData.set('photo', file);
      const response = await firstValueFrom(
        this.http.put<UploadPhotoApiResponse>(`${API_BASE_URL}/users/upload-photo`, formData),
      );
      const profile = this._profile();
      if (profile) {
        this._profile.set({ ...profile, photo: response.data.photo });
      }
    } catch {
      this._uploadError.set(true);
    } finally {
      this._isUploadingPhoto.set(false);
    }
  }
}
