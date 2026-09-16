import type { ApiSuccessResponse } from '../../shared/interfaces/api-response.interface';
import type { FeedPagePagination } from '../feed/feed.interface';

/**
 * Shape verified against the live API — see docs/api-reference.md > "GET /users/suggestions".
 * Unlike posts/comments, a suggestion has no `id` alias for `_id`.
 */
export interface SuggestedUser {
  _id: string;
  name: string;
  username: string;
  photo: string;
  mutualFollowersCount: number;
  followersCount: number;
}

export interface SuggestionsApiResponse extends ApiSuccessResponse<{ suggestions: SuggestedUser[] }> {
  meta: { pagination: FeedPagePagination };
}
