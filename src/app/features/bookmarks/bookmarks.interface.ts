import type { ApiSuccessResponse } from '../../shared/interfaces/api-response.interface';
import type { FeedPagePagination, Post } from '../feed/feed.interface';

/**
 * Shape verified against the live API — see docs/api-reference.md > "GET /users/bookmarks".
 * Same full post shape as the feed's, each with `bookmarked: true`. The list key is
 * `data.bookmarks`, not `data.posts` like every other list endpoint in this API.
 */
export interface BookmarksApiResponse extends ApiSuccessResponse<{ bookmarks: Post[] }> {
  meta: { pagination: FeedPagePagination };
}
