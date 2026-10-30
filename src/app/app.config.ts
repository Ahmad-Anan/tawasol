import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { TitleStrategy, provideRouter, withInMemoryScrolling } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideTranslateCompiler, provideTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';

import { routes } from './app.routes';
import { resolveInitialLanguage } from './core/services/language';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { PluralCompiler } from './core/i18n/plural-compiler';
import { PageTitleStrategy } from './core/a11y/page-title-strategy';
import { RouteFocus } from './core/a11y/route-focus';
import { RouteScroll } from './core/navigation/route-scroll';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    // Records each page's scroll position and emits the router's Scroll events; its own scrolling
    // stays off ('disabled', the default) and RouteScroll (core/navigation) acts on the events.
    provideRouter(routes, withInMemoryScrolling()),
    { provide: TitleStrategy, useExisting: PageTitleStrategy },
    // Created before the initial navigation starts, so RouteFocus can tell that first
    // NavigationEnd (the page load: leave focus alone) apart from later in-app navigations.
    provideAppInitializer(() => {
      inject(RouteFocus);
      inject(RouteScroll);
    }),
    // No provideClientHydration(): every route is RenderMode.Client (app.routes.server.ts), so the
    // server only ever sends the CSR shell and there is nothing to hydrate. Leaving it out keeps
    // ~30 kB raw / ~11 kB gzip of hydration code out of the initial bundle. Add it back if a route
    // is ever server-rendered or prerendered.
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
    provideTranslateService({
      lang: resolveInitialLanguage(),
      fallbackLang: 'en',
      // Plural-category objects in the JSON ({ "one": ..., "other": ... }) — see PluralCompiler.
      compiler: provideTranslateCompiler(PluralCompiler),
      loader: provideTranslateHttpLoader({
        // One resource entry per feature, deep-merged together — add a new entry (and a
        // matching public/i18n/<feature>/ folder) whenever a new feature needs translations.
        resources: [
          { prefix: '/i18n/navbar/', suffix: '.json' },
          { prefix: '/i18n/auth/', suffix: '.json' },
          { prefix: '/i18n/shared/', suffix: '.json' },
          { prefix: '/i18n/feed/', suffix: '.json' },
          { prefix: '/i18n/profile/', suffix: '.json' },
          { prefix: '/i18n/bookmarks/', suffix: '.json' },
          { prefix: '/i18n/comments/', suffix: '.json' },
          { prefix: '/i18n/notifications/', suffix: '.json' },
          { prefix: '/i18n/suggestions/', suffix: '.json' },
          { prefix: '/i18n/change-password/', suffix: '.json' },
          { prefix: '/i18n/post-detail/', suffix: '.json' },
          { prefix: '/i18n/not-found/', suffix: '.json' },
        ],
      }),
    }),
  ]
};
