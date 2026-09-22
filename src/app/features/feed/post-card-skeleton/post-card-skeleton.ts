import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Static placeholder shaped like `PostCard`, shown while a post list is loading (feed, profile,
 * bookmarks) instead of a bare spinner. `aria-hidden` on the root — this has no real content for
 * assistive tech to read; the usage site wraps a group of these in a single `role="status"`
 * region instead (see feed-page.html), so a screen reader announces "loading" once, not once per
 * fake card.
 */
@Component({
  selector: 'app-post-card-skeleton',
  templateUrl: './post-card-skeleton.html',
  styleUrl: './post-card-skeleton.css',
  host: { 'aria-hidden': 'true' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PostCardSkeleton {}
