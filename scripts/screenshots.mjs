// Automated portfolio screenshots for Tawasol.
//
// Usage:
//   npm run screenshots
//   npm run screenshots -- desktop-feed mobile-login   (only shots whose file name starts with these prefixes)
//
// Env vars:
//   BASE_URL   default https://tawasol-two.vercel.app
//
// READ-ONLY: this script never posts, likes, comments, edits or deletes anything. It signs in
// through the UI's "Try the demo" button (public demo account, no credentials in here), and every
// context aborts any non-GET request other than that one sign-in call — so even an accidental click
// can't change data on the live API.
//
// Theme & language are set exactly the way the app persists them (see
// src/app/core/services/theme.ts and src/app/core/services/language.ts):
//   localStorage['tawasol-theme'] = 'dark' | 'light'  -> ThemeService toggles `tawasol-dark` on <html>
//   localStorage['tawasol-lang']  = 'en' | 'ar'       -> LanguageService sets <html lang/dir>
// Both are written by an init script before every navigation, so the anti-flicker script in
// index.html picks them up on first paint.

import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const BASE_URL = (process.env.BASE_URL || 'https://tawasol-two.vercel.app').replace(/\/+$/, '');
const OUT_DIR = path.resolve('screenshots');
const SETTLE_MS = 1000;

// Mirrors src/environments/environment.ts (demoUserId) — the public demo account's profile.
const DEMO_USER_ID = '6ab61f4f8ebe92c2c0ca67ff';
const SIGNIN_PATH = '/users/signin';

// dpr 2 so desktop shots stay sharp on HiDPI displays and when scaled down in a portfolio.
const DESKTOP = { viewport: { width: 1440, height: 900 }, dpr: 2 };
const MOBILE = { viewport: { width: 390, height: 844 }, dpr: 3, mobile: true };
const MOBILE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

// `path` may be a function of the values discovered after sign-in (e.g. a post with comments).
const SHOTS = [
  { file: 'desktop-feed-me-en-light.png', ...DESKTOP, path: '/feed', meFilter: true, theme: 'light', lang: 'en', auth: true },
  { file: 'desktop-profile-ar-dark.png', ...DESKTOP, path: `/profile/${DEMO_USER_ID}`, theme: 'dark', lang: 'ar', auth: true },
  { file: 'desktop-post-detail-en-dark.png', ...DESKTOP, path: (d) => `/posts/${d.postWithComments}`, theme: 'dark', lang: 'en', auth: true },
  { file: 'mobile-feed-me-ar-light.png', ...MOBILE, path: '/feed', meFilter: true, theme: 'light', lang: 'ar', auth: true },
  { file: 'mobile-login-ar-dark.png', ...MOBILE, path: '/auth/login', theme: 'dark', lang: 'ar', auth: false },
  { file: 'mobile-profile-en-light.png', ...MOBILE, path: `/profile/${DEMO_USER_ID}`, theme: 'light', lang: 'en', auth: true },
];

// Hidden from first paint: scrollbars and the cursor (neither affects layout).
const CHROME_CSS = `
  html, body { scrollbar-width: none !important; }
  ::-webkit-scrollbar { display: none !important; width: 0 !important; height: 0 !important; }
  *, *::before, *::after { cursor: none !important; }
`;

// Injected right before capture: freeze motion and suppress any focus ring that might remain.
const FREEZE_CSS = `
  *, *::before, *::after {
    animation-play-state: paused !important;
    transition: none !important;
    caret-color: transparent !important;
  }
  *:focus, *:focus-visible { outline: none !important; }
  .mat-focus-indicator::before { display: none !important; }
`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function newContext(browser, shot, storageState) {
  const context = await browser.newContext({
    viewport: shot.viewport,
    deviceScaleFactor: shot.dpr,
    isMobile: !!shot.mobile,
    hasTouch: !!shot.mobile,
    userAgent: shot.mobile ? MOBILE_UA : undefined,
    colorScheme: shot.theme,
    locale: shot.lang === 'ar' ? 'ar-EG' : 'en-US',
    storageState,
  });

  // Read-only guard: only GET/HEAD/OPTIONS go out, plus the demo sign-in POST.
  await context.route('**/*', (route) => {
    const req = route.request();
    const method = req.method();
    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return route.continue();
    if (method === 'POST' && new URL(req.url()).pathname.endsWith(SIGNIN_PATH)) return route.continue();
    console.warn(`    (blocked ${method} ${req.url()})`);
    return route.abort('blockedbyclient');
  });

  // Persist theme/language the same way the app does, before any app script runs on every navigation.
  await context.addInitScript(
    ({ theme, lang, css }) => {
      try {
        localStorage.setItem('tawasol-theme', theme);
        localStorage.setItem('tawasol-lang', lang);
      } catch {}
      const inject = () => {
        const style = document.createElement('style');
        style.textContent = css;
        document.head.appendChild(style);
      };
      if (document.head) inject();
      else document.addEventListener('DOMContentLoaded', inject, { once: true });
    },
    { theme: shot.theme, lang: shot.lang, css: CHROME_CSS },
  );

  return context;
}

async function signInWithDemo(browser) {
  // Sign in through the real "Try the demo" button; the app stores the token in localStorage.
  // While here, pick a post with comments from the feed for the post-detail shot.
  const context = await newContext(browser, { ...DESKTOP, theme: 'light', lang: 'en' });
  const page = await context.newPage();
  try {
    await page.goto(`${BASE_URL}/auth/login`, { waitUntil: 'networkidle', timeout: 60_000 });
    // The redirect to /feed is client-side, so 'networkidle' has already fired by then — wait for
    // the feed request itself instead.
    const [, feedResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith(SIGNIN_PATH), { timeout: 30_000 }),
      page.waitForResponse((r) => r.request().method() === 'GET' && new URL(r.url()).pathname.endsWith('/posts/feed'), {
        timeout: 30_000,
      }),
      page.getByTestId('try-demo').click(),
    ]);
    await page.waitForFunction(() => !!localStorage.getItem('tawasol-token'), null, { timeout: 15_000 });
    await page.waitForURL((url) => url.pathname.startsWith('/feed'), { timeout: 15_000 });
    const feedPosts = (await feedResponse.json())?.data?.posts ?? [];

    const post = feedPosts
      .filter((p) => p.commentsCount > 0)
      .sort((a, b) => Math.min(b.commentsCount, 5) - Math.min(a.commentsCount, 5) || !!a.image - !!b.image)[0];

    return { storageState: await context.storageState(), discovered: { postWithComments: post?.id } };
  } finally {
    await context.close();
  }
}

async function waitForNetworkIdle(page, timeout = 20_000) {
  try {
    await page.waitForLoadState('networkidle', { timeout });
  } catch {
    console.warn('    (network did not go fully idle, continuing)');
  }
}

async function waitForNoLoaders(page, timeout = 20_000) {
  try {
    await page.waitForFunction(
      () =>
        ![...document.querySelectorAll('mat-spinner, mat-progress-spinner, mat-progress-bar, [class*="skeleton"]')].some(
          (el) => {
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight;
          },
        ),
      null,
      { timeout, polling: 250 },
    );
  } catch {
    console.warn('    (a loading indicator is still visible)');
  }
}

async function waitForVisibleImages(page, timeout = 20_000) {
  try {
    await page.waitForFunction(
      () => {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        return [...document.images].every((img) => {
          const r = img.getBoundingClientRect();
          const visible = r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 && r.top < vh && r.left < vw;
          return !visible || (img.complete && img.naturalWidth > 0);
        });
      },
      null,
      { timeout, polling: 250 },
    );
    // Make sure decoding is done too, so nothing paints half-way.
    await page.evaluate(() =>
      Promise.all([...document.images].filter((i) => i.complete).map((i) => i.decode().catch(() => {}))),
    );
  } catch {
    console.warn('    (some visible images did not finish loading in time)');
  }
}

async function selectMeFilter(page) {
  // Filter state is in-memory only (PostsService), so pick it through the UI like a visitor would.
  const toggle = page.locator('mat-button-toggle[value="me"] button');
  await toggle.waitFor({ state: 'visible', timeout: 20_000 });
  await Promise.all([
    page.waitForResponse((r) => r.url().includes('/posts/feed') && r.url().includes('only=me'), { timeout: 30_000 }),
    toggle.click(),
  ]);
}

async function clearTransientUi(page, shot) {
  // No hover, focus, tooltip or open menu/overlay may remain in the frame.
  if (!shot.mobile) await page.mouse.move(-10, -10);
  await page.keyboard.press('Escape');
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    document.activeElement?.blur?.();
  });
  try {
    await page.waitForFunction(
      () => ![...document.querySelectorAll('.cdk-overlay-pane, .mat-mdc-tooltip')].some((el) => el.childElementCount || el.textContent?.trim()),
      null,
      { timeout: 5_000 },
    );
  } catch {
    console.warn('    (an overlay/tooltip is still open)');
  }
}

async function capture(browser, shot, auth) {
  const context = await newContext(browser, shot, shot.auth ? auth.storageState : undefined);
  const page = await context.newPage();
  try {
    const target = typeof shot.path === 'function' ? shot.path(auth.discovered) : shot.path;
    if (target.includes('undefined')) throw new Error('no post with comments found in the feed');

    await page.goto(`${BASE_URL}${target}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await waitForNetworkIdle(page);

    const landed = new URL(page.url()).pathname;
    if (shot.auth && landed.startsWith('/auth')) throw new Error('redirected to login — auth did not stick');
    if (!shot.auth && !landed.startsWith('/auth/login')) throw new Error(`expected login page, got ${landed}`);

    if (shot.meFilter) await selectMeFilter(page);

    await waitForNetworkIdle(page, 10_000);
    await page.evaluate(() => document.fonts.ready);
    await waitForNoLoaders(page);
    await waitForVisibleImages(page);
    await page.evaluate(() => document.fonts.ready);

    // Sanity check that the app applied the requested state.
    const state = await page.evaluate(() => ({
      dark: document.documentElement.classList.contains('tawasol-dark'),
      dir: document.documentElement.dir,
      lang: document.documentElement.lang,
    }));
    if (state.dark !== (shot.theme === 'dark') || state.dir !== (shot.lang === 'ar' ? 'rtl' : 'ltr') || state.lang !== shot.lang) {
      console.warn(`    (unexpected state: ${JSON.stringify(state)})`);
    }

    await page.waitForTimeout(SETTLE_MS);
    await clearTransientUi(page, shot);
    await page.addStyleTag({ content: FREEZE_CSS });
    await page.waitForTimeout(150);

    await page.screenshot({
      path: path.join(OUT_DIR, shot.file),
      fullPage: false,
      animations: 'disabled',
      caret: 'hide',
    });
  } finally {
    await context.close();
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const filters = process.argv.slice(2);
const shots = filters.length ? SHOTS.filter((s) => filters.some((f) => s.file.startsWith(f))) : SHOTS;

await mkdir(OUT_DIR, { recursive: true });
console.log(`BASE_URL: ${BASE_URL}`);
console.log(`Output:   ${OUT_DIR}\n`);

const browser = await chromium.launch();
const results = [];
let auth;
let authError;

try {
  if (shots.some((s) => s.auth)) {
    process.stdout.write('Signing in with "Try the demo"… ');
    try {
      auth = await signInWithDemo(browser);
      console.log('ok\n');
    } catch (err) {
      authError = `sign-in failed: ${err.message}`;
      console.log('FAILED\n');
    }
  }

  for (const shot of shots) {
    process.stdout.write(`• ${shot.file} `);
    if (shot.auth && !auth) {
      console.log(`SKIPPED (${authError})`);
      results.push({ file: shot.file, status: 'skipped' });
      continue;
    }
    try {
      await capture(browser, shot, auth);
      console.log('ok');
      results.push({ file: shot.file, status: 'ok' });
    } catch (err) {
      console.log(`FAILED: ${err.message}`);
      results.push({ file: shot.file, status: 'failed' });
    }
  }
} finally {
  await browser.close();
}

const ok = results.filter((r) => r.status === 'ok').length;
console.log(`\n${ok}/${results.length} shots captured.`);
if (results.some((r) => r.status !== 'ok')) process.exitCode = 1;
