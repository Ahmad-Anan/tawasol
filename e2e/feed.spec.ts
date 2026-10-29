import { OLDER_POST } from './fixtures/content';
import { SARA } from './fixtures/users';
import { expect, test } from './support/test';

const OMARS_POST = 'Shipping the new release today';

test.describe('feed', () => {
  test('renders the posts from the feed', async ({ page }) => {
    await page.goto('/feed');
    await expect(page.getByRole('article').filter({ hasText: OMARS_POST })).toBeVisible();
    await expect(page.getByText('My first post on Tawasol.')).toBeVisible();
    await expect(page.getByText('صباح الخير، يوم موفق للجميع')).toBeVisible();
    await expect(page.getByText('Congratulations, well deserved!')).toBeVisible();
  });

  test('filter toggles send the matching "only" param', async ({ page, api }) => {
    await page.goto('/feed');
    await expect(page.getByRole('radio', { name: 'All' })).toBeChecked();

    for (const [label, only] of [
      ['Following', 'following'],
      ['Me', 'me'],
      ['All', 'all'],
    ] as const) {
      const request = api.waitForCall(page, 'GET', '/posts/feed');
      await page.getByRole('radio', { name: label }).click();
      expect(new URL((await request).url()).searchParams.get('only')).toBe(only);
      await expect(page.getByRole('radio', { name: label })).toBeChecked();
    }
    await expect(page.getByText('My first post on Tawasol.')).toBeVisible();
  });

  test('infinite scroll requests the next page with the last post as cursor', async ({
    page,
    api,
  }) => {
    api.olderPosts = [OLDER_POST];
    await page.goto('/feed');
    await expect(page.getByRole('article')).toHaveCount(4);

    const nextPage = api.waitForCall(page, 'GET', '/posts/feed');
    await page.getByRole('article').last().scrollIntoViewIfNeeded();
    await page.mouse.wheel(0, 5000);
    const params = new URL((await nextPage).url()).searchParams;

    expect(params.get('cursor')).toBe(api.posts.at(-1)!.id);
    expect(params.get('only')).toBe('all');
    await expect(page.getByText(OLDER_POST.body!)).toBeVisible();
  });

  test('creates a post', async ({ page, api }) => {
    await page.goto('/feed');
    await page.getByLabel("What's on your mind?").fill('Hello from the e2e suite');
    await page.getByRole('button', { name: 'Post', exact: true }).click();

    await expect(page.getByRole('article').first()).toContainText('Hello from the e2e suite');
    expect(api.callsTo('POST', '/posts')[0].body).toMatchObject({
      body: 'Hello from the e2e suite',
    });
    await expect(page.getByLabel("What's on your mind?")).toHaveValue('');
  });

  test('toggles like and bookmark on a post', async ({ page, api }) => {
    await page.goto('/feed');
    const post = page.getByRole('article').filter({ hasText: OMARS_POST });

    await post.getByRole('button', { name: 'Like', exact: true }).click();
    await expect(post.getByRole('button', { name: 'Unlike' })).toBeVisible();
    await expect(post.getByRole('button', { name: 'View who liked this post' })).toHaveText(
      '2 likes',
    );

    await post.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(post.getByRole('button', { name: 'Remove from saved' })).toBeVisible();

    await post.getByRole('button', { name: 'Remove from saved' }).click();
    await expect(post.getByRole('button', { name: 'Save', exact: true })).toBeVisible();
    expect(api.callsTo('PUT', '/posts/:id/bookmark')).toHaveLength(2);
  });

  test('adds a comment and a reply', async ({ page, api }) => {
    await page.goto('/feed');
    const post = page.getByRole('article').filter({ hasText: OMARS_POST }).first();
    await post.getByRole('button', { name: 'Comment', exact: true }).click();

    await post.getByLabel('Write a comment…').fill('Great work!');
    await post.getByRole('button', { name: 'Post', exact: true }).click();
    await expect(post.getByText('Great work!')).toBeVisible();
    expect(api.callsTo('POST', '/posts/:id/comments')[0].body).toMatchObject({
      content: 'Great work!',
    });

    const existing = post
      .getByRole('article')
      .filter({ hasText: 'Congratulations, well deserved!' });
    await existing.getByRole('button', { name: 'Reply', exact: true }).click();
    await post.getByLabel('Write a reply…').fill('Thank you!');
    await post.getByRole('button', { name: 'Post', exact: true }).last().click();

    await expect(post.getByText('Thank you!')).toBeVisible();
    expect(api.callsTo('POST', '/posts/:id/comments/:commentId/replies')[0].body).toMatchObject({
      content: 'Thank you!',
    });
  });

  test('opens the likes dialog', async ({ page }) => {
    await page.goto('/feed');
    const post = page.getByRole('article').filter({ hasText: OMARS_POST });
    await post.getByRole('button', { name: 'View who liked this post' }).click();

    const dialog = page.getByRole('dialog', { name: 'Liked by' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(SARA.name)).toBeVisible();
    await dialog.getByRole('button', { name: 'Close' }).click();
    await expect(dialog).toBeHidden();
  });
});
