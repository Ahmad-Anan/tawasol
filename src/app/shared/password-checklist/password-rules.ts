/**
 * The API's password rule — identical for `POST /users/signup` and
 * `PATCH /users/change-password`, both verified live (see docs/api-reference.md). Only
 * `#?!@$%^&*-` count as the special character; e.g. `_` does not.
 */
export const PASSWORD_PATTERN = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[#?!@$%^&*-]).{8,}$/;

export type PasswordRuleId = 'length' | 'uppercase' | 'lowercase' | 'number' | 'special';

/** The same rule as PASSWORD_PATTERN, split into the separate requirements the checklist shows. */
const PASSWORD_RULES: readonly { id: PasswordRuleId; test: (value: string) => boolean }[] = [
  { id: 'length', test: (value) => value.length >= 8 },
  { id: 'uppercase', test: (value) => /[A-Z]/.test(value) },
  { id: 'lowercase', test: (value) => /[a-z]/.test(value) },
  { id: 'number', test: (value) => /\d/.test(value) },
  { id: 'special', test: (value) => /[#?!@$%^&*-]/.test(value) },
];

export interface PasswordRuleStatus {
  id: PasswordRuleId;
  met: boolean;
}

export function passwordRuleStatus(value: string): PasswordRuleStatus[] {
  return PASSWORD_RULES.map((rule) => ({ id: rule.id, met: rule.test(value) }));
}

/**
 * Any letter, combining mark or digit outside plain ASCII — e.g. Arabic letters, Arabic
 * diacritics, Arabic-Indic digits (١٢٣), or accented letters. None of them count toward the
 * uppercase/lowercase/number requirements (the server's classes are ASCII-only too), and in
 * practice they almost always mean the keyboard is on a non-English layout: on the Arabic layout
 * the letter keys type Arabic while the number row and its symbols stay ASCII, which is why the
 * length/number/special items tick but the letter items never do.
 */
const NON_ENGLISH_CHARACTER = /(?![A-Za-z0-9])[\p{L}\p{M}\p{Nd}]/u;

export function hasNonEnglishCharacters(value: string): boolean {
  return NON_ENGLISH_CHARACTER.test(value);
}
