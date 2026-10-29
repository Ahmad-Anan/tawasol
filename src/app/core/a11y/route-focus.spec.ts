import { LiveAnnouncer } from '@angular/cdk/a11y';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, RouterOutlet, Routes, TitleStrategy, provideRouter } from '@angular/router';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';
import type { MockInstance } from 'vitest';

import navbarEn from '../../../../public/i18n/navbar/en.json';
import sharedEn from '../../../../public/i18n/shared/en.json';
import { PageTitleStrategy } from './page-title-strategy';
import { RouteFocus } from './route-focus';

@Component({
  selector: 'app-page-with-heading',
  template: '<h1>Feed</h1>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class PageWithHeading {}

@Component({
  selector: 'app-page-without-heading',
  template: '<p>No heading here</p>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class PageWithoutHeading {}

@Component({
  imports: [RouterOutlet],
  template: `
    <button id="outside" type="button">Outside main</button>
    <main id="main" tabindex="-1"><router-outlet /></main>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class Shell {}

const routes: Routes = [
  { path: 'feed', component: PageWithHeading, title: 'shared.pageTitles.feed' },
  { path: 'bookmarks', component: PageWithoutHeading, title: 'shared.pageTitles.bookmarks' },
];

describe('RouteFocus', () => {
  let fixture: ComponentFixture<Shell>;
  let router: Router;
  let announce: MockInstance<LiveAnnouncer['announce']>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        { provide: TitleStrategy, useExisting: PageTitleStrategy },
        provideTranslateService({ lang: 'en', fallbackLang: 'en' }),
      ],
    });
    TestBed.inject(TranslateService).setTranslation('en', { ...sharedEn, ...navbarEn });
    // Created before the first navigation, as the app initializer in app.config.ts does.
    TestBed.inject(RouteFocus);
    announce = vi.spyOn(TestBed.inject(LiveAnnouncer), 'announce').mockResolvedValue();
    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(Shell);
  });

  async function go(url: string): Promise<void> {
    await router.navigateByUrl(url);
    await fixture.whenStable();
  }

  function element(selector: string): HTMLElement {
    return (fixture.nativeElement as HTMLElement).querySelector(selector) as HTMLElement;
  }

  function focusOutsideMain(): void {
    element('#outside').focus();
    expect(document.activeElement).toBe(element('#outside'));
  }

  it('leaves focus alone and announces nothing on the initial load', async () => {
    focusOutsideMain();
    await go('/feed');

    expect(document.activeElement).toBe(element('#outside'));
    expect(announce).not.toHaveBeenCalled();
  });

  it('focuses <main> and announces the page title after navigating to a page without an h1', async () => {
    await go('/feed');
    focusOutsideMain();

    await go('/bookmarks');

    expect(document.activeElement).toBe(element('main'));
    expect(announce).toHaveBeenCalledExactlyOnceWith('Bookmarks', 'polite');
  });

  it("focuses the page's h1 (made programmatically focusable) when it has one", async () => {
    await go('/bookmarks');
    await go('/feed');

    const heading = element('main h1');
    expect(document.activeElement).toBe(heading);
    expect(heading.getAttribute('tabindex')).toBe('-1');
    expect(announce).toHaveBeenCalledExactlyOnceWith('Feed', 'polite');
  });

  it('does nothing when only the query params or fragment change', async () => {
    await go('/feed');
    await go('/bookmarks');
    announce.mockClear();
    focusOutsideMain();

    await go('/bookmarks?filter=me');
    await go('/bookmarks?filter=me#latest');

    expect(document.activeElement).toBe(element('#outside'));
    expect(announce).not.toHaveBeenCalled();
  });
});
