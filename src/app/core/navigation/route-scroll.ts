import { ViewportScroller, isPlatformBrowser } from '@angular/common';
import { Injector, PLATFORM_ID, Service, afterNextRender, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, Scroll } from '@angular/router';

/**
 * Where the window scrolls after an in-app navigation:
 * - Back/Forward: back to where the visitor was on that page;
 * - a URL with a fragment: to that anchor;
 * - a different page: to the top;
 * - the same page with only a new query string: nowhere (the visitor stays put).
 *
 * The router's in-memory scroller (`withInMemoryScrolling()` in app.config.ts) records each
 * page's position and emits a `Scroll` event after every navigation, carrying the saved position
 * on Back/Forward. Its own scrolling is left off ('disabled') because its 'enabled' mode also
 * jumps to the top on a query-param-only navigation, and Angular 22 can only turn that off per
 * navigation (`scroll: 'manual'`), not for the whole app. This service acts on those events.
 *
 * It scrolls after the next render, so a page whose content is already in memory (the feed's
 * posts live in PostsService, which outlives FeedPage) is laid out at full height when the saved
 * position is restored. RouteFocus (core/a11y) moves focus with `preventScroll`, so it never
 * fights this. Instantiated from an app initializer (app.config.ts), like RouteFocus.
 */
@Service()
export class RouteScroll {
  private readonly injector = inject(Injector);
  private readonly viewportScroller = inject(ViewportScroller);

  /** Path (no query string or fragment) of the last completed navigation; null before the first. */
  private previousPath: string | null = null;
  /** Whether the last completed navigation reached a different page than the one before it. */
  private changedPage = false;

  constructor() {
    if (!isPlatformBrowser(inject(PLATFORM_ID))) {
      return;
    }
    // The router restores positions itself; the browser's own restoration would race with it.
    this.viewportScroller.setHistoryScrollRestoration('manual');

    const router = inject(Router);
    router.events.pipe(takeUntilDestroyed()).subscribe((event) => {
      if (event instanceof NavigationEnd) {
        const path = event.urlAfterRedirects.split(/[?#]/)[0];
        this.changedPage = this.previousPath !== path;
        this.previousPath = path;
      } else if (event instanceof Scroll && event.scrollBehavior !== 'manual') {
        this.onScroll(event);
      }
    });
  }

  private onScroll(event: Scroll): void {
    // A re-navigation to the current URL (NavigationSkipped), e.g. clicking the link of the page
    // you're on, goes to the top like a page change does.
    const changedPage = event.routerEvent instanceof NavigationEnd ? this.changedPage : true;
    const instant: ScrollOptions = { behavior: 'instant' };
    afterNextRender(
      {
        write: () => {
          if (event.position) {
            this.viewportScroller.scrollToPosition(event.position, instant);
          } else if (event.anchor) {
            this.viewportScroller.scrollToAnchor(event.anchor, instant);
          } else if (changedPage) {
            this.viewportScroller.scrollToPosition([0, 0], instant);
          }
        },
      },
      { injector: this.injector },
    );
  }
}
