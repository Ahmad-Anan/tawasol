import { LAYLA, LAYLA_PASSWORD } from './fixtures/users';
import { expect, test } from './support/test';

test('switching to Arabic sets lang/dir, the Arabic title, and survives a reload', async ({
  page,
}) => {
  await page.goto('/feed');
  await expect(page).toHaveTitle('Feed · Tawasol');

  await page.getByRole('button', { name: 'Switch to Arabic' }).click();

  const html = page.locator('html');
  await expect(html).toHaveAttribute('lang', 'ar');
  await expect(html).toHaveAttribute('dir', 'rtl');
  await expect(page).toHaveTitle('الفيد · تواصل');
  await expect(page.getByRole('radio', { name: 'الكل' })).toBeChecked();

  await page.reload();
  await expect(html).toHaveAttribute('dir', 'rtl');
  await expect(page).toHaveTitle('الفيد · تواصل');
  await page.getByRole('button', { name: 'التبديل إلى الإنجليزية' }).click();
  await expect(html).toHaveAttribute('lang', 'en');
  await expect(html).toHaveAttribute('dir', 'ltr');
});

test('the dark-mode toggle switches the theme and persists it', async ({ page }) => {
  await page.goto('/feed');
  const html = page.locator('html');
  await expect(html).not.toHaveClass(/tawasol-dark/);

  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await expect(html).toHaveClass(/tawasol-dark/);
  await expect(page.getByRole('button', { name: 'Switch to light mode' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('tawasol-theme'))).toBe('dark');

  await page.reload();
  await expect(html).toHaveClass(/tawasol-dark/);
});

test.describe('in Arabic', () => {
  test.use({ lang: 'ar' });

  test.describe('signed out', () => {
    test.use({ signedInAs: null });

    test('logs in from the Arabic login page', async ({ page }) => {
      await page.goto('/auth/login');
      await expect(page).toHaveTitle('تسجيل الدخول · تواصل');
      await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');

      await page.getByLabel('البريد الإلكتروني أو اسم المستخدم').fill(LAYLA.username);
      await page.getByLabel('كلمة المرور').fill(LAYLA_PASSWORD);
      await page.getByRole('button', { name: 'تسجيل الدخول', exact: true }).click();

      await expect(page).toHaveURL('/feed');
      await expect(page).toHaveTitle('الفيد · تواصل');
      await expect(page.getByRole('radio', { name: 'الكل' })).toBeChecked();
    });
  });

  test('shows Arabic notification messages', async ({ page }) => {
    await page.goto('/notifications');
    await expect(page).toHaveTitle('الإشعارات · تواصل');
    await expect(page.getByRole('heading', { level: 1, name: 'الإشعارات' })).toBeVisible();
    await expect(page.getByRole('link', { name: /أعجب بمنشورك/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /بدأ متابعتك/ })).toBeVisible();
  });
});
