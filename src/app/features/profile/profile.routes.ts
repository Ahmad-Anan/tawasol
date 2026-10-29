import { Routes } from '@angular/router';
import { authGuard } from '../../core/guards/auth.guard';
import { ProfilePage } from './profile-page/profile-page';

export const PROFILE_ROUTES: Routes = [
  // Generic title: the person's name only arrives with ProfileService's request, after navigation.
  { path: ':id', component: ProfilePage, title: 'shared.pageTitles.profile', canActivate: [authGuard] },
];
