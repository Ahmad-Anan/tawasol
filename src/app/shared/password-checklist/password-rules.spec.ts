import { PASSWORD_PATTERN, passwordRuleStatus } from './password-rules';

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
