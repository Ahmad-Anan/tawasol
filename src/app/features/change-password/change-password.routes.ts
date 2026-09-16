import { Routes } from '@angular/router';
import { authGuard } from '../../core/guards/auth.guard';
import { ChangePasswordPage } from './change-password-page/change-password-page';

export const CHANGE_PASSWORD_ROUTES: Routes = [{ path: '', component: ChangePasswordPage, canActivate: [authGuard] }];
