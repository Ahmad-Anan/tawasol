import { Routes } from '@angular/router';
import { authGuard } from '../../core/guards/auth.guard';
import { notDemoGuard } from '../../core/guards/not-demo.guard';
import { ChangePasswordPage } from './change-password-page/change-password-page';

// notDemoGuard: the demo account's password is public, so changing it would lock every other
// visitor out of the demo (see core/services/demo-account.ts).
export const CHANGE_PASSWORD_ROUTES: Routes = [
  { path: '', component: ChangePasswordPage, canActivate: [authGuard, notDemoGuard] },
];
