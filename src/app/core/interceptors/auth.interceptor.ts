import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { API_BASE_URL } from '../constants/api';

/**
 * Attaches `Authorization: Bearer <token>` to every request to the Route Posts API. Every
 * `/posts/*` endpoint requires it (see docs/api-reference.md); `/users/signup` and
 * `/users/signin` don't need it, but there's no harm in sending it when a token happens to
 * already exist (e.g. re-authenticating while a stale session is still around) — the API
 * simply ignores it there, so scoping this to "any request to our API" instead of
 * endpoint-by-endpoint keeps PostsService from repeating the same header on every method.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(API_BASE_URL)) {
    return next(req);
  }

  const token = inject(AuthService).token();
  if (!token) {
    return next(req);
  }

  return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
};
