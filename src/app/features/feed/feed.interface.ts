import type { ApiSuccessResponse } from '../../shared/interfaces/api-response.interface';

/**
 * Shapes verified against the live API — see docs/api-reference.md > "Posts endpoints" for
 * the full write-up (including the two different post shapes and why they differ).
 */

export interface PostAuthor {
  _id: string;
  name: string;
  username: string;
  photo: string;
}

/**
 * The same author shape, but as returned by the like-toggle and likes-list endpoints, which
 * happen to populate a few extra profile stats. `bookmarksCount` here is the *user's* total
 * bookmarked-posts count, not a per-post stat — see docs/api-reference.md.
 */
export interface PostAuthorWithStats extends PostAuthor {
  followersCount: number;
  followingCount: number;
  bookmarksCount: number;
  id: string;
}

export interface PostComment {
  _id: string;
  content: string;
  commentCreator: PostAuthor;
  post: string;
  parentComment: string | null;
  likes: string[];
  createdAt: string;
}

/**
 * Full ("list/detail") post shape — returned by GET /posts/feed, GET /posts, GET /posts/:id,
 * and POST /posts/:id/share. `body`/`image` are each absent (not just falsy) when the post
 * doesn't have one. `bookmarked` is present on the outermost post of a response but never on
 * a nested `sharedPost`, so it's modeled as optional here rather than required.
 */
export interface Post {
  _id: string;
  id: string;
  body?: string;
  image?: string;
  privacy: string;
  user: PostAuthor;
  sharedPost: Post | null;
  likes: string[];
  createdAt: string;
  commentsCount: number;
  topComment: PostComment | null;
  sharesCount: number;
  likesCount: number;
  isShare: boolean;
  bookmarked?: boolean;
}

/**
 * Slim ("mutation") post shape — returned by POST /posts (create) and PUT /posts/:id (edit)
 * only. `user` is a bare id string (not populated), and commentsCount/topComment/
 * sharesCount/bookmarked don't exist on this shape at all — see docs/api-reference.md.
 * `PostsService` turns this into a displayable `Post` by filling in the gaps from
 * `AuthService.user()` and zeroing the missing counters.
 */
export interface MutatedPost {
  _id: string;
  id: string;
  body?: string;
  image?: string;
  privacy: string;
  user: string;
  sharedPost: Post | null;
  likes: string[];
  createdAt: string;
  likesCount: number;
  isShare: boolean;
}

export type FeedOnlyFilter = 'following' | 'me' | 'all';

export interface FeedPagePagination {
  currentPage: number;
  limit: number;
  total: number;
  numberOfPages: number;
  /** Only present as a key when another page exists. */
  nextPage?: number;
}

export interface FeedCursorMeta {
  limit: number;
  hasMore: boolean;
  nextCursor: string | null;
}

/**
 * `GET /posts/feed`'s two mutually-exclusive response shapes, switched by whether the
 * request included a `cursor` — see docs/api-reference.md.
 */
export type FeedMeta =
  | { feedMode: 'page'; pagination: FeedPagePagination }
  | { feedMode: 'cursor'; cursor: FeedCursorMeta };

export interface FeedResponseData {
  posts: Post[];
}

export interface FeedApiResponse extends ApiSuccessResponse<FeedResponseData> {
  meta: FeedMeta;
}

export interface AllPostsApiResponse extends ApiSuccessResponse<FeedResponseData> {
  meta: { pagination: FeedPagePagination };
}

export interface SinglePostApiResponse extends ApiSuccessResponse<{ post: Post }> {}

export interface CreateOrEditPostApiResponse extends ApiSuccessResponse<{ post: MutatedPost }> {}

export interface DeletePostApiResponse extends ApiSuccessResponse<{ post: MutatedPost }> {}

export interface LikeToggleApiResponse
  extends ApiSuccessResponse<{
    liked: boolean;
    likesCount: number;
    post: Omit<Post, 'commentsCount' | 'topComment' | 'sharesCount' | 'bookmarked' | 'user'> & {
      user: PostAuthorWithStats;
    };
  }> {}

export interface LikesListApiResponse
  extends ApiSuccessResponse<{ likes: PostAuthorWithStats[] }> {
  meta: { pagination: FeedPagePagination };
}

/** `bookmarksCount` is the signed-in user's total bookmark count, not a per-post one. */
export interface BookmarkToggleApiResponse
  extends ApiSuccessResponse<{ bookmarked: boolean; bookmarksCount: number }> {}

export interface SharePostApiResponse extends ApiSuccessResponse<{ post: Post }> {}
