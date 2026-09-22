import { HttpClient, HttpParams } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  PLATFORM_ID,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { isPlatformBrowser, NgOptimizedImage } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../../../core/constants/api';
import type { PostAuthorWithStats, PostLikesApiResponse } from '../feed.interface';

const LIKES_PAGE_SIZE = 10;

export interface PostLikesDialogData {
  postId: string;
}

/**
 * Opened from a post's like count. Own, self-contained pagination state (not a shared
 * `@Service()`) — this dialog is single-purpose and transient, a fresh component instance per
 * `dialog.open()` call, so there's no shared-store race to guard against the way
 * PostsService/BookmarksService/SuggestionsService do; fetching straight from the constructor
 * here is safe and standard for a dialog whose entire job is "load this one thing".
 *
 * Infinite scroll's `IntersectionObserver` root is `mat-dialog-content`'s own element (it
 * already scrolls internally once content overflows the dialog's max-height) — same "root must
 * be the actual scrolling ancestor" reasoning as SuggestedFriends.
 */
@Component({
  selector: 'app-post-likes-dialog',
  imports: [MatButtonModule, MatDialogModule, MatProgressSpinnerModule, NgOptimizedImage, RouterLink, TranslatePipe],
  templateUrl: './post-likes-dialog.html',
  styleUrl: './post-likes-dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PostLikesDialog {
  private readonly http = inject(HttpClient);
  protected readonly data = inject<PostLikesDialogData>(MAT_DIALOG_DATA);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  // `read: ElementRef` is required here (unlike a plain `<div #ref>`) because `MatDialogContent`
  // is a directive on this same element — without it, `viewChild` resolves to the directive
  // instance instead of the native element, and `.nativeElement` below would be undefined.
  private readonly scrollContainer = viewChild('scrollContainer', { read: ElementRef<HTMLElement> });
  private readonly scrollSentinel = viewChild<ElementRef<HTMLElement>>('scrollSentinel');

  private readonly _page = signal(1);
  private readonly _likes = signal<PostAuthorWithStats[]>([]);
  private readonly _hasMore = signal(true);
  private readonly _isLoading = signal(false);
  private readonly _isLoadingMore = signal(false);
  private readonly _loadError = signal(false);
  private readonly _loadMoreError = signal(false);

  protected readonly likes = this._likes.asReadonly();
  protected readonly hasMore = this._hasMore.asReadonly();
  protected readonly isLoading = computed(() => this._isLoading() && this._likes().length === 0);
  protected readonly isLoadingMore = computed(() => this._isLoading() && this._likes().length > 0);
  protected readonly loadError = computed(() => (this._likes().length === 0 ? this._loadError() : false));
  protected readonly loadMoreError = this._loadMoreError.asReadonly();

  constructor() {
    void this.fetchPage(1);

    effect((onCleanup) => {
      const root = this.scrollContainer()?.nativeElement;
      const sentinel = this.scrollSentinel()?.nativeElement;
      if (!this.isBrowser || !root || !sentinel) {
        return;
      }

      const observer = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting) {
            this.loadMore();
          }
        },
        { root },
      );
      observer.observe(sentinel);
      onCleanup(() => observer.disconnect());
    });
  }

  protected loadMore(): void {
    if (!this._hasMore() || this._isLoading()) {
      return;
    }
    if (this._loadMoreError()) {
      void this.fetchPage(this._page());
      return;
    }
    void this.fetchPage(this._page() + 1);
  }

  private async fetchPage(page: number): Promise<void> {
    this._isLoading.set(true);
    this._loadError.set(false);
    this._loadMoreError.set(false);
    try {
      const params = new HttpParams().set('page', page).set('limit', LIKES_PAGE_SIZE);
      const response = await firstValueFrom(
        this.http.get<PostLikesApiResponse>(`${API_BASE_URL}/posts/${this.data.postId}/likes`, { params }),
      );
      this._likes.update((existing) => (page > 1 ? [...existing, ...response.data.likes] : response.data.likes));
      this._page.set(page);
      this._hasMore.set(response.meta.pagination.nextPage !== undefined);
    } catch {
      if (page > 1) {
        this._loadMoreError.set(true);
      } else {
        this._loadError.set(true);
      }
    } finally {
      this._isLoading.set(false);
    }
  }
}
