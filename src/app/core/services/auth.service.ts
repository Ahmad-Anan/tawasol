import { PLATFORM_ID, Service, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import type {
  ApiSuccessResponse,
  AuthResponseData,
  AuthUser,
  SigninRequest,
  SignupRequest,
} from '../../features/auth/auth.interface';
import { API_BASE_URL } from '../constants/api';

/**
 * `GET /users/profile-data`'s user shape (see docs/api-reference.md) has several fields
 * `AuthUser` doesn't declare (dateOfBirth, gender, counts, …) — irrelevant here, only used to
 * type-check that the response has at least what `AuthUser` needs.
 */
interface ProfileDataResponse extends ApiSuccessResponse<{ user: AuthUser }> {}

const TOKEN_STORAGE_KEY = 'tawasol-token';

@Service()
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly _token = signal<string | null>(this.resolveInitialToken());
  private readonly _user = signal<AuthUser | null>(null);

  readonly user = this._user.asReadonly();
  // Exposed so `authInterceptor` can attach it to outgoing requests without AuthService
  // needing to know about HTTP interceptors itself.
  readonly token = this._token.asReadonly();
  readonly isAuthenticated = computed(() => this._token() !== null);

  constructor() {
    // A stored token survives a page refresh (see `resolveInitialToken()`), but `_user` never
    // did — it was only ever set by `signup()`/`signin()`. Every reader of `user()` (PostCard's
    // isOwnPost/isLiked, the navbar's own-profile link, ProfileService's "is this me" check, …)
    // would silently see `null` until the next sign-in. Rehydrate it once at startup from the
    // same endpoint ProfileService uses for "my profile" — if the stored token turns out to be
    // stale/invalid, this 401s and `logout()` clears it instead of leaving a broken
    // authenticated-but-no-user state around.
    //
    // `queueMicrotask` here isn't cosmetic — it's load-bearing. `hydrateUser()`'s HTTP call goes
    // through `authInterceptor`, which does `inject(AuthService)`. Calling `hydrateUser()`
    // directly (even fire-and-forget with `void`) runs its synchronous prefix — everything up
    // to its first `await` — inline, as part of *this* constructor call, before Angular's DI
    // has finished constructing this very instance and marked it available. That's a genuine
    // self-injection during construction: verified live, it throws `NG0200: Circular dependency
    // detected for AuthService`, caught by hydrateUser()'s own try/catch, which then called
    // logout() — silently wiping a valid stored token on nearly every hard page load. Deferring
    // to a microtask lets this constructor return (and Angular mark the instance constructed)
    // before hydrateUser()'s request ever reaches the interceptor.
    if (this.isBrowser && this._token()) {
      this.hydration = new Promise<void>((resolve) => queueMicrotask(() => void this.hydrateUser().finally(resolve)));
    }
  }

  /** Settles once the startup `hydrateUser()` request (if any) has finished, either way. */
  private hydration: Promise<void> = Promise.resolve();

  /**
   * The signed-in user once it's known, or `null` when signed out. Unlike `user()`, this waits
   * for the startup hydration after a hard reload (when a stored token exists but the user
   * object hasn't been fetched yet), so guards can decide based on *who* is signed in rather
   * than reading a not-yet-loaded `null`.
   */
  async whenUserResolved(): Promise<AuthUser | null> {
    if (this._user() || !this._token()) {
      return this._user();
    }
    await this.hydration;
    return this._user();
  }

  async signup(payload: SignupRequest): Promise<void> {
    const response = await firstValueFrom(
      this.http.post<ApiSuccessResponse<AuthResponseData>>(`${API_BASE_URL}/users/signup`, payload),
    );
    this.setSession(response.data);
  }

  async signin(payload: SigninRequest): Promise<void> {
    const response = await firstValueFrom(
      this.http.post<ApiSuccessResponse<AuthResponseData>>(`${API_BASE_URL}/users/signin`, payload),
    );
    this.setSession(response.data);
  }

  /**
   * `PATCH /users/change-password` — verified live (see docs/api-reference.md) to invalidate
   * the previously-issued token immediately, replacing it with the fresh one this response
   * carries. Persisting that new token here (not just returning it to the caller) is what keeps
   * the signed-in session alive across the change — without it, the very next authenticated
   * request after a successful change would 401 on the now-dead old token. No `user` comes back
   * in this response (see the docs), so `_user` is left untouched.
   */
  async changePassword(payload: { password: string; newPassword: string }): Promise<void> {
    const response = await firstValueFrom(
      this.http.patch<ApiSuccessResponse<{ token: string }>>(`${API_BASE_URL}/users/change-password`, payload),
    );
    this.persistToken(response.data.token);
  }

  logout(): void {
    this._token.set(null);
    this._user.set(null);
    if (this.isBrowser) {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  }

  private setSession(data: AuthResponseData): void {
    this._user.set(data.user);
    this.persistToken(data.token);
  }

  private persistToken(token: string): void {
    this._token.set(token);
    if (this.isBrowser) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    }
  }

  private resolveInitialToken(): string | null {
    if (!this.isBrowser) {
      return null;
    }
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  }

  private async hydrateUser(): Promise<void> {
    try {
      const response = await firstValueFrom(
        this.http.get<ProfileDataResponse>(`${API_BASE_URL}/users/profile-data`),
      );
      this._user.set(response.data.user);
    } catch {
      this.logout();
    }
  }
}
