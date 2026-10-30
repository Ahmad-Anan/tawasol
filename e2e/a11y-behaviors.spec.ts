// Behaviors from the accessibility baseline (#1): skip link, <main> focus after navigation, and
// per-route document titles.
import { LAYLA } from './fixtures/users';
import { expect, test } from './support/test';

test.describe('skip link', () => {
  test.use({ signedInAs: null });

  test('is the first Tab stop and Enter moves focus to #main', async ({ page }) => {
    await page.goto('/auth/login');
    await expect(page.getByRole('tab', { name: 'Log in' })).toBeVisible();

    await page.keyboard.press('Tab');
    const skipLink = page.getByRole('link', { name: 'Skip to main content' });
    await expect(skipLink).toBeFocused();
    await expect(skipLink).toBeInViewport();

    await page.keyboard.press('Enter');
    await expect(page.locator('main#main')).toBeFocused();
    await expect(page).toHaveURL('/auth/login');
  });
});

test('after an in-app navigation focus lands on the new page heading', async ({ page }) => {
  await page.goto('/feed');
  await expect(page.getByRole('article').first()).toBeVisible();
  // Nothing is moved on the initial load.
  await expect(page.locator('body')).toBeFocused();

  await page.getByRole('button', { name: 'Notifications' }).click();
  await expect(page).toHaveURL('/notifications');
  await expect(page.getByRole('heading', { level: 1, name: 'Notifications' })).toBeFocused();
});

test('document.title follows the route', async ({ page }) => {
  const routes: [string, string][] = [
    ['/feed', 'Feed · Tawasol'],
    ['/bookmarks', 'Bookmarks · Tawasol'],
    ['/notifications', 'Notifications · Tawasol'],
    ['/change-password', 'Change password · Tawasol'],
    [`/profile/${LAYLA._id}`, 'Profile · Tawasol'],
    ['/posts/6b2000000000000000000001', 'Post · Tawasol'],
    ['/nope', 'Page not found · Tawasol'],
  ];
  for (const [path, title] of routes) {
    await page.goto(path);
    await expect(page).toHaveTitle(title);
  }
});

test.describe('signed out titles', () => {
  test.use({ signedInAs: null });

  test('login and register have their own titles', async ({ page }) => {
    await page.goto('/auth/login');
    await expect(page).toHaveTitle('Log in · Tawasol');
    await page.getByRole('tab', { name: 'Create account' }).click();
    await expect(page).toHaveURL('/auth/register');
    await expect(page).toHaveTitle('Create account · Tawasol');
  });
});
