import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { Route, Routes, TitleStrategy, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';

import navbarAr from '../../../../public/i18n/navbar/ar.json';
import navbarEn from '../../../../public/i18n/navbar/en.json';
import sharedAr from '../../../../public/i18n/shared/ar.json';
import sharedEn from '../../../../public/i18n/shared/en.json';
import { routes as appRoutes } from '../../app.routes';
import { AUTH_ROUTES } from '../../features/auth/auth.routes';
import { BOOKMARKS_ROUTES } from '../../features/bookmarks/bookmarks.routes';
import { CHANGE_PASSWORD_ROUTES } from '../../features/change-password/change-password.routes';
import { FEED_ROUTES } from '../../features/feed/feed.routes';
import { NOTIFICATIONS_ROUTES } from '../../features/notifications/notifications.routes';
import { POST_DETAIL_ROUTES } from '../../features/post-detail/post-detail.routes';
import { PROFILE_ROUTES } from '../../features/profile/profile.routes';
import { PageTitleStrategy } from './page-title-strategy';

@Component({ template: '', changeDetection: ChangeDetectionStrategy.OnPush })
class Blank {}

const routes: Routes = [
  { path: 'feed', component: Blank, title: 'shared.pageTitles.feed' },
  { path: 'bookmarks', component: Blank, title: 'shared.pageTitles.bookmarks' },
  { path: 'untitled', component: Blank },
];

describe('PageTitleStrategy', () => {
  let translate: TranslateService;
  let title: Title;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        { provide: TitleStrategy, useExisting: PageTitleStrategy },
        provideTranslateService({ lang: 'en', fallbackLang: 'en' }),
      ],
    });
    translate = TestBed.inject(TranslateService);
    translate.setTranslation('en', { ...sharedEn, ...navbarEn });
    translate.setTranslation('ar', { ...sharedAr, ...navbarAr });
    title = TestBed.inject(Title);
  });

  async function useLanguage(lang: 'en' | 'ar'): Promise<void> {
    await firstValueFrom(translate.use(lang));
    TestBed.tick();
  }

  it('sets "<Page> · Tawasol" in English', async () => {
    await RouterTestingHarness.create('/feed');
    TestBed.tick();
    expect(title.getTitle()).toBe('Feed · Tawasol');
  });

  it('sets the Arabic page title and brand in Arabic', async () => {
    await useLanguage('ar');
    await RouterTestingHarness.create('/bookmarks');
    TestBed.tick();
    expect(title.getTitle()).toBe('المحفوظات · تواصل');
  });

  it('re-translates the current title when the language changes, without navigating', async () => {
    await RouterTestingHarness.create('/bookmarks');
    TestBed.tick();
    expect(title.getTitle()).toBe('Bookmarks · Tawasol');

    await useLanguage('ar');
    expect(title.getTitle()).toBe('المحفوظات · تواصل');

    await useLanguage('en');
    expect(title.getTitle()).toBe('Bookmarks · Tawasol');
  });

  it('updates on each navigation and falls back to the brand alone without a route title', async () => {
    const harness = await RouterTestingHarness.create('/feed');
    TestBed.tick();
    expect(title.getTitle()).toBe('Feed · Tawasol');

    await harness.navigateByUrl('/untitled');
    TestBed.tick();
    expect(title.getTitle()).toBe('Tawasol');
  });
});

describe('route titles', () => {
  const allRoutes: Route[] = [
    ...appRoutes,
    ...AUTH_ROUTES,
    ...FEED_ROUTES,
    ...PROFILE_ROUTES,
    ...BOOKMARKS_ROUTES,
    ...NOTIFICATIONS_ROUTES,
    ...CHANGE_PASSWORD_ROUTES,
    ...POST_DETAIL_ROUTES,
  ];
  const pageRoutes = allRoutes.filter((route) => !route.redirectTo && !route.loadChildren);

  function lookup(translations: object, key: string): unknown {
    return key
      .split('.')
      .reduce<unknown>(
        (node, part) => (node as Record<string, unknown> | undefined)?.[part],
        translations,
      );
  }

  it('gives every page route a title key that exists in both English and Arabic', () => {
    expect(pageRoutes.length).toBe(9);
    for (const route of pageRoutes) {
      expect(typeof route.title, `route "${route.path}"`).toBe('string');
      const key = route.title as string;
      expect(typeof lookup(sharedEn, key), `${key} (en)`).toBe('string');
      expect(typeof lookup(sharedAr, key), `${key} (ar)`).toBe('string');
    }
  });
});
