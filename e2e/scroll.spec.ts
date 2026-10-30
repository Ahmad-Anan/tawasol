// Scroll position across in-app navigations (core/navigation/route-scroll.ts): a new page starts at
// the top, Back/Forward return to where the visitor was, including deep into the infinite-scroll
// feed. (A query-param-only navigation doesn't scroll, but no UI makes one yet, so that rule is
// covered by route-scroll.spec.ts.)
import type { Page } from '@playwright/test';
import { OLDER_POST } from './fixtures/content';
import { expect, test } from './support/test';

const scrollY = (page: Page) => page.evaluate(() => Math.round(window.scrollY));
const postLink = (page: Page, id: string) => page.locator(`main a[href="/posts/${id}"]`).first();
/**
 * Back/Forward restore the exact saved offset (RouteScroll calls scrollTo with it), but Chromium's
 * scroll anchoring can then nudge the page a pixel or two while the last layout settles, so
 * "where the visitor was" is checked to within a few pixels rather than exactly.
 */
const expectRestored = (page: Page, offset: number) =>
  expect.poll(async () => Math.abs((await scrollY(page)) - offset)).toBeLessThanOrEqual(4);
const scrollToEnd = (page: Page) =>
  page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }));

/** The offset once it has stopped changing (layout from just-rendered content can still nudge it). */
async function settledScrollY(page: Page): Promise<number> {
  let previous = -1;
  await expect
    .poll(async () => {
      const current = await scrollY(page);
      const settled = current === previous;
      previous = current;
      return settled;
    })
    .toBe(true);
  return previous;
}

test.describe('scroll on navigation', () => {
  test('a new page starts at the top, and Back returns to the scrolled feed', async ({ page }) => {
    await page.goto('/feed');
    await expect(page.getByRole('article')).toHaveCount(4);
    const lastPost = page.getByRole('article').last();
    const lastPostId = (await lastPost.locator('a[href^="/posts/"]').first().getAttribute('href'))!
      .split('/')
      .at(-1)!;
    await postLink(page, lastPostId).scrollIntoViewIfNeeded();
    await expect.poll(() => scrollY(page)).toBeGreaterThan(200);
    const feedOffset = await settledScrollY(page);

    await postLink(page, lastPostId).click();
    await expect(page).toHaveURL(`/posts/${lastPostId}`);
    await expect.poll(() => scrollY(page)).toBe(0);

    await page.goBack();
    await expect(page).toHaveURL('/feed');
    await expectRestored(page, feedOffset);
    await expect(lastPost).toBeInViewport();

    // Forward goes back to the post page at the position it had: the top.
    await page.goForward();
    await expect(page).toHaveURL(`/posts/${lastPostId}`);
    await expect.poll(() => scrollY(page)).toBe(0);
  });

  test('Back to the feed lands on a post from a later infinite-scroll page', async ({
    page,
    api,
  }) => {
    api.olderPosts = [OLDER_POST];
    await page.goto('/feed');
    await expect(page.getByRole('article')).toHaveCount(4);

    // Scroll to the end so the second page loads, then up to its post.
    const nextPage = api.waitForCall(page, 'GET', '/posts/feed');
    await scrollToEnd(page);
    await nextPage;
    // The page-2 spinner collapsing shifts the layout; record the offset only after it's gone.
    await expect(page.locator('mat-spinner')).toHaveCount(0);
    const olderPost = page.getByRole('article').filter({ hasText: OLDER_POST.body! });
    // The link itself, so click() doesn't nudge the page after the offset is recorded.
    await postLink(page, OLDER_POST._id).scrollIntoViewIfNeeded();
    await expect(olderPost).toBeInViewport();
    const feedOffset = await settledScrollY(page);
    expect(feedOffset).toBeGreaterThan(200);

    await postLink(page, OLDER_POST._id).click();
    await expect(page).toHaveURL(`/posts/${OLDER_POST._id}`);
    await expect.poll(() => scrollY(page)).toBe(0);

    await page.goBack();
    await expect(page).toHaveURL('/feed');
    // The posts are still in the store, so the feed renders at full length and the position holds.
    await expectRestored(page, feedOffset);
    await expect(olderPost).toBeInViewport();
  });

  test('route focus still moves into the new page without scrolling it', async ({ page }) => {
    await page.goto('/feed');
    await expect(page.getByRole('article')).toHaveCount(4);
    await scrollToEnd(page);
    await expect.poll(() => scrollY(page)).toBeGreaterThan(0);

    await page.getByRole('link', { name: 'Bookmarks' }).first().click();
    await expect(page).toHaveURL('/bookmarks');
    // RouteFocus (core/a11y) focuses the page heading, or <main> when there is none.
    await expect(page.locator('main h1:focus, main:focus')).toHaveCount(1);
    await expect.poll(() => scrollY(page)).toBe(0);
  });
});
