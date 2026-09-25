import { dateFieldOrder, dateOfBirthBounds, dateOfBirthError } from './date-of-birth';

describe('dateOfBirthError', () => {
  // Local-time constructor, so the tests don't depend on the machine's time zone.
  const today = new Date(2026, 8, 25); // 25 Sep 2026

  it('leaves an empty value to required()', () => {
    expect(dateOfBirthError('', today)).toBeNull();
  });

  it('accepts someone who turned exactly 13 today', () => {
    expect(dateOfBirthError('2013-09-25', today)).toBeNull();
  });

  it('rejects someone who turns 13 tomorrow', () => {
    expect(dateOfBirthError('2013-09-26', today)).toBe('tooYoung');
  });

  it('rejects a date in the future as too young', () => {
    expect(dateOfBirthError('2030-01-01', today)).toBe('tooYoung');
  });

  it('accepts someone who is 100', () => {
    expect(dateOfBirthError('1926-09-25', today)).toBeNull();
    expect(dateOfBirthError('1925-09-26', today)).toBeNull();
  });

  it('rejects someone who is 101 or older', () => {
    expect(dateOfBirthError('1925-09-25', today)).toBe('tooOld');
    expect(dateOfBirthError('1900-01-01', today)).toBe('tooOld');
  });

  it('accepts an ordinary adult birthday', () => {
    expect(dateOfBirthError('2000-01-01', today)).toBeNull();
  });
});

describe('dateOfBirthBounds', () => {
  it('matches the validator at both ends', () => {
    const today = new Date(2026, 8, 25);
    const { min, max } = dateOfBirthBounds(today);

    expect(max).toBe('2013-09-25');
    expect(min).toBe('1925-09-26');
    expect(dateOfBirthError(max, today)).toBeNull();
    expect(dateOfBirthError(min, today)).toBeNull();
  });

  it('rolls over month ends correctly', () => {
    const { min } = dateOfBirthBounds(new Date(2026, 11, 31)); // 31 Dec 2026
    expect(min).toBe('1926-01-01');
  });
});

describe('dateFieldOrder', () => {
  it('follows the locale the native date field uses', () => {
    expect(dateFieldOrder('en-US')).toEqual(['month', 'day', 'year']);
    expect(dateFieldOrder('en-GB')).toEqual(['day', 'month', 'year']);
    expect(dateFieldOrder('ja-JP')).toEqual(['year', 'month', 'day']);
  });
});
