import { Location, ViewportScroller } from '@angular/common';
import { provideLocationMocks } from '@angular/common/testing';
import { ApplicationRef, ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, RouterOutlet, Routes, provideRouter, withInMemoryScrolling } from '@angular/router';
import type { MockInstance } from 'vitest';
import { RouteScroll } from './route-scroll';

@Component({
  selector: 'app-page',
  template: '<p>Page</p>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class Page {}

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet],
  template: '<router-outlet />',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class Shell {}

const routes: Routes = [
  { path: 'feed', component: Page },
  { path: 'bookmarks', component: Page },
];

describe('RouteScroll', () => {
  let appRef: ApplicationRef;
  let router: Router;
  let scrollToPosition: MockInstance<ViewportScroller['scrollToPosition']>;
  let scrollToAnchor: MockInstance<ViewportScroller['scrollToAnchor']>;
  let position: [number, number];

  beforeEach(() => {
    TestBed.configureTestingModule({
      // Same router setup as app.config.ts; mocked Location so Back can be simulated.
      providers: [provideRouter(routes, withInMemoryScrolling()), provideLocationMocks()],
    });
    const viewportScroller = TestBed.inject(ViewportScroller);
    position = [0, 0];
    vi.spyOn(viewportScroller, 'getScrollPosition').mockImplementation(() => position);
    scrollToPosition = vi.spyOn(viewportScroller, 'scrollToPosition').mockImplementation(() => {});
    scrollToAnchor = vi.spyOn(viewportScroller, 'scrollToAnchor').mockImplementation(() => {});
    // Created before the first navigation, as the app initializer in app.config.ts does.
    TestBed.inject(RouteScroll);
    router = TestBed.inject(Router);
    // Bootstrapped like the real app (not TestBed.createComponent): the router only starts its
    // in-memory scroller from its bootstrap listener.
    document.body.appendChild(document.createElement('app-shell'));
    appRef = TestBed.inject(ApplicationRef);
    appRef.bootstrap(Shell);
  });

  afterEach(() => document.querySelector('app-shell')?.remove());

  /** The router emits Scroll a macrotask after NavigationEnd; RouteScroll then waits a render. */
  async function settle(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 20));
    await appRef.whenStable();
  }

  async function navigate(url: string): Promise<void> {
    await router.navigateByUrl(url);
    await settle();
  }

  it('scrolls a new page to the top', async () => {
    await navigate('/feed');
    scrollToPosition.mockClear();

    await navigate('/bookmarks');

    expect(scrollToPosition).toHaveBeenCalledExactlyOnceWith([0, 0], { behavior: 'instant' });
  });

  it('does not scroll when only the query string changes', async () => {
    await navigate('/feed');
    scrollToPosition.mockClear();

    await navigate('/feed?ref=notification');
    await navigate('/feed?ref=other');

    expect(scrollToPosition).not.toHaveBeenCalled();
    expect(scrollToAnchor).not.toHaveBeenCalled();
  });

  it('scrolls to the anchor when the URL has a fragment', async () => {
    await navigate('/feed');

    await navigate('/feed#comments');

    expect(scrollToAnchor).toHaveBeenCalledExactlyOnceWith('comments', { behavior: 'instant' });
  });

  it('restores the position a page had when the visitor goes Back to it', async () => {
    await navigate('/feed');
    position = [0, 1234]; // where the visitor scrolled the feed to
    await navigate('/bookmarks');
    scrollToPosition.mockClear();

    TestBed.inject(Location).back();
    await settle();

    expect(router.url).toBe('/feed');
    expect(scrollToPosition).toHaveBeenCalledExactlyOnceWith([0, 1234], { behavior: 'instant' });
  });

  it('leaves a navigation that asks for manual scrolling alone', async () => {
    await navigate('/feed');
    scrollToPosition.mockClear();

    await router.navigateByUrl('/bookmarks', { scroll: 'manual' });
    await settle();

    expect(scrollToPosition).not.toHaveBeenCalled();
  });
});
