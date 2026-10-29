import AxeBuilder from '@axe-core/playwright';
import type { Page, TestInfo } from '@playwright/test';
import { expect } from './test';

/**
 * WCAG A/AA rule tags present in the installed axe-core (4.14.0 — checked with
 * `axe.getRules()`): WCAG 2.0, 2.1 and 2.2 at levels A and AA. axe has no separate `wcag22a` tag;
 * its WCAG 2.2 rules are all AA.
 */
export const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/**
 * Runs axe on the current page and fails on any violation. No rule is disabled. The full results
 * are attached to the test report; the assertion message lists each violation's rule id and the
 * offending selectors, so a failure is readable straight from the console.
 */
export async function expectNoAxeViolations(page: Page, testInfo: TestInfo): Promise<void> {
  // Reduced motion shortens animations but doesn't skip them. A scan taken while, say, a tab body
  // is still fading in reads blended colors and reports a color-contrast failure that isn't real.
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .every(
        (a) => a.playState !== 'running' || a.effect?.getComputedTiming().iterations === Infinity,
      ),
  );
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  await testInfo.attach('axe-results.json', {
    body: JSON.stringify(results, null, 2),
    contentType: 'application/json',
  });
  const violations = results.violations.map((v) => ({
    rule: v.id,
    impact: v.impact,
    help: v.help,
    targets: v.nodes.map((n) => n.target.join(' ')),
  }));
  expect(violations, `axe found ${violations.length} violation(s)`).toEqual([]);
}
