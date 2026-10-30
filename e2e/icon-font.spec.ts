// The signed-out pages draw their few icons (theme toggle, password checklist) as inline SVG, so
// a first-time visitor never downloads the 125 kB Material Icons font. Signed-in pages still use
// it, which this also checks so the guard can't pass because the font stopped loading anywhere.
import type { Page } from '@playwright/test';
import { MATERIAL_ICONS_PATH } from './fixtures/fonts';
import { LAYLA } from './fixtures/users';
import { expect, test } from './support/test';

function watchIconFont(page: Page): () => boolean {
  let requested = false;
  page.on('request', (request) => {
    if (request.url().startsWith(`https://fonts.gstatic.com${MATERIAL_ICONS_PATH}`)) {
      requested = true;
    }
  });
  return () => requested;
}

test.describe('signed out', () => {
  test.use({ signedInAs: null });

  test('login and register (with the password checklist showing) do not load the icon font', async ({
    page,
  }) => {
    const requested = watchIconFont(page);

    await page.goto('/auth/login');
    await expect(page.getByRole('button', { name: 'Switch to dark mode' })).toBeVisible();
    await page.getByRole('tab', { name: 'Create account' }).click();
    await page.getByLabel('Password', { exact: true }).fill('Abc1ب');
    await expect(page.getByTestId('keyboard-notice')).toBeVisible();
    await page.evaluate(() => document.fonts.ready);

    expect(requested()).toBe(false);
  });
});

test.describe('signed in', () => {
  test.use({ signedInAs: LAYLA });

  test('the feed still uses the icon font for its icons', async ({ page }) => {
    const requested = watchIconFont(page);
    await page.goto('/feed');
    await expect(page.getByRole('article').first()).toBeVisible();
    await page.evaluate(() => document.fonts.ready);

    expect(requested()).toBe(true);
  });
});
