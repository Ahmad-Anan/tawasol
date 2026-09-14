import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';

import { routes } from './app.routes';
import { provideClientHydration } from '@angular/platform-browser';
import { resolveInitialLanguage } from './core/services/language';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideClientHydration(),
    provideHttpClient(withFetch()),
    provideTranslateService({
      lang: resolveInitialLanguage(),
      fallbackLang: 'en',
      loader: provideTranslateHttpLoader({
        // One resource entry per feature, deep-merged together — add a new entry (and a
        // matching public/i18n/<feature>/ folder) whenever a new feature needs translations.
        resources: [
          { prefix: '/i18n/navbar/', suffix: '.json' },
          { prefix: '/i18n/auth/', suffix: '.json' },
        ],
      }),
    }),
  ]
};
