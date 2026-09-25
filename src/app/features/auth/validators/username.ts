/**
 * The API's own username rule, verified live against `POST /users/signup` (see
 * docs/api-reference.md): any other value is rejected with a 400.
 */
export const USERNAME_PATTERN = /^[a-z0-9_]{3,30}$/;
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 30;

const ALLOWED_CHARACTERS = /^[a-z0-9_]*$/;

/**
 * The friendly part of the username rule: fixes the two mistakes people make most — capital
 * letters and spaces — as they type, instead of rejecting them. Uppercase becomes lowercase and
 * any whitespace becomes an underscore ("Ahmed Anan" → "ahmed_anan"). Everything else (Arabic
 * letters, symbols) is left for `usernameError` to explain, not silently dropped.
 */
export function normalizeUsername(value: string): string {
  return value.toLowerCase().replace(/\s/g, '_');
}

export type UsernameError = 'characters' | 'length';

/**
 * Why a username would be rejected, or `null` if it's fine. The field is optional, so an empty
 * value is valid. Character problems are reported ahead of length problems, since fixing the
 * characters is what the user needs to do first.
 */
export function usernameError(value: string): UsernameError | null {
  if (value === '') {
    return null;
  }
  if (!ALLOWED_CHARACTERS.test(value)) {
    return 'characters';
  }
  if (value.length < USERNAME_MIN_LENGTH || value.length > USERNAME_MAX_LENGTH) {
    return 'length';
  }
  return null;
}
