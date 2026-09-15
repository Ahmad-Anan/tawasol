import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Redirects to the login screen when there's no stored token. `isAuthenticated` is
 * token-only (see AuthService) — true synchronously from localStorage, without waiting on the
 * async user-hydration request — so this check never has to await anything.
 *
 * Only `/bookmarks` uses this today. `/feed` and `/profile/:id` still don't (see
 * app.routes.ts's own comment) — a deliberate, pre-existing gap, not something this guard
 * was meant to close; it's reusable for either the moment that's wanted.
 */
export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  if (authService.isAuthenticated()) {
    return true;
  }
  return inject(Router).createUrlTree(['/auth/login']);
};
