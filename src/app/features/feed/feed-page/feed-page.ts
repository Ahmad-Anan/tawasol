import { isPlatformBrowser } from '@angular/common';
import { Component, ElementRef, PLATFORM_ID, effect, inject, viewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslatePipe } from '@ngx-translate/core';
import { CreatePost } from '../create-post/create-post';
import { PostCard } from '../post-card/post-card';
import { PostsService } from '../services/posts.service';

@Component({
  selector: 'app-feed-page',
  imports: [CreatePost, PostCard, MatButtonModule, MatProgressSpinnerModule, TranslatePipe],
  templateUrl: './feed-page.html',
  styleUrl: './feed-page.css',
})
export class FeedPage {
  protected readonly postsService = inject(PostsService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  // Only rendered (see feed-page.html) while there's another page to fetch, so this signal
  // naturally becomes `undefined` again once the feed is exhausted.
  private readonly scrollSentinel = viewChild<ElementRef<HTMLElement>>('scrollSentinel');

  constructor() {
    // True infinite scroll: observes a sentinel element at the bottom of the list and calls
    // loadMore() once it enters the viewport. Re-attaches whenever the sentinel
    // appears/disappears (effect cleanup runs first each time this re-executes).
    effect((onCleanup) => {
      const element = this.scrollSentinel()?.nativeElement;
      if (!this.isBrowser || !element) {
        return;
      }

      const observer = new IntersectionObserver((entries) => {
        if (entries[0]?.isIntersecting) {
          this.postsService.loadMore();
        }
      });
      observer.observe(element);
      onCleanup(() => observer.disconnect());
    });
  }
}
