import { HttpClient, HttpParams } from '@angular/common/http';
import { Service, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../../../core/constants/api';
import { AuthService } from '../../../core/services/auth.service';
import type { BookmarksApiResponse } from '../../bookmarks/bookmarks.interface';
import type { Post } from '../../feed/feed.interface';
import { PostsService } from '../../feed/services/posts.service';
import type {
  FollowToggleApiResponse,
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
  // PostCard always mutates through PostsService (like/bookmark/share/edit/delete), regardless
  // of which list rendered it — see PostsService.mergePosts. So this profile's posts read the
  // actual, always-current post objects from there, and only track *which* ids (and in what
  // order) `GET /users/:id/posts` said belong to this profile.
  private readonly postsService = inject(PostsService);

  private readonly _profile = signal<ProfileUser | null>(null);
  private readonly _isFollowing = signal(false);
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
  private readonly _isTogglingFollow = signal(false);
  private readonly _followError = signal(false);
  private readonly _isUploadingPhoto = signal(false);
  private readonly _uploadError = signal(false);

  readonly profile = this._profile.asReadonly();
  readonly isFollowing = this._isFollowing.asReadonly();
  readonly postsTotal = this._postsTotal.asReadonly();
  readonly bookmarksCount = this._bookmarksCount.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly loadError = this._loadError.asReadonly();
  readonly isTogglingFollow = this._isTogglingFollow.asReadonly();
  readonly followError = this._followError.asReadonly();
  readonly isUploadingPhoto = this._isUploadingPhoto.asReadonly();
  readonly uploadError = this._uploadError.asReadonly();

  readonly isOwnProfile = computed(() => this._profile()?._id === this.authService.user()?._id);

  readonly posts = computed(() => {
    const byId = new Map(this.postsService.posts().map((post) => [post.id, post]));
    return this._postIds()
      .map((id) => byId.get(id))
      .filter((post): post is Post => post !== undefined);
  });

  async load(userId: string): Promise<void> {
    this._isLoading.set(true);
    this._loadError.set(false);
    this._profile.set(null);
    this._postIds.set([]);
    this._bookmarksCount.set(null);
    try {
      const isOwn = userId === this.authService.user()?._id;
      // Fired together, not awaited one after another — the profile, the post list, and (for
      // one's own profile) the bookmarks count are independent reads (see
      // docs/api-reference.md), so there's no reason to make the user wait for each round trip
      // in sequence. `limit=1` on the bookmarks request — only `meta.pagination.total` is read,
      // the bookmarks themselves are irrelevant here (BookmarksService owns the actual list).
      const [profileResult, postsResponse, bookmarksCount] = await Promise.all([
        isOwn
          ? firstValueFrom(this.http.get<MyProfileApiResponse>(`${API_BASE_URL}/users/profile-data`)).then(
              (response) => ({ user: response.data.user, isFollowing: false }),
            )
          : firstValueFrom(this.http.get<UserProfileApiResponse>(`${API_BASE_URL}/users/${userId}/profile`)).then(
              (response) => ({ user: response.data.user, isFollowing: response.data.isFollowing }),
            ),
        firstValueFrom(this.http.get<UserPostsApiResponse>(`${API_BASE_URL}/users/${userId}/posts`)),
        isOwn
          ? firstValueFrom(
              this.http.get<BookmarksApiResponse>(`${API_BASE_URL}/users/bookmarks`, {
                params: new HttpParams().set('limit', 1),
              }),
            ).then((response) => response.meta.pagination.total)
          : Promise.resolve(null),
      ]);

      this._profile.set(profileResult.user);
      this._isFollowing.set(profileResult.isFollowing);
      this.postsService.mergePosts(postsResponse.data.posts);
      this._postIds.set(postsResponse.data.posts.map((post) => post.id));
      this._postsTotal.set(postsResponse.meta.pagination.total);
      this._bookmarksCount.set(bookmarksCount);
    } catch {
      this._loadError.set(true);
    } finally {
      this._isLoading.set(false);
    }
  }

  async toggleFollow(): Promise<void> {
    const profile = this._profile();
    if (!profile || this._isTogglingFollow()) {
      return;
    }
    this._isTogglingFollow.set(true);
    this._followError.set(false);
    try {
      const result = await this.followUserId(profile._id);
      this._isFollowing.set(result.following);
      this._profile.set({ ...profile, followersCount: result.followersCount });
    } catch {
      this._followError.set(true);
    } finally {
      this._isTogglingFollow.set(false);
    }
  }

  /**
   * The bare `PUT /users/:id/follow` call, usable for any user id — not just whichever profile
   * is currently loaded into this service. `toggleFollow()` above is this plus the bookkeeping
   * for the loaded profile's own `_isFollowing`/`followersCount`; callers that just need to
   * follow an arbitrary user (e.g. the suggested-friends widget) use this directly instead of
   * duplicating the endpoint URL.
   */
  async followUserId(userId: string): Promise<FollowToggleApiResponse['data']> {
    const response = await firstValueFrom(
      this.http.put<FollowToggleApiResponse>(`${API_BASE_URL}/users/${userId}/follow`, {}),
    );
    return response.data;
  }

  async uploadPhoto(file: File): Promise<void> {
    if (this._isUploadingPhoto()) {
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
