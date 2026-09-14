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
}
