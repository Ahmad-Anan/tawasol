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
