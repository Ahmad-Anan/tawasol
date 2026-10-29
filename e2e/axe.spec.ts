// Automated WCAG A/AA scans (axe-core, see support/axe.ts) of every page and overlay, in English and
// Arabic, light and dark. Any violation fails the test; no axe rule is disabled.
//
// Every new page or dialog must be added to PAGES or OVERLAYS below (see README.md > Testing).
import type { Page } from '@playwright/test';
import { LAYLA } from './fixtures/users';
import { expectNoAxeViolations } from './support/axe';
import { t } from './support/i18n';
import { expect, test, type Language, type Theme } from './support/test';

const OMARS_POST = '6b2000000000000000000001';

interface Scenario {
  name: string;
  path: string;
  signedIn: boolean;
  /** Waits until the page (or overlay) shows its real content, not a loading state. */
  ready: (page: Page, lang: Language) => Promise<void>;
  /** Overlays only: opens the dialog/menu after `ready`. */
  open?: (page: Page, lang: Language) => Promise<void>;
}

const noLoaders = (page: Page) =>
  expect(page.locator('mat-spinner, .skeleton-shimmer')).toHaveCount(0);

const PAGES: Scenario[] = [
  {
    name: 'login',
    path: '/auth/login',
    signedIn: false,
    ready: async (page, lang) => {
      await expect(page.getByLabel(t(lang, 'auth.login.loginLabel'))).toBeVisible();
    },
  },
  {
    name: 'register',
    path: '/auth/register',
    signedIn: false,
    ready: async (page, lang) => {
      await expect(page.getByLabel(t(lang, 'auth.register.nameLabel'))).toBeVisible();
    },
  },
  {
    name: 'feed',
    path: '/feed',
    signedIn: true,
    ready: async (page) => {
      await expect(page.getByRole('article')).toHaveCount(4);
      await expect(page.locator('app-suggested-friends li').first()).toBeVisible();
      await noLoaders(page);
    },
  },
  {
    name: 'post detail',
    path: `/posts/${OMARS_POST}`,
    signedIn: true,
    ready: async (page) => {
      await expect(page.locator('app-comment-item').first()).toBeVisible();
      await noLoaders(page);
    },
  },
  {
    name: 'profile',
    path: `/profile/${LAYLA._id}`,
    signedIn: true,
    ready: async (page) => {
      await expect(page.getByRole('heading', { level: 1, name: LAYLA.name })).toBeVisible();
      await expect(page.getByRole('article')).toHaveCount(1);
      await noLoaders(page);
    },
  },
  {
    name: 'bookmarks',
    path: '/bookmarks',
    signedIn: true,
    ready: async (page) => {
      await expect(page.getByRole('article')).toHaveCount(1);
      await noLoaders(page);
    },
  },
  {
    name: 'notifications',
    path: '/notifications',
    signedIn: true,
    ready: async (page) => {
      await expect(page.locator('app-notification-item')).toHaveCount(2);
      await noLoaders(page);
    },
  },
  {
    name: 'change password',
    path: '/change-password',
    signedIn: true,
    ready: async (page, lang) => {
      await expect(page.getByLabel(t(lang, 'changePassword.currentPasswordLabel'))).toBeVisible();
    },
  },
  {
    name: '404',
    path: '/this/does/not/exist',
    signedIn: true,
    ready: async (page, lang) => {
      await expect(
        page.getByRole('heading', { level: 1, name: t(lang, 'notFound.title') }),
      ).toBeVisible();
    },
  },
];

const feedPage = PAGES.find((p) => p.name === 'feed')!;
const profilePage = PAGES.find((p) => p.name === 'profile')!;
const omarsPost = (page: Page) =>
  page.getByRole('article').filter({ has: page.locator(`a[href="/posts/${OMARS_POST}"]`) });

const OVERLAYS: Scenario[] = [
  {
    ...feedPage,
    name: 'post likes dialog',
    open: async (page, lang) => {
      await omarsPost(page)
        .getByRole('button', { name: t(lang, 'feed.postCard.viewLikes') })
        .click();
      const dialog = page.getByRole('dialog', { name: t(lang, 'feed.postCard.likesDialog.title') });
      await expect(dialog.getByRole('link').first()).toBeVisible();
      await noLoaders(page);
    },
  },
  {
    ...profilePage,
    name: 'suggested-friends dialog',
    open: async (page, lang) => {
      await page.getByRole('button', { name: new RegExp(t(lang, 'profile.followers')) }).click();
      const dialog = page.getByRole('dialog', {
        name: t(lang, 'suggestions.dialog.titleFollowers'),
      });
      await expect(dialog.locator('app-suggested-friends li').first()).toBeVisible();
      await noLoaders(page);
    },
  },
  {
    ...feedPage,
    name: 'image lightbox',
    open: async (page, lang) => {
      await omarsPost(page)
        .getByRole('button', { name: t(lang, 'shared.imageLightbox.open') })
        .click();
      const dialog = page.getByRole('dialog');
      await expect(dialog.getByRole('img')).toBeVisible();
      await expect(
        dialog.getByRole('button', { name: t(lang, 'shared.imageLightbox.close') }),
      ).toBeFocused();
    },
  },
  {
    ...feedPage,
    name: 'post options menu',
    open: async (page, lang) => {
      const ownPost = page.getByRole('article').filter({ hasText: 'My first post on Tawasol.' });
      await ownPost.getByRole('button', { name: t(lang, 'feed.postCard.moreOptions') }).click();
      await expect(page.getByRole('menu')).toBeVisible();
      await expect(
        page.getByRole('menuitem', { name: t(lang, 'feed.postCard.edit') }),
      ).toBeFocused();
    },
  },
];

for (const lang of ['en', 'ar'] as const satisfies Language[]) {
  for (const theme of ['light', 'dark'] as const satisfies Theme[]) {
    test.describe(`axe ${lang} ${theme}`, () => {
      test.use({ lang, theme });

      for (const scenario of [...PAGES, ...OVERLAYS]) {
        test.describe(() => {
          test.use({ signedInAs: scenario.signedIn ? LAYLA : null });

          test(scenario.name, async ({ page }, testInfo) => {
            await page.goto(scenario.path);
            await expect(page.locator('html')).toHaveAttribute(
              'dir',
              lang === 'ar' ? 'rtl' : 'ltr',
            );
            if (theme === 'dark') {
              await expect(page.locator('html')).toHaveClass(/tawasol-dark/);
            }
            await scenario.ready(page, lang);
            await scenario.open?.(page, lang);
            await expectNoAxeViolations(page, testInfo);
          });
        });
      }
    });
  }
}
