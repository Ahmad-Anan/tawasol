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

export interface ApiSuccessResponse<TData> {
  success: true;
  message: string;
  data: TData;
}

export interface ApiErrorResponse {
  success: false;
  message: string;
  errors: string | string[];
}
