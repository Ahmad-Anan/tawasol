import { Routes } from '@angular/router';

export const routes: Routes = [
  // No Feed/Home feature exists yet — '/' redirects straight to the login screen so the
  // app doesn't 404 on the root path. Revisit once a real landing/feed route exists.
  { path: '', redirectTo: 'auth/login', pathMatch: 'full' },
  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth.routes').then((m) => m.AUTH_ROUTES),
  },
];
