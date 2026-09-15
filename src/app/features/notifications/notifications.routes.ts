import { Routes } from '@angular/router';
import { authGuard } from '../../core/guards/auth.guard';
import { NotificationsPage } from './notifications-page/notifications-page';

export const NOTIFICATIONS_ROUTES: Routes = [{ path: '', component: NotificationsPage, canActivate: [authGuard] }];
