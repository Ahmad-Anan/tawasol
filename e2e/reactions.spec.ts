// Optimistic like/bookmark (posts) and like (comments): the UI answers the click at once, the
// server's trusted fields are reconciled in, and a failure rolls back to the previous state with
// the existing error text under the buttons plus one polite announcement.
import type { Page } from '@playwright/test';
import { DEMO } from './fixtures/users';
import { t, tCount } from './support/i18n';
import { expect, test, type Language } from './support/test';

const OMARS_POST_ID = '6b2000000000000000000001';
const omarsPost = (page: Page) =>
  page.getByRole('article').filter({ has: page.locator(`a[href="/posts/${OMARS_POST_ID}"]`) });
/** CDK LiveAnnouncer's polite region. */
const announcer = (page: Page) => page.locator('.cdk-live-announcer-element');

/**
 * Holds every `PUT …<suffix>` request until the returned function is called, then lets it through
 * to the mock API, so a spec can look at the UI while the request is still out.
 */
async function holdPuts(page: Page, suffix: string): Promise<() => void> {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  await page.route(
    (url) => url.pathname.endsWith(suffix),
    async (route) => {
      if (route.request().method() === 'PUT') await gate;
      await route.fallback();
    },
  );
  return release;
}

test.describe('optimistic reactions', () => {
  test('a like shows at once, then takes the count the server reports', async ({ page, api }) => {
    // Someone else likes the post after the feed loaded: the server's count will be 3, not 2.
    await page.goto('/feed');
    const post = omarsPost(page);
    await expect(post.getByRole('button', { name: '1 like' })).toBeVisible();
    api.posts.find((p) => p._id === OMARS_POST_ID)!.likes.push(DEMO._id);

    const release = await holdPuts(page, '/like');
    await post.getByRole('button', { name: 'Like', exact: true }).click();

    // Before the server answers.
    await expect(post.getByRole('button', { name: 'Unlike', exact: true })).toBeVisible();
    await expect(post.getByRole('button', { name: '2 likes' })).toBeVisible();

    release();
    await expect(post.getByRole('button', { name: '3 likes' })).toBeVisible();
    await expect(post.getByRole('button', { name: 'Unlike', exact: true })).toBeVisible();
    expect(api.callsTo('PUT', `/posts/${OMARS_POST_ID}/like`)).toHaveLength(1);
  });

  test('a rapid double click sends one request', async ({ page, api }) => {
    await page.goto('/feed');
    const post = omarsPost(page);
    const release = await holdPuts(page, '/like');

    await post.getByRole('button', { name: 'Like', exact: true }).dblclick();
    await expect(post.getByRole('button', { name: '2 likes' })).toBeVisible();
    release();

    await expect(post.getByRole('button', { name: 'Unlike', exact: true })).toBeVisible();
    await expect(post.getByRole('button', { name: '2 likes' })).toBeVisible();
    expect(api.callsTo('PUT', `/posts/${OMARS_POST_ID}/like`)).toHaveLength(1);
  });

  test('a bookmark shows at once, before the server answers', async ({ page }) => {
    await page.goto('/feed');
    const post = omarsPost(page);
    const release = await holdPuts(page, '/bookmark');

    await post.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(post.getByRole('button', { name: 'Remove from saved' })).toBeVisible();
    release();
    await expect(post.getByRole('button', { name: 'Remove from saved' })).toBeVisible();
  });

  for (const lang of ['en', 'ar'] as const satisfies Language[]) {
    test.describe(lang, () => {
      test.use({ lang });

      test('a failed like rolls back, shows the error and announces it', async ({ page, api }) => {
        api.fail('PUT', '/posts/:id/like');
        await page.goto('/feed');
        const post = omarsPost(page);
        const message = t(lang, 'feed.postCard.errors.actionFailed');

        await post
          .getByRole('button', { name: t(lang, 'feed.postCard.like'), exact: true })
          .click();

        await expect(post.getByText(message)).toBeVisible();
        await expect(
          post.getByRole('button', { name: t(lang, 'feed.postCard.like'), exact: true }),
        ).toBeVisible();
        await expect(
          post.getByRole('button', { name: tCount(lang, 'feed.postCard.likesAriaLabel', 1) }),
        ).toBeVisible();
        await expect(announcer(page)).toHaveText(message);
        expect(api.callsTo('PUT', `/posts/${OMARS_POST_ID}/like`)).toHaveLength(1);
      });
    });
  }

  test('a failed bookmark rolls back, shows the error and announces it', async ({ page, api }) => {
    api.fail('PUT', '/posts/:id/bookmark');
    await page.goto('/feed');
    const post = omarsPost(page);

    await post.getByRole('button', { name: 'Save', exact: true }).click();

    await expect(post.getByText('Something went wrong. Please try again.')).toBeVisible();
    await expect(post.getByRole('button', { name: 'Save', exact: true })).toBeVisible();
    await expect(announcer(page)).toHaveText('Something went wrong. Please try again.');
  });

  test('a comment like shows at once; a failed one rolls back and is announced', async ({
    page,
    api,
  }) => {
    await page.goto(`/posts/${OMARS_POST_ID}`);
    const comment = page.locator('app-comment-body').filter({ hasText: 'Congratulations' });

    const release = await holdPuts(page, '/like');
    await comment.getByRole('button', { name: 'Like', exact: true }).click();
    await expect(comment.getByRole('button', { name: 'Unlike · 1' })).toBeVisible();
    release();
    await expect(comment.getByRole('button', { name: 'Unlike · 1' })).toBeVisible();

    api.fail('PUT', '/posts/:id/comments/:commentId/like');
    await comment.getByRole('button', { name: 'Unlike · 1' }).click();

    await expect(comment.getByText('Something went wrong. Please try again.')).toBeVisible();
    await expect(comment.getByRole('button', { name: 'Unlike · 1' })).toBeVisible();
    await expect(announcer(page)).toHaveText('Something went wrong. Please try again.');
    expect(api.callsTo('PUT', `/posts/${OMARS_POST_ID}/comments/:commentId/like`)).toHaveLength(2);
  });
});
