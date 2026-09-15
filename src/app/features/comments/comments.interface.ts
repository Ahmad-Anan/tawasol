import type { ApiSuccessResponse } from '../../shared/interfaces/api-response.interface';
import type { FeedPagePagination } from '../feed/feed.interface';

/**
 * Shapes verified against the live API — see docs/api-reference.md > "Comments endpoints" for
 * the full write-up (including why this split doesn't line up with the posts full/slim split).
 */

export interface CommentAuthor {
  _id: string;
  name: string;
  username: string;
  photo: string;
}

/** Same author shape, but as returned by create/edit/like-toggle — same incidental over-population as PostAuthorWithStats. */
export interface CommentAuthorWithStats extends CommentAuthor {
  followersCount: number;
  followingCount: number;
  bookmarksCount: number;
  id: string;
}

/**
 * "List" shape — returned by `GET /posts/:postId/comments` (top-level comments) only. No
 * `likesCount`/`isReply`/`id` — derive "liked by me" and the like count from `likes` directly.
 */
export interface CommentListItem {
  _id: string;
  content?: string;
  image?: string;
  commentCreator: CommentAuthor;
  post: string;
  parentComment: string | null;
  likes: string[];
  createdAt: string;
  repliesCount: number;
}

/**
 * "Mutation" shape — returned by `POST`/`PUT .../comments`, the like-toggle's nested `comment`,
 * and (confusingly) `GET .../replies`'s list items too. No `repliesCount` (a reply can't itself
 * have replies); `likesCount`/`isReply`/`id` present.
 */
export interface MutatedComment {
  _id: string;
  content?: string;
  image?: string;
  commentCreator: CommentAuthorWithStats;
  post: string;
  parentComment: string | null;
  likes: string[];
  createdAt: string;
  likesCount: number;
  isReply: boolean;
  id: string;
}

export interface CommentsListApiResponse extends ApiSuccessResponse<{ comments: CommentListItem[] }> {
  meta: { pagination: FeedPagePagination };
}

export interface RepliesListApiResponse extends ApiSuccessResponse<{ replies: MutatedComment[] }> {
  meta: { pagination: FeedPagePagination };
}

export interface CreateCommentApiResponse extends ApiSuccessResponse<{ comment: MutatedComment }> {}
export interface CreateReplyApiResponse extends ApiSuccessResponse<{ reply: MutatedComment }> {}
export interface EditCommentApiResponse extends ApiSuccessResponse<{ comment: MutatedComment }> {}
export interface CommentLikeToggleApiResponse
  extends ApiSuccessResponse<{ liked: boolean; likesCount: number; comment: MutatedComment }> {}

/**
 * Client-facing shape, normalized from whichever raw shape a given endpoint returned (see
 * CommentsService) — every component in this feature works with this, never the raw types
 * above directly. `likesCount`/`repliesCount` are always present here (derived from `likes`
 * when the list shape omitted `likesCount`; defaulted to `0` for a brand-new comment/reply,
 * same reasoning `PostsService.toDisplayPost` uses for a freshly created post's counters).
 */
export interface Comment {
  _id: string;
  content?: string;
  image?: string;
  commentCreator: CommentAuthor;
  post: string;
  parentComment: string | null;
  likes: string[];
  likesCount: number;
  repliesCount: number;
  createdAt: string;
}

export interface CommentPayload {
  content?: string;
  image?: File | null;
}
