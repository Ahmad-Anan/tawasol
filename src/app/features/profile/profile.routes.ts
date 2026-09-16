import { Routes } from '@angular/router';
import { authGuard } from '../../core/guards/auth.guard';
import { ProfilePage } from './profile-page/profile-page';

export const PROFILE_ROUTES: Routes = [{ path: ':id', component: ProfilePage, canActivate: [authGuard] }];
