import { LiveAnnouncer } from '@angular/cdk/a11y';
import { isPlatformBrowser } from '@angular/common';
import { DOCUMENT, Injector, PLATFORM_ID, Service, afterNextRender, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { PageTitleStrategy } from './page-title-strategy';

/** The `<main>` landmark's id in app.html (also the skip link's `href` target). */
const MAIN_CONTENT_ID = 'main';

/**
 * After every in-app navigation (never the initial page load, where the browser's own focus
 * start is correct), moves keyboard/screen-reader focus to the new page's `<h1>` (or `<main>`
 * when the page has no visible `<h1>` yet) and politely announces the new page title.
 *
 * Navigations that only change the query string or fragment are left alone: same page, so
 * focus stays put. The login/register tab switch is a real route change and gets the full
 * treatment: the router recreates AuthShell for it (two route configs), so the focused tab is
 * destroyed and focus would otherwise drop to <body>.
 *
 * Focus uses `preventScroll`, so where the page scrolls stays RouteScroll's call (core/navigation).
 * Instantiated from an app initializer (app.config.ts) so it sees the very first NavigationEnd.
 */
@Service()
export class RouteFocus {
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  private readonly router = inject(Router);
  private readonly announcer = inject(LiveAnnouncer);
  private readonly titleStrategy = inject(PageTitleStrategy);

  /** Path (no query string or fragment) of the last completed navigation; null before the first. */
  private previousPath: string | null = null;

  constructor() {
    if (!isPlatformBrowser(inject(PLATFORM_ID))) {
      return;
    }

    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe((event) => {
        const path = event.urlAfterRedirects.split(/[?#]/)[0];
        const isNewPage = this.previousPath !== null && this.previousPath !== path;
        this.previousPath = path;
        if (isNewPage) {
          afterNextRender({ write: () => this.focusPage() }, { injector: this.injector });
        }
      });
  }

  private focusPage(): void {
    const main = this.document.getElementById(MAIN_CONTENT_ID);
    if (!main) {
      return;
    }

    const heading = main.querySelector('h1');
    // The auth shell's h1 sits in a panel that's display:none below the lg breakpoint.
    const headingIsVisible = heading !== null && (heading.checkVisibility?.() ?? true);
    const target = headingIsVisible ? heading : main;
    if (!target.hasAttribute('tabindex')) {
      target.setAttribute('tabindex', '-1');
    }
    target.focus({ preventScroll: true });

    const pageTitle = this.titleStrategy.pageTitle();
    if (pageTitle) {
      void this.announcer.announce(pageTitle, 'polite');
    }
  }
}
