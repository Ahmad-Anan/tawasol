import { Routes } from '@angular/router';

export const routes: Routes = [
  // '/' redirects to the login screen, whose guestGuard (auth.routes.ts) then sends an
  // already-signed-in visitor on to '/feed' — signed-out visitors stay on the login screen.
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
  {
    path: 'change-password',
    loadChildren: () =>
      import('./features/change-password/change-password.routes').then((m) => m.CHANGE_PASSWORD_ROUTES),
  },
  {
    path: 'posts',
    loadChildren: () => import('./features/post-detail/post-detail.routes').then((m) => m.POST_DETAIL_ROUTES),
  },
  // Must stay last — anything unmatched above (including '/profile' or '/posts' with no id).
  {
    path: '**',
    loadComponent: () => import('./features/not-found/not-found-page/not-found-page').then((m) => m.NotFoundPage),
  },
];
