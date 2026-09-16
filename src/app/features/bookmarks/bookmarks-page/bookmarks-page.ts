import { isPlatformBrowser } from '@angular/common';
import { Component, ElementRef, PLATFORM_ID, effect, inject, viewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslatePipe } from '@ngx-translate/core';
import { PostCard } from '../../feed/post-card/post-card';
import { PostCardSkeleton } from '../../feed/post-card-skeleton/post-card-skeleton';
import { BookmarksService } from '../services/bookmarks.service';

@Component({
  selector: 'app-bookmarks-page',
  imports: [PostCard, PostCardSkeleton, MatButtonModule, MatProgressSpinnerModule, TranslatePipe],
  templateUrl: './bookmarks-page.html',
  styleUrl: './bookmarks-page.css',
})
export class BookmarksPage {
  protected readonly bookmarksService = inject(BookmarksService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly scrollSentinel = viewChild<ElementRef<HTMLElement>>('scrollSentinel');

  constructor() {
    // BookmarksService doesn't fetch merely by being constructed — see its own doc comment.
    // This is the one place that actually wants the list loaded.
    this.bookmarksService.start();

    // Same true-infinite-scroll pattern as FeedPage: observes a sentinel at the bottom of the
    // list and calls loadMore() once it enters the viewport.
    effect((onCleanup) => {
      const element = this.scrollSentinel()?.nativeElement;
      if (!this.isBrowser || !element) {
        return;
      }

      const observer = new IntersectionObserver((entries) => {
        if (entries[0]?.isIntersecting) {
          this.bookmarksService.loadMore();
        }
      });
      observer.observe(element);
      onCleanup(() => observer.disconnect());
    });
  }
}
