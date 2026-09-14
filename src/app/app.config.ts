import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';

import { routes } from './app.routes';
import { provideClientHydration } from '@angular/platform-browser';
import { resolveInitialLanguage } from './core/services/language';
import { authInterceptor } from './core/interceptors/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes),
    provideClientHydration(),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
    provideTranslateService({
      lang: resolveInitialLanguage(),
      fallbackLang: 'en',
      loader: provideTranslateHttpLoader({
        // One resource entry per feature, deep-merged together — add a new entry (and a
        // matching public/i18n/<feature>/ folder) whenever a new feature needs translations.
        resources: [
          { prefix: '/i18n/navbar/', suffix: '.json' },
          { prefix: '/i18n/auth/', suffix: '.json' },
          { prefix: '/i18n/shared/', suffix: '.json' },
        ],
      }),
    }),
  ]
};
