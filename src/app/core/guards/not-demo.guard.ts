import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { DemoAccountService } from '../services/demo-account';

/**
 * Keeps the public demo account off routes that could lock visitors out of it (currently
 * /change-password), sending it to /feed instead. Waits for the signed-in user to load, so a
 * hard reload straight onto the route is blocked too — not just in-app navigation. Runs after
 * `authGuard`, which has already turned signed-out visitors away.
 */
export const notDemoGuard: CanActivateFn = async () => {
  const demoAccount = inject(DemoAccountService);
  const router = inject(Router);
  return (await demoAccount.resolveIsDemo()) ? router.createUrlTree(['/feed']) : true;
};
