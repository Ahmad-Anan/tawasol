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
    if (this.isBrowser && this._token()) {
      void this.hydrateUser();
    }
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

  logout(): void {
    this._token.set(null);
    this._user.set(null);
    if (this.isBrowser) {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  }

  private setSession(data: AuthResponseData): void {
    this._token.set(data.token);
    this._user.set(data.user);
    if (this.isBrowser) {
      localStorage.setItem(TOKEN_STORAGE_KEY, data.token);
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
