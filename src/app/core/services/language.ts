import { DOCUMENT, PLATFORM_ID, Service, computed, effect, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { TranslateService } from '@ngx-translate/core';

export type Language = 'en' | 'ar';
export type Direction = 'ltr' | 'rtl';

export const LANGUAGE_STORAGE_KEY = 'tawasol-lang';

/**
 * Shared with the anti-flicker script in index.html and with `provideTranslateService`'s
 * initial `lang`, so all three agree on the same default before Angular (or even the
 * translation loader) has run. Absent on the server (no `localStorage`), where English/LTR
 * is always used — see AGENTS.md > Internationalization for the SSR tradeoff this implies.
 */
export function resolveInitialLanguage(): Language {
  if (typeof localStorage === 'undefined') {
    return 'en';
  }
  return localStorage.getItem(LANGUAGE_STORAGE_KEY) === 'ar' ? 'ar' : 'en';
}

@Service()
export class LanguageService {
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly translate = inject(TranslateService);

  readonly lang = computed<Language>(() => (this.translate.currentLang() === 'ar' ? 'ar' : 'en'));
  readonly dir = computed<Direction>(() => (this.lang() === 'ar' ? 'rtl' : 'ltr'));

  constructor() {
    // One place that keeps <html lang>/<html dir> in sync with whatever language is
    // actually active — covers the initial load and every later toggle alike.
    effect(() => {
      this.document.documentElement.lang = this.lang();
      this.document.documentElement.dir = this.dir();
    });
  }

  toggle(): void {
    this.setLanguage(this.lang() === 'ar' ? 'en' : 'ar');
  }

  setLanguage(lang: Language): void {
    this.translate.use(lang).subscribe(() => this.persist(lang));
  }

  private persist(lang: Language): void {
    if (this.isBrowser) {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    }
  }
}
