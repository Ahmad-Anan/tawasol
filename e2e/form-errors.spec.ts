// Submitting a form with invalid fields (WCAG 3.3.1): every error shows in the page's language,
// focus moves to the first invalid field, each invalid field is marked aria-invalid and described
// by its error, and one polite announcement says how many fields need fixing. Nothing is sent.
import type { Locator, Page } from '@playwright/test';
import { t, tCount } from './support/i18n';
import { expect, test, type Language } from './support/test';

/** CDK LiveAnnouncer's polite region (shared/forms/invalid-submit.ts announces through it). */
const announcer = (page: Page) => page.locator('.cdk-live-announcer-element');

/** The field is marked invalid and its aria-describedby resolves to exactly `message`. */
async function expectDescribedError(control: Locator, message: string): Promise<void> {
  await expect(control).toHaveAttribute('aria-invalid', 'true');
  await expect(control).toHaveAccessibleDescription(message);
}

test.describe('signed out', () => {
  test.use({ signedInAs: null });

  for (const lang of ['en', 'ar'] as const satisfies Language[]) {
    test.describe(lang, () => {
      test.use({ lang });

      test('an empty login submit shows every error, focuses the first field and announces once', async ({
        page,
        api,
      }) => {
        await page.goto('/auth/login');
        await page.getByRole('button', { name: t(lang, 'auth.login.submit'), exact: true }).click();

        const login = page.getByLabel(t(lang, 'auth.login.loginLabel'));
        const password = page.getByLabel(t(lang, 'auth.login.passwordLabel'));
        await expect(login).toBeFocused();
        await expectDescribedError(login, t(lang, 'auth.login.errors.loginRequired'));
        await expectDescribedError(password, t(lang, 'auth.login.errors.passwordRequired'));
        await expect(announcer(page)).toHaveText(tCount(lang, 'shared.forms.invalidSubmit', 2));
        // The announcement is the only one: no alert competes with it.
        await expect(page.getByRole('alert')).toHaveCount(0);
        expect(api.callsTo('POST', '/users/signin')).toHaveLength(0);
      });

      test('an empty register submit shows every error, focuses the first field and announces once', async ({
        page,
        api,
      }) => {
        await page.goto('/auth/register');
        await page
          .getByRole('button', { name: t(lang, 'auth.register.submit'), exact: true })
          .click();

        const name = page.getByLabel(t(lang, 'auth.register.nameLabel'));
        await expect(name).toBeFocused();
        await expectDescribedError(name, t(lang, 'auth.register.errors.nameRequired'));
        await expectDescribedError(
          page.getByLabel(t(lang, 'auth.register.emailLabel'), { exact: true }),
          t(lang, 'auth.register.errors.emailRequired'),
        );
        await expectDescribedError(
          page.getByLabel(t(lang, 'auth.register.dobLabel')),
          t(lang, 'auth.register.errors.dobRequired'),
        );
        await expectDescribedError(
          page.getByRole('radiogroup', { name: t(lang, 'auth.register.genderLabel') }),
          t(lang, 'auth.register.errors.genderRequired'),
        );
        await expectDescribedError(
          page.getByLabel(t(lang, 'auth.register.passwordLabel'), { exact: true }),
          t(lang, 'auth.register.errors.passwordRequired'),
        );
        await expectDescribedError(
          page.getByLabel(t(lang, 'auth.register.rePasswordLabel')),
          t(lang, 'auth.register.errors.rePasswordRequired'),
        );
        // Username is optional, so an empty one is valid.
        await expect(page.getByLabel(t(lang, 'auth.register.usernameLabel'))).toHaveAttribute(
          'aria-invalid',
          'false',
        );
        await expect(announcer(page)).toHaveText(tCount(lang, 'shared.forms.invalidSubmit', 6));
        await expect(page.getByRole('alert')).toHaveCount(0);
        expect(api.callsTo('POST', '/users/signup')).toHaveLength(0);
      });
    });
  }

  test('focus goes to the first invalid field in page order, even the gender group', async ({
    page,
  }) => {
    await page.goto('/auth/register');
    await page.getByLabel('Full name').fill('Sara Ali');
    await page.getByLabel('Email', { exact: true }).fill('sara@example.com');
    await page.getByLabel('Date of birth').fill('1995-04-12');
    await page.getByLabel('Password', { exact: true }).fill('Aa123456#');
    await page.getByLabel('Confirm password').fill('Aa123456#');
    await page.getByRole('button', { name: 'Create account', exact: true }).click();

    const gender = page.getByRole('radiogroup', { name: 'Gender' });
    await expect(gender).toBeFocused();
    await expectDescribedError(gender, 'Select a gender');
    await expect(announcer(page)).toHaveText(tCount('en', 'shared.forms.invalidSubmit', 1));

    // Choosing one clears the error and the invalid state.
    await page.getByRole('radio', { name: 'Female' }).check();
    await expect(gender).toHaveAttribute('aria-invalid', 'false');
    await expect(page.getByText('Select a gender')).toHaveCount(0);
  });

  test('aria-invalid follows the field after the submit: fixed, then emptied again', async ({
    page,
  }) => {
    await page.goto('/auth/login');
    await page.getByRole('button', { name: 'Log in', exact: true }).click();
    const login = page.getByLabel('Email or username');
    await expect(login).toHaveAttribute('aria-invalid', 'true');

    await login.fill('layla');
    await expect(login).toHaveAttribute('aria-invalid', 'false');
    await expect(page.getByText('Enter your email or username')).toHaveCount(0);

    await login.fill('');
    await expect(login).toHaveAttribute('aria-invalid', 'true');
    await expect(login).toHaveAccessibleDescription('Enter your email or username');
  });
});

test('an empty change-password submit shows every error and focuses the first field', async ({
  page,
  api,
}) => {
  await page.goto('/change-password');
  await page.getByRole('button', { name: 'Update password', exact: true }).click();

  const current = page.getByLabel('Current password');
  await expect(current).toBeFocused();
  await expectDescribedError(current, t('en', 'changePassword.errors.currentPasswordRequired'));
  await expectDescribedError(
    page.getByLabel('New password', { exact: true }),
    t('en', 'changePassword.errors.newPasswordRequired'),
  );
  await expectDescribedError(
    page.getByLabel('Confirm new password'),
    t('en', 'changePassword.errors.confirmRequired'),
  );
  await expect(announcer(page)).toHaveText(tCount('en', 'shared.forms.invalidSubmit', 3));
  expect(api.callsTo('PATCH', '/users/change-password')).toHaveLength(0);
});
