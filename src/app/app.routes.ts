import { Routes } from '@angular/router';

export const routes: Routes = [
  // '/' always redirects to the login screen regardless of auth state — there's no route
  // guard yet to send an already-signed-in visitor straight to '/feed' instead (see the
  // feed feature summary; this is a pending decision, not an oversight).
  { path: '', redirectTo: 'auth/login', pathMatch: 'full' },
  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth.routes').then((m) => m.AUTH_ROUTES),
  },
  {
    path: 'feed',
    loadChildren: () => import('./features/feed/feed.routes').then((m) => m.FEED_ROUTES),
  },
];
