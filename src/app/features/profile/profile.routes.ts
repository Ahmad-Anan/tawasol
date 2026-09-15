import { Routes } from '@angular/router';
import { ProfilePage } from './profile-page/profile-page';

export const PROFILE_ROUTES: Routes = [{ path: ':id', component: ProfilePage }];
