import { defineConfig, devices } from '@playwright/test';

// End-to-end + axe suite (e2e/). Runs against the production build served by the SSR server
// (`dist/tawasol/server/server.mjs`), the same artifact Vercel serves. Every real route is
// RenderMode.Client, so the server only hands out the CSR shell and the specs exercise the real
// production bundle. The Route Posts API is never contacted: e2e/support/mock-api.ts fulfils every
// API call from fixtures and aborts every other off-origin request.
//
// CI builds once in its own step; locally, the web server step builds first.
const PORT = 4310;
const isCI = !!process.env['CI'];

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: isCI ? 2 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    // Fixed, so timestamps and Intl formatting render the same on every machine.
    locale: 'en-US',
    timezoneId: 'UTC',
    // Material/CDK animations and the theme view transition finish instantly, so dialogs, menus
    // and colors are already in their final state when a spec (or axe) looks at them.
    contextOptions: { reducedMotion: 'reduce' },
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: isCI ? 'npm run serve:ssr:tawasol' : 'npm run build && npm run serve:ssr:tawasol',
    url: `http://localhost:${PORT}/auth/login`,
    env: { PORT: String(PORT) },
    reuseExistingServer: !isCI,
    timeout: 180_000,
  },
});
