import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * The inverse of `authGuard`: keeps signed-in visitors off the login/register screens by
 * sending them to `/feed`, while signed-out visitors stay where they are. Guarding the auth
 * routes also covers `/` and `/auth`, since both only redirect to `/auth/login`. Same
 * token-only, synchronous `isAuthenticated` check as `authGuard`.
 */
export const guestGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  if (!authService.isAuthenticated()) {
    return true;
  }
  return inject(Router).createUrlTree(['/feed']);
};
