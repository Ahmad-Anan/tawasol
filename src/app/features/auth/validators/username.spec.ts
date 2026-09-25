import { USERNAME_PATTERN, normalizeUsername, usernameError } from './username';

describe('normalizeUsername', () => {
  it('lowercases uppercase letters', () => {
    expect(normalizeUsername('AhmedAnan')).toBe('ahmedanan');
  });

  it('turns spaces (and other whitespace) into underscores', () => {
    expect(normalizeUsername('Ahmed Anan')).toBe('ahmed_anan');
    expect(normalizeUsername('a b\tc')).toBe('a_b_c');
  });

  it('keeps the length the same so the caret can be restored in place', () => {
    const input = 'My User Name 42';
    expect(normalizeUsername(input)).toHaveLength(input.length);
  });

  it('leaves characters it cannot fix for the validator to report', () => {
    expect(normalizeUsername('أحمد')).toBe('أحمد');
    expect(normalizeUsername('ahmed.anan!')).toBe('ahmed.anan!');
  });
});

describe('usernameError', () => {
  it('accepts an empty value, since the field is optional', () => {
    expect(usernameError('')).toBeNull();
  });

  it('accepts values the API accepts', () => {
    for (const value of ['abc', 'ahmed_anan', 'user_42', 'a'.repeat(30)]) {
      expect(usernameError(value)).toBeNull();
      expect(USERNAME_PATTERN.test(value)).toBe(true);
    }
  });

  it('reports Arabic letters, symbols and uppercase as a character problem', () => {
    for (const value of ['أحمد', 'ahmed.anan', 'ahmed-anan', 'ahmed@x', 'Ahmed']) {
      expect(usernameError(value)).toBe('characters');
    }
  });

  it('reports values shorter than 3 or longer than 30 as a length problem', () => {
    expect(usernameError('ab')).toBe('length');
    expect(usernameError('a'.repeat(31))).toBe('length');
  });

  it('reports characters before length', () => {
    expect(usernameError('!')).toBe('characters');
  });

  it('never accepts anything the API pattern rejects', () => {
    for (const value of ['ab', 'Ahmed', 'a b', 'أحمد', 'x'.repeat(31), 'ok_name', 'fine123']) {
      expect(usernameError(value) === null).toBe(USERNAME_PATTERN.test(value));
    }
  });
});
