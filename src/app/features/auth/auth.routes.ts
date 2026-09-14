import { Routes } from '@angular/router';
import { AuthShell } from './auth-shell/auth-shell';

export const AUTH_ROUTES: Routes = [
  { path: 'login', component: AuthShell, data: { tab: 'login' } },
  { path: 'register', component: AuthShell, data: { tab: 'register' } },
  { path: '', redirectTo: 'login', pathMatch: 'full' },
];
