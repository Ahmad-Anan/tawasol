// Re-exported for existing imports (`import type { ApiSuccessResponse, ApiErrorResponse } from
// '../auth.interface'`) — the actual definitions live in shared/interfaces since
// features/feed needs the exact same envelope and duplicating it would drift.
export type { ApiSuccessResponse, ApiErrorResponse } from '../../shared/interfaces/api-response.interface';

export interface SignupRequest {
  name: string;
  username?: string;
  email: string;
  dateOfBirth: string;
  gender: 'male' | 'female';
  password: string;
  rePassword: string;
}

/**
 * The API accepts `email`, `username`, or `login` as the identifier key. Verified against
 * the live API: `login` has no format restriction (accepts an email- or username-shaped
 * value), while `username` is validated as `^[a-z0-9_]{3,30}$` and rejects an email-shaped
 * value. The client only ever sends `login` — see docs/api-reference.md.
 */
export interface SigninRequest {
  email?: string;
  username?: string;
  login?: string;
  password: string;
}

export interface AuthUser {
  _id: string;
  name: string;
  username: string;
  email: string;
  photo: string;
  cover: string;
}

export interface AuthResponseData {
  token: string;
  tokenType: string;
  expiresIn: string;
  user: AuthUser;
}
