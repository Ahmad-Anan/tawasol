import { isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  PLATFORM_ID,
  computed,
  effect,
  inject,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIcon } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslatePipe } from '@ngx-translate/core';
import { SuggestedFriends } from '../../suggestions/suggested-friends/suggested-friends';
import { AuthService } from '../../../core/services/auth.service';
import { CreatePost } from '../create-post/create-post';
import { FeedNav } from '../feed-nav/feed-nav';
import { PostCard } from '../post-card/post-card';
import { PostCardSkeleton } from '../post-card-skeleton/post-card-skeleton';
import { PostsService } from '../services/posts.service';

@Component({
  selector: 'app-feed-page',
  imports: [
    CreatePost,
    FeedNav,
    PostCard,
    PostCardSkeleton,
    SuggestedFriends,
    MatButtonModule,
    MatButtonToggleModule,
    MatIcon,
    MatProgressSpinnerModule,
    TranslatePipe,
  ],
  templateUrl: './feed-page.html',
  styleUrl: './feed-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeedPage {
  protected readonly postsService = inject(PostsService);
  protected readonly authService = inject(AuthService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  // Only rendered (see feed-page.html) while there's another page to fetch, so this signal
  // naturally becomes `undefined` again once the feed is exhausted.
  private readonly scrollSentinel = viewChild<ElementRef<HTMLElement>>('scrollSentinel');

  /**
   * Icon for the empty-state illustration — presentation-only, so it lives here rather than
   * alongside PostsService.emptyStateKey() (which owns the equivalent *text* choice); mirrors
   * that computed's exact branching so the icon and message always agree on which empty state
   * is showing.
   */
  protected readonly emptyStateIcon = computed(() => {
    if (this.postsService.hasImageFilter() !== null) {
      return 'filter_alt_off';
    }
    switch (this.postsService.onlyFilter()) {
      case 'following':
        return 'people_outline';
      case 'me':
        return 'edit_note';
      default:
        return 'dynamic_feed';
    }
  });

  constructor() {
    // PostsService no longer starts fetching the feed merely by being constructed (it's also
    // injected by ProfileService now, which has no interest in the feed itself — see
    // PostsService._feedRequested) — this is the one place that actually wants it loaded.
    this.postsService.start();

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

  /** A plain toggle, not a 3-state control — "photos only" is either on or off. */
  protected toggleHasImageFilter(): void {
    this.postsService.setHasImageFilter(this.postsService.hasImageFilter() === true ? null : true);
  }
}
