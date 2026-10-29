import { test as base, expect } from '@playwright/test';
import { NOW } from '../fixtures/content';
import { LAYLA, type FixtureUser } from '../fixtures/users';
import { MockApi, tokenFor } from './mock-api';

export type Language = 'en' | 'ar';
export type Theme = 'light' | 'dark';

interface Options {
  lang: Language;
  theme: Theme;
  /** Seeds a stored session for this user before the app boots; `null` = signed out. */
  signedInAs: FixtureUser | null;
}

/**
 * Every spec imports `test`/`expect` from here, never from '@playwright/test' directly, so each
 * test gets:
 * - `api`: the mocked Route Posts API (see MockApi) — nothing ever reaches the network;
 * - the browser clock frozen at NOW, so relative/short timestamps never drift;
 * - language, theme and session seeded exactly the way the app persists them (localStorage keys
 *   `tawasol-lang`, `tawasol-theme`, `tawasol-token` — see core/services/language.ts, theme.ts and
 *   auth.service.ts). Seeded once per tab, so a test that changes them in the UI and reloads keeps
 *   its own choice;
 * - a final check that the app made no API call the mock doesn't implement.
 */
export const test = base.extend<Options & { api: MockApi }>({
  lang: ['en', { option: true }],
  theme: ['light', { option: true }],
  signedInAs: [LAYLA, { option: true }],

  // `auto`: Playwright only sets up a fixture a test asks for, and a test that only takes `page`
  // must still be mocked and seeded. Without it such a test would reach the real API.
  api: [
    async ({ page, baseURL, lang, theme, signedInAs }, use) => {
      await page.clock.setFixedTime(new Date(NOW));
      await page.addInitScript(
        ({ lang, theme, token }) => {
          if (sessionStorage.getItem('e2e-seeded')) return;
          sessionStorage.setItem('e2e-seeded', '1');
          localStorage.setItem('tawasol-lang', lang);
          localStorage.setItem('tawasol-theme', theme);
          if (token) localStorage.setItem('tawasol-token', token);
        },
        { lang, theme, token: signedInAs ? tokenFor(signedInAs) : null },
      );
      const api = new MockApi(baseURL!, signedInAs);
      await api.install(page);
      await use(api);
      expect(api.unhandled, 'API calls the mock does not implement').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
