import { Routes } from '@angular/router';
import { guestGuard } from '../../core/guards/guest.guard';
import { AuthShell } from './auth-shell/auth-shell';

export const AUTH_ROUTES: Routes = [
  {
    path: 'login',
    component: AuthShell,
    title: 'shared.pageTitles.login',
    data: { tab: 'login' },
    canActivate: [guestGuard],
  },
  {
    path: 'register',
    component: AuthShell,
    title: 'shared.pageTitles.register',
    data: { tab: 'register' },
    canActivate: [guestGuard],
  },
  { path: '', redirectTo: 'login', pathMatch: 'full' },
];
