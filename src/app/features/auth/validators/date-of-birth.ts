export const MIN_AGE = 13;
export const MAX_AGE = 100;

export type DateOfBirthError = 'tooYoung' | 'tooOld';

interface CalendarDate {
  year: number;
  month: number;
  day: number;
}

/**
 * Whether a date of birth gives a realistic age — between MIN_AGE and MAX_AGE whole years,
 * inclusive — or `null` if it does. A date in the future counts as "too young". An empty value
 * is left to `required()`.
 *
 * `value` is the `YYYY-MM-DD` string an `<input type="date">` produces. It's compared as plain
 * calendar parts, never through `new Date(value)`, which would parse it as UTC midnight and shift
 * the day in time zones west of UTC. `today` is passed in (rather than read here) so the rule is
 * pure and testable.
 */
export function dateOfBirthError(value: string, today: Date): DateOfBirthError | null {
  const birth = parseIsoDate(value);
  if (!birth) {
    return null;
  }
  const age = ageOn({ year: today.getFullYear(), month: today.getMonth() + 1, day: today.getDate() }, birth);
  if (age < MIN_AGE) {
    return 'tooYoung';
  }
  if (age > MAX_AGE) {
    return 'tooOld';
  }
  return null;
}

/**
 * The `min`/`max` bounds for the date picker, as `YYYY-MM-DD`, so the native picker opens on
 * (and limits itself to) the same range the validator accepts.
 */
export function dateOfBirthBounds(today: Date): { min: string; max: string } {
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  const day = today.getDate();
  // The oldest accepted birthday is the day after (today, MAX_AGE + 1 years ago).
  const oldest = new Date(year - MAX_AGE - 1, month - 1, day + 1);
  return {
    min: formatIsoDate(oldest.getFullYear(), oldest.getMonth() + 1, oldest.getDate()),
    max: formatIsoDate(year - MIN_AGE, month, day),
  };
}

function ageOn(today: CalendarDate, birth: CalendarDate): number {
  const hadBirthdayThisYear = today.month > birth.month || (today.month === birth.month && today.day >= birth.day);
  return today.year - birth.year - (hadBirthdayThisYear ? 0 : 1);
}

function parseIsoDate(value: string): CalendarDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

function formatIsoDate(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
