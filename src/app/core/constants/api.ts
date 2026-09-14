/**
 * Base URL for the Route Posts API (see docs/api-reference.md). Shared by every service that
 * calls it and by `authInterceptor` — previously duplicated as a local constant in
 * `auth.service.ts` only, extracted here once `PostsService` needed the same value.
 */
export const API_BASE_URL = 'https://route-posts.routemisr.com';
