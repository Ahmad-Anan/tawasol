export type TimestampLocale = 'en' | 'ar';

/**
 * Compact post timestamp that fits the post header on a 390px screen without truncating:
 * day + month + time ("Sep 25, 8:30 PM" / "25 سبتمبر، 8:30 م") for posts from `currentYear`, with
 * the year added only for older ones ("Mar 5, 2024, 8:30 PM").
 */
export function formatShortTimestamp(createdAt: string, locale: TimestampLocale, currentYear: number): string {
  const date = new Date(createdAt);
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    ...(date.getFullYear() === currentYear ? {} : { year: 'numeric' }),
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

/** Full date and time, for the timestamp's `title` tooltip. */
export function formatFullTimestamp(createdAt: string, locale: TimestampLocale): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'full', timeStyle: 'short' }).format(new Date(createdAt));
}
