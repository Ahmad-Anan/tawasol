import { Routes } from '@angular/router';
import { authGuard } from '../../core/guards/auth.guard';
import { BookmarksPage } from './bookmarks-page/bookmarks-page';

export const BOOKMARKS_ROUTES: Routes = [{ path: '', component: BookmarksPage, canActivate: [authGuard] }];
