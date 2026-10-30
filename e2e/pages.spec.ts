import { LAYLA, LAYLA_PASSWORD, OMAR } from './fixtures/users';
import { expect, test } from './support/test';

test('post detail shows the post with its comments open', async ({ page }) => {
  await page.goto('/posts/6b2000000000000000000001');
  await expect(page).toHaveTitle('Post · Tawasol');
  await expect(page.getByText('Shipping the new release today', { exact: false })).toBeVisible();
  await expect(page.getByLabel('Write a comment…')).toBeVisible();
  await expect(page.getByText('Congratulations, well deserved!')).toBeVisible();
});

test('post detail explains when a post does not exist', async ({ page }) => {
  await page.goto('/posts/6b20000000000000000000ff');
  await expect(
    page.getByText("This post couldn't be found. It may have been deleted."),
  ).toBeVisible();
});

test('own profile shows the header, stats and own posts', async ({ page }) => {
  await page.goto(`/profile/${LAYLA._id}`);
  await expect(page.getByRole('heading', { level: 1, name: LAYLA.name })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Edit Profile' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Followers/ })).toBeVisible();
  await expect(page.getByText('My first post on Tawasol.')).toBeVisible();
  await expect(page.getByRole('article')).toHaveCount(1);
});

test("someone else's profile: unfollow through the confirm dialog", async ({ page, api }) => {
  await page.goto(`/profile/${OMAR._id}`);
  await expect(page.getByRole('heading', { level: 1, name: OMAR.name })).toBeVisible();
  await expect(page.getByText('Shipping the new release today', { exact: false })).toBeVisible();

  await page.getByRole('button', { name: `Following ${OMAR.name}. Activate to unfollow.` }).click();
  const confirm = page.getByRole('alertdialog');
  // The name is wrapped in bidi isolates (U+2068/U+2069), see shared/bidi/isolate-bidi.ts.
  await expect(
    confirm.getByRole('heading', { name: new RegExp(`Unfollow .${OMAR.name}.\\?`) }),
  ).toBeVisible();
  await expect(confirm.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await confirm.getByRole('button', { name: 'Unfollow' }).click();

  await expect(page.getByRole('button', { name: `Follow ${OMAR.name}` })).toBeVisible();
  expect(api.callsTo('PUT', `/users/${OMAR._id}/follow`)).toHaveLength(1);
});

test('bookmarks lists the saved posts', async ({ page }) => {
  await page.goto('/bookmarks');
  await expect(page.getByRole('heading', { level: 1, name: 'Bookmarks' })).toBeVisible();
  await expect(page.getByRole('article')).toHaveCount(1);
  await expect(page.getByText('صباح الخير، يوم موفق للجميع')).toBeVisible();
});

test('notifications list, unread filter and mark all as read', async ({ page, api }) => {
  await page.goto('/notifications');
  await expect(page.getByRole('heading', { level: 1, name: 'Notifications' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Omar Khaled\s+liked your post/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /started following you/ })).toBeVisible();

  await page.getByRole('radio', { name: 'Unread' }).click();
  await expect(page.getByRole('link', { name: /started following you/ })).toBeHidden();
  await expect(page.getByRole('link', { name: /liked your post/ })).toBeVisible();

  await page.getByRole('button', { name: 'Mark all as read' }).click();
  await expect(page.getByText("You're all caught up — no unread notifications.")).toBeVisible();
  expect(api.callsTo('PATCH', '/notifications/read-all')).toHaveLength(1);
});

test('change password: wrong current password, then success', async ({ page, api }) => {
  await page.goto('/change-password');
  await expect(page.getByRole('heading', { level: 1, name: 'Change Password' })).toBeVisible();

  await page.getByLabel('Current password').fill('Wrong#2026');
  await page.getByLabel('New password', { exact: true }).fill('Fresh#2027a');
  await page.getByLabel('Confirm new password').fill('Fresh#2027a');
  await page.getByRole('button', { name: 'Update password' }).click();
  await expect(page.getByRole('alert')).toHaveText('incorrect email or password');

  await page.getByLabel('Current password').fill(LAYLA_PASSWORD);
  await page.getByRole('button', { name: 'Update password' }).click();
  await expect(page.getByRole('status')).toHaveText('Your password was changed successfully.');
  expect(api.callsTo('PATCH', '/users/change-password').at(-1)!.body).toEqual({
    password: LAYLA_PASSWORD,
    newPassword: 'Fresh#2027a',
  });
});

test('unknown URLs show the 404 page with its title', async ({ page }) => {
  await page.goto('/this/does/not/exist');
  await expect(page).toHaveTitle('Page not found · Tawasol');
  await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();
  await page.getByRole('link', { name: 'Back to home' }).click();
  await expect(page).toHaveURL('/feed');
});
