import { PASSWORD_PATTERN, hasNonEnglishCharacters, passwordRuleStatus } from './password-rules';

function unmet(value: string): string[] {
  return passwordRuleStatus(value)
    .filter((rule) => !rule.met)
    .map((rule) => rule.id);
}

describe('passwordRuleStatus', () => {
  it('reports every requirement as unmet for an empty value', () => {
    expect(unmet('')).toEqual(['length', 'uppercase', 'lowercase', 'number', 'special']);
  });

  it('ticks off each requirement independently', () => {
    expect(unmet('abcdefgh')).toEqual(['uppercase', 'number', 'special']);
    expect(unmet('ABC')).toEqual(['length', 'lowercase', 'number', 'special']);
    expect(unmet('12345678')).toEqual(['uppercase', 'lowercase', 'special']);
    expect(unmet('#')).toEqual(['length', 'uppercase', 'lowercase', 'number']);
  });

  it('only counts the special characters the API accepts', () => {
    for (const symbol of ['#', '?', '!', '@', '$', '%', '^', '&', '*', '-']) {
      expect(unmet(`Abcdefg1${symbol}`)).toEqual([]);
    }
    for (const symbol of ['_', '.', '+', '=', '~', ' ']) {
      expect(unmet(`Abcdefg1${symbol}`)).toEqual(['special']);
    }
  });

  it('agrees with the API pattern: all requirements met exactly when the pattern matches', () => {
    for (const value of ['', 'Passw0rd!', 'Abcdefg1_', 'short1A!', 'Sh0rt!', 'NOLOWER1!', 'nouppercase1!', 'NoNumber!!']) {
      expect(unmet(value).length === 0).toBe(PASSWORD_PATTERN.test(value));
    }
  });
});

describe('password input typed on an Arabic keyboard layout', () => {
  it('never meets the letter requirements with Arabic letters, even when digits and symbols do', () => {
    // What the Arabic layout types: Arabic letters, but ASCII digits and shifted symbols.
    expect(unmet('شسيبلاتن')).toEqual(['uppercase', 'lowercase', 'number', 'special']);
    expect(unmet('شسيب1234!')).toEqual(['uppercase', 'lowercase']);
  });

  it('meets every requirement with English letters', () => {
    expect(unmet('Tawasol1!')).toEqual([]);
  });

  it('counts only the English letters in mixed input', () => {
    expect(unmet('شسيبAb1!')).toEqual([]);
    expect(unmet('شسيبab1!')).toEqual(['uppercase']);
  });

  it('does not count Arabic-Indic digits as a number', () => {
    expect(unmet('Abcdefg١!')).toEqual(['number']);
  });
});

describe('hasNonEnglishCharacters', () => {
  it('is false for English letters, ASCII digits and symbols', () => {
    for (const value of ['', 'Tawasol1!', 'abc', 'ABC', '12345678', '#?!@$%^&*-', 'a b_c.d']) {
      expect(hasNonEnglishCharacters(value)).toBe(false);
    }
  });

  it('is true for Arabic letters, alone or mixed with English', () => {
    for (const value of ['ش', 'شسيب', 'Tawasol1!ش', 'ش1!']) {
      expect(hasNonEnglishCharacters(value)).toBe(true);
    }
  });

  it('is true for other non-English letters, Arabic diacritics and Arabic-Indic digits', () => {
    for (const value of ['é', 'Ж', '文', 'ِ', '١٢٣', '۴']) {
      expect(hasNonEnglishCharacters(value)).toBe(true);
    }
  });
});
