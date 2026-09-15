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
  {
    path: 'profile',
    loadChildren: () => import('./features/profile/profile.routes').then((m) => m.PROFILE_ROUTES),
  },
  {
    path: 'bookmarks',
    loadChildren: () => import('./features/bookmarks/bookmarks.routes').then((m) => m.BOOKMARKS_ROUTES),
  },
  {
    path: 'notifications',
    loadChildren: () =>
      import('./features/notifications/notifications.routes').then((m) => m.NOTIFICATIONS_ROUTES),
  },
];
