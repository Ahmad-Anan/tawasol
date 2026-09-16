import { Routes } from '@angular/router';
import { authGuard } from '../../core/guards/auth.guard';
import { FeedPage } from './feed-page/feed-page';

export const FEED_ROUTES: Routes = [{ path: '', component: FeedPage, canActivate: [authGuard] }];
