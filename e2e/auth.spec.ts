import { DEMO, DEMO_CREDENTIALS, LAYLA, LAYLA_PASSWORD } from './fixtures/users';
import { expect, test } from './support/test';

test.describe('signed out', () => {
  test.use({ signedInAs: null });

  test('logs in and lands on the feed', async ({ page, api }) => {
    await page.goto('/auth/login');
    await page.getByLabel('Email or username').fill(LAYLA.username);
    await page.getByLabel('Password').fill(LAYLA_PASSWORD);
    await page.getByRole('button', { name: 'Log in', exact: true }).click();

    await expect(page).toHaveURL('/feed');
    await expect(page.getByRole('article').first()).toBeVisible();
    expect(api.callsTo('POST', '/users/signin')[0].body).toEqual({
      login: LAYLA.username,
      password: LAYLA_PASSWORD,
    });
    await expect(page.getByRole('button', { name: 'Account menu' })).toBeVisible();
  });

  test('shows the API error in an alert for wrong credentials', async ({ page }) => {
    await page.goto('/auth/login');
    await page.getByLabel('Email or username').fill(LAYLA.username);
    await page.getByLabel('Password').fill('not-the-password');
    await page.getByRole('button', { name: 'Log in', exact: true }).click();

    await expect(page.getByRole('alert')).toHaveText('incorrect email or password');
    await expect(page).toHaveURL('/auth/login');
  });

  // A field's error shows once that field has been touched: here by leaving required fields empty,
  // then submitting. An empty submit on its own reveals every error too (it marks all fields
  // touched); that, with focus, aria-invalid and the announcement, is in form-errors.spec.ts.
  test('shows required-field errors on the register form and never calls signup', async ({
    page,
    api,
  }) => {
    await page.goto('/auth/register');
    for (const label of ['Full name', 'Email', 'Confirm password']) {
      await page.getByLabel(label, { exact: true }).focus();
      await page.getByLabel(label, { exact: true }).blur();
    }
    await page.getByRole('button', { name: 'Create account', exact: true }).click();

    await expect(page.getByText('Enter your full name')).toBeVisible();
    await expect(page.getByText('Enter your email')).toBeVisible();
    await expect(page.getByText('Re-enter your password')).toBeVisible();
    await expect(page).toHaveURL('/auth/register');
    expect(api.callsTo('POST', '/users/signup')).toEqual([]);
  });

  test('flags an invalid email and mismatched passwords', async ({ page }) => {
    await page.goto('/auth/register');
    await page.getByLabel('Email', { exact: true }).fill('not-an-email');
    await page.getByLabel('Password', { exact: true }).fill('Aa123456#');
    await page.getByLabel('Confirm password').fill('Aa123456!');
    await page.getByLabel('Confirm password').blur();
    await page.getByLabel('Email', { exact: true }).focus();
    await page.getByLabel('Email', { exact: true }).blur();

    await expect(page.getByText('Invalid email format')).toBeVisible();
    await expect(page.getByText('Passwords do not match')).toBeVisible();
  });

  test('auth guard sends a signed-out visitor to the login page', async ({ page }) => {
    await page.goto('/bookmarks');
    await expect(page).toHaveURL('/auth/login');
  });

  test('"Try the demo" signs in and opens the feed on "All"', async ({ page, api }) => {
    await page.goto('/auth/login');
    const firstFeedRequest = api.waitForCall(page, 'GET', '/posts/feed');
    await page.getByRole('button', { name: 'Try the demo' }).click();

    await expect(page).toHaveURL('/feed');
    expect(api.callsTo('POST', '/users/signin')[0].body).toEqual(DEMO_CREDENTIALS);
    expect(new URL((await firstFeedRequest).url()).searchParams.get('only')).toBe('all');
    await expect(page.getByRole('radio', { name: 'All' })).toBeChecked();
    await expect(page.getByRole('article').first()).toBeVisible();
  });
});

test.describe('signed in', () => {
  test('guest guard sends a signed-in visitor from the login page to the feed', async ({
    page,
  }) => {
    await page.goto('/auth/login');
    await expect(page).toHaveURL('/feed');
  });

  test('signs out from the account menu', async ({ page }) => {
    await page.goto('/feed');
    await page.getByRole('button', { name: 'Account menu' }).click();
    await page.getByRole('menuitem', { name: 'Log out' }).click();

    await expect(page).toHaveURL('/auth/login');
    await expect(page.getByRole('button', { name: 'Account menu' })).toBeHidden();
    expect(await page.evaluate(() => localStorage.getItem('tawasol-token'))).toBeNull();
  });

  test.describe('as the demo account', () => {
    test.use({ signedInAs: DEMO });

    test('cannot open change-password (notDemoGuard) and has no menu entry for it', async ({
      page,
    }) => {
      await page.goto('/change-password');
      await expect(page).toHaveURL('/feed');
      await page.getByRole('button', { name: 'Account menu' }).click();
      await expect(page.getByRole('menuitem', { name: 'Log out' })).toBeVisible();
      await expect(page.getByRole('menuitem', { name: 'Change password' })).toHaveCount(0);
    });
  });
});
