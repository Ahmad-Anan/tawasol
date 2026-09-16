import { Routes } from '@angular/router';
import { authGuard } from '../../core/guards/auth.guard';
import { PostDetailPage } from './post-detail-page/post-detail-page';

export const POST_DETAIL_ROUTES: Routes = [{ path: ':id', component: PostDetailPage, canActivate: [authGuard] }];
