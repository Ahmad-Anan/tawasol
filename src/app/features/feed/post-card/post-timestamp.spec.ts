import { formatFullTimestamp, formatShortTimestamp } from './post-timestamp';

describe('post timestamps', () => {
  // Midday UTC, so the calendar day and year are the same in any test-runner time zone.
  const thisYear = '2026-09-25T12:30:00.000Z';
  const olderYear = '2024-03-05T12:30:00.000Z';

  it('omits the year for posts from the current year', () => {
    const en = formatShortTimestamp(thisYear, 'en', 2026);
    expect(en).toMatch(/^Sep 25, \d{1,2}:30\s?[AP]M$/);
    const ar = formatShortTimestamp(thisYear, 'ar', 2026);
    expect(ar).toContain('سبتمبر');
    expect(ar).not.toMatch(/2026|٢٠٢٦/);
  });

  it('includes the year for older posts', () => {
    expect(formatShortTimestamp(olderYear, 'en', 2026)).toMatch(/^Mar 5, 2024, \d{1,2}:30\s?[AP]M$/);
    expect(formatShortTimestamp(olderYear, 'ar', 2026)).toMatch(/2024|٢٠٢٤/);
  });

  it('keeps the full date and year for the tooltip', () => {
    expect(formatFullTimestamp(thisYear, 'en')).toMatch(/September 25, 2026/);
  });
});
