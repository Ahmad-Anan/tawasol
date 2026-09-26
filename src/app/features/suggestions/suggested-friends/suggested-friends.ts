import { isPlatformBrowser, NgOptimizedImage } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  PLATFORM_ID,
  effect,
  inject,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { FollowService } from '../../../core/services/follow';
import { isolateBidi } from '../../../shared/bidi/isolate-bidi';
import { FollowButton } from '../../../shared/follow-button/follow-button';
import { SuggestionsService } from '../services/suggestions.service';

/**
 * Sidebar widget for the feed page — people-you-may-know, each with the shared FollowButton. Not
 * routed; only ever embedded (see feed-page.html), hidden below the `lg` breakpoint like any
 * other sidebar (the navbar already covers navigation on mobile).
 *
 * Infinite scroll here is scoped to the widget's own scrollable box (see suggested-friends.html
 * — a fixed max-height + overflow-y-auto), not the page: the sentinel's IntersectionObserver
 * is given `root: <that box>` explicitly, since the default `root: null` (viewport) considers
 * the sentinel "intersecting" as soon as its ancestor box is on screen, ignoring the box's own
 * overflow clipping — the exact gotcha that would make this fire immediately/never fire again.
 */
@Component({
  selector: 'app-suggested-friends',
  imports: [
    FollowButton,
    NgOptimizedImage,
    MatButtonModule,
    MatProgressSpinnerModule,
    RouterLink,
    TranslatePipe,
  ],
  templateUrl: './suggested-friends.html',
  styleUrl: './suggested-friends.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SuggestedFriends {
  protected readonly suggestionsService = inject(SuggestionsService);
  protected readonly followService = inject(FollowService);
  protected readonly isolateBidi = isolateBidi;
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly scrollContainer = viewChild<ElementRef<HTMLElement>>('scrollContainer');
  // Only rendered (see suggested-friends.html) while there's another page to fetch, so this
  // signal naturally becomes `undefined` again once the list is exhausted.
  private readonly scrollSentinel = viewChild<ElementRef<HTMLElement>>('scrollSentinel');

  constructor() {
    this.suggestionsService.start();

    effect((onCleanup) => {
      const root = this.scrollContainer()?.nativeElement;
      const sentinel = this.scrollSentinel()?.nativeElement;
      if (!this.isBrowser || !root || !sentinel) {
        return;
      }

      const observer = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting) {
            this.suggestionsService.loadMore();
          }
        },
        { root },
      );
      observer.observe(sentinel);
      onCleanup(() => observer.disconnect());
    });
  }
}
