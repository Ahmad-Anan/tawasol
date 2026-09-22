import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from '../constants/api';
import type { AuthResponseData, AuthUser } from '../../features/auth/auth.interface';
import { AuthService } from './auth.service';

const TOKEN_STORAGE_KEY = 'tawasol-token';

function makeUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return { _id: 'u1', name: 'Ahmed', username: 'ahmed', email: 'ahmed@example.com', photo: '', cover: '', ...overrides };
}

function makeAuthResponse(overrides: Partial<AuthResponseData> = {}): AuthResponseData {
  return { token: 'token-123', tokenType: 'Bearer', expiresIn: '30d', user: makeUser(), ...overrides };
}

describe('AuthService', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('starts signed out with no stored token', () => {
    const service = TestBed.inject(AuthService);
    expect(service.isAuthenticated()).toBe(false);
    expect(service.token()).toBeNull();
    expect(service.user()).toBeNull();
  });

  it('signin() posts credentials, then stores the token and user on success', async () => {
    const service = TestBed.inject(AuthService);
    const promise = service.signin({ login: 'ahmed@example.com', password: 'Passw0rd!' });

    const req = httpMock.expectOne(`${API_BASE_URL}/users/signin`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ login: 'ahmed@example.com', password: 'Passw0rd!' });

    const response = makeAuthResponse();
    req.flush({ success: true, message: 'ok', data: response });
    await promise;

    expect(service.isAuthenticated()).toBe(true);
    expect(service.token()).toBe('token-123');
    expect(service.user()).toEqual(response.user);
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBe('token-123');
  });

  it('signin() rejects and leaves state unchanged when the API returns an error', async () => {
    const service = TestBed.inject(AuthService);
    const promise = service.signin({ login: 'ahmed@example.com', password: 'wrong' });

    const req = httpMock.expectOne(`${API_BASE_URL}/users/signin`);
    req.flush(
      { success: false, message: 'incorrect email or password', errors: 'incorrect email or password' },
      { status: 401, statusText: 'Unauthorized' },
    );

    await expect(promise).rejects.toBeTruthy();
    expect(service.isAuthenticated()).toBe(false);
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
  });

  it('signup() posts the payload, then stores the token and user on success', async () => {
    const service = TestBed.inject(AuthService);
    const payload = {
      name: 'Ahmed',
      email: 'ahmed@example.com',
      dateOfBirth: '2000-01-01',
      gender: 'male' as const,
      password: 'Passw0rd!',
      rePassword: 'Passw0rd!',
    };
    const promise = service.signup(payload);

    const req = httpMock.expectOne(`${API_BASE_URL}/users/signup`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);

    req.flush({ success: true, message: 'ok', data: makeAuthResponse() });
    await promise;

    expect(service.isAuthenticated()).toBe(true);
    expect(service.token()).toBe('token-123');
  });

  it('logout() clears the token, the user, and localStorage', async () => {
    const service = TestBed.inject(AuthService);
    const promise = service.signin({ login: 'ahmed@example.com', password: 'Passw0rd!' });
    httpMock.expectOne(`${API_BASE_URL}/users/signin`).flush({ success: true, message: 'ok', data: makeAuthResponse() });
    await promise;

    service.logout();

    expect(service.isAuthenticated()).toBe(false);
    expect(service.token()).toBeNull();
    expect(service.user()).toBeNull();
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
  });

  it('changePassword() persists the fresh token the API returns', async () => {
    const service = TestBed.inject(AuthService);
    const signinPromise = service.signin({ login: 'ahmed@example.com', password: 'Passw0rd!' });
    httpMock
      .expectOne(`${API_BASE_URL}/users/signin`)
      .flush({ success: true, message: 'ok', data: makeAuthResponse({ token: 'old-token' }) });
    await signinPromise;

    const promise = service.changePassword({ password: 'Passw0rd!', newPassword: 'NewPassw0rd!' });
    const req = httpMock.expectOne(`${API_BASE_URL}/users/change-password`);
    expect(req.request.method).toBe('PATCH');
    req.flush({ success: true, message: 'ok', data: { token: 'new-token' } });
    await promise;

    expect(service.token()).toBe('new-token');
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBe('new-token');
  });

  it('rehydrates the user from a token already in localStorage on construction', async () => {
    localStorage.setItem(TOKEN_STORAGE_KEY, 'stored-token');
    const service = TestBed.inject(AuthService);

    // Deferred to a microtask on purpose (see AuthService's constructor comment) to avoid a
    // circular-DI error, so the profile fetch only appears after one microtask turn.
    await Promise.resolve();
    const req = httpMock.expectOne(`${API_BASE_URL}/users/profile-data`);
    req.flush({ success: true, message: 'ok', data: { user: makeUser({ name: 'Rehydrated' }) } });
    await Promise.resolve();

    expect(service.isAuthenticated()).toBe(true);
    expect(service.user()?.name).toBe('Rehydrated');
  });

  it('logs out when a stored token turns out to be invalid', async () => {
    localStorage.setItem(TOKEN_STORAGE_KEY, 'stale-token');
    const service = TestBed.inject(AuthService);

    await Promise.resolve();
    const req = httpMock.expectOne(`${API_BASE_URL}/users/profile-data`);
    req.flush({ success: false, message: 'invalid token', errors: 'invalid token' }, { status: 401, statusText: 'Unauthorized' });
    await Promise.resolve();

    expect(service.isAuthenticated()).toBe(false);
    expect(service.user()).toBeNull();
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
  });
});
