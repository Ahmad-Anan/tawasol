import type { ApiSuccessResponse } from '../../shared/interfaces/api-response.interface';
import type { FeedPagePagination, Post } from '../feed/feed.interface';

/**
 * Shapes verified against the live API — see docs/api-reference.md > "Users / profile
 * endpoints" for the full write-up (including why `followers`/`following` aren't modeled
 * precisely and why `GET /users/:id/posts` has no working "load more").
 */

/**
 * `bio` has never been observed in any tested response, on any endpoint — there's no way to
 * set one either. Modeled as optional in case the backend adds it later; the profile header
 * simply omits the row when it's absent, not treated as an error.
 */
export interface ProfileUser {
  _id: string;
  id: string;
  name: string;
  username: string;
  email: string;
  photo: string;
  cover: string;
  bio?: string;
  followersCount: number;
  followingCount: number;
  createdAt: string;
}

export interface MyProfileApiResponse extends ApiSuccessResponse<{ user: ProfileUser }> {}

/**
 * Unlike `MyProfileApiResponse`, this adds `isFollowing` — verified live to also work (and
 * return `isFollowing: false`) when `:id` is the signed-in user's own id, so the client uses
 * this one endpoint for "someone else's profile" and, when convenient, its own.
 */
export interface UserProfileApiResponse extends ApiSuccessResponse<{ isFollowing: boolean; user: ProfileUser }> {}

/**
 * Full post shape (same as the feed's) — `GET /users/:id/posts` ignores `page`/`limit` and
 * always returns up to 40 posts, so `meta.pagination` is read only for `total` (the profile
 * header's post count), never to drive further fetches.
 */
export interface UserPostsApiResponse extends ApiSuccessResponse<{ posts: Post[] }> {
  meta: { pagination: FeedPagePagination };
}

export interface FollowToggleApiResponse extends ApiSuccessResponse<{ following: boolean; followersCount: number }> {}

/** Also creates a new public post from the photo — see docs/api-reference.md for why `postId` is here. */
export interface UploadPhotoApiResponse extends ApiSuccessResponse<{ photo: string; postId: string }> {}
