export type PasswordRule = { label: string; test: (pw: string) => boolean };

export const PASSWORD_RULES: PasswordRule[] = [
  { label: "At least 12 characters", test: (pw) => pw.length >= 12 },
  { label: "One uppercase letter (A–Z)", test: (pw) => /[A-Z]/.test(pw) },
  { label: "One lowercase letter (a–z)", test: (pw) => /[a-z]/.test(pw) },
  { label: "One number (0–9)", test: (pw) => /\d/.test(pw) },
  { label: "One special character (!@#$ …)", test: (pw) => /[^A-Za-z0-9]/.test(pw) },
];

export function validatePassword(pw: string): { valid: boolean; errors: string[] } {
  const errors = PASSWORD_RULES.filter((r) => !r.test(pw)).map((r) => r.label);
  return { valid: errors.length === 0, errors };
}
