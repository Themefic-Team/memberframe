/**
 * Email and password rules, feature plan FP-02.
 *
 * These functions exist twice. This copy is the one tests can reach; the other
 * lives inside `src/canvas-components/MemberAuth.tsx`, which cannot import
 * anything from this repository because Framer compiles it alone on a creator's
 * published site. `test/credentialsParity.test.ts` extracts both copies and
 * fails when they diverge, the same arrangement `isEntitled` already uses.
 *
 * What these rules are NOT is a security control. A regex in a bundled
 * component is advice to a cooperative visitor; an attacker posts to the
 * endpoint directly. The defences that matter are the Argon2id hash, the
 * five-attempt lockout, the rate limit, and a check against a breached-password
 * corpus, all of them server side. See `05-member-auth.md` section 9.3.
 *
 * The reason to validate here anyway is that a client which accepts what the
 * server rejects shows a cheerful form followed by a 400 with no field to blame.
 */

// ============================================================================
// POLICY CONSTANTS
// ============================================================================
// Duplicated verbatim in the component, and the parity test compares these too.
// A function body that matches while the numbers differ would pass a naive
// comparison and still disagree with the server.

/** FP-02 section 2.1: "min 8-character validation". */
export const PASSWORD_MIN_LENGTH = 8;

/**
 * An upper bound, which is about denial of service rather than strength.
 *
 * Argon2id will hash a megabyte if asked, and that is a cheap way to burn a
 * server's CPU. 128 is far past any real passphrase.
 *
 * It also sidesteps a trap: bcrypt silently truncates at 72 bytes, so with
 * bcrypt two different long passwords unlock the same account. FP-02 names
 * "Argon2id/bcrypt" without choosing. Conflict C15 in the ledger asks the
 * backend to choose Argon2id.
 */
export const PASSWORD_MAX_LENGTH = 128;

/** A new site's rules, and the rule before rules could be set: 8 characters, a letter, a number. */
export const DEFAULT_PASSWORD_POLICY: PasswordPolicy = {
  minLength: 8,
  requireNumber: true,
  requireUppercase: false,
  requireLowercase: false,
  requireSymbol: false,
};

/** The longest minimum a site may ask for. */
export const PASSWORD_POLICY_MAX_MIN = 64;

/** The rules a creator sets in Settings, Membership. Sign in never checks them. */
export interface PasswordPolicy {
  minLength: number;
  requireNumber: boolean;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireSymbol: boolean;
}

/**
 * The shortest email local part worth substring-matching against a password.
 *
 * Below three characters the check fires on ordinary words: a member whose
 * address is `jo@example.com` would be told that "jogging2024" contains their
 * email.
 */
export const EMAIL_FRAGMENT_MIN_LENGTH = 3;

/**
 * A deliberately tiny list of the most-guessed strings.
 *
 * Not a breach corpus. Those are gigabytes and belong on the server. This
 * catches the handful a visitor types when they are not really trying, and the
 * list is short because every entry ships to the creator's site inside the
 * component and spends part of the 40kB budget in PRD section 14.2 P3.
 */
export const COMMON_PASSWORDS: ReadonlyArray<string> = [
  "password",
  "password1",
  "password123",
  "12345678",
  "123456789",
  "1234567890",
  "qwertyuiop",
  "qwerty123",
  "iloveyou",
  "sunshine",
  "princess",
  "football",
  "baseball",
  "welcome1",
  "admin123",
  "letmein1",
  "monkey12",
  "abc12345",
  "trustno1",
  "superman",
];

// ============================================================================
// TYPES
// ============================================================================

/**
 * Why a password was refused. One per rule, so the form can point at a field
 * and say something specific rather than "invalid".
 */
export type PasswordProblem =
  | "too_short"
  | "too_long"
  | "needs_letter"
  | "needs_number"
  | "needs_uppercase"
  | "needs_lowercase"
  | "needs_symbol"
  | "contains_email"
  | "too_common";

/** Strength meter positions. Four filled segments, plus empty. */
export type PasswordScore = 0 | 1 | 2 | 3 | 4;

// ============================================================================
// SHARED RULES, DUPLICATED IN THE COMPONENT
// ============================================================================

/**
 * Good enough to catch a typo, not an attempt at RFC 5322.
 *
 * The server is the authority on whether an address can receive mail. A strict
 * client pattern rejects valid addresses, and the only cost of being permissive
 * is one wasted request.
 */
export function looksLikeEmail(value: string): boolean {
  const email = value.trim();
  if (email.length < 3 || email.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Every rule this password breaks, in the order worth telling a visitor about.
 *
 * Returns all of them rather than the first, so a caller can show one message
 * and a test can assert the whole set. The password is never trimmed: a
 * trailing space is part of the secret, and trimming it here would mean
 * registering one string and signing in with another.
 */
export function passwordProblems(
  password: string,
  email: string,
  policy: PasswordPolicy
): ReadonlyArray<PasswordProblem> {
  const problems: PasswordProblem[] = [];
  const value = String(password ?? "");
  const rules = readPasswordPolicy(policy);

  if (value.length < rules.minLength) problems.push("too_short");
  if (value.length > PASSWORD_MAX_LENGTH) problems.push("too_long");

  const lowered = value.toLowerCase();

  if (COMMON_PASSWORDS.includes(lowered)) problems.push("too_common");

  const localPart =
    String(email ?? "")
      .trim()
      .toLowerCase()
      .split("@")[0] ?? "";

  if (
    localPart.length >= EMAIL_FRAGMENT_MIN_LENGTH &&
    lowered.includes(localPart)
  ) {
    problems.push("contains_email");
  }

  // Always a letter; the rest as the site's rules say (05-member-auth.md 13).
  if (!/[a-zA-Z]/.test(value)) problems.push("needs_letter");
  if (rules.requireNumber && !/[0-9]/.test(value)) problems.push("needs_number");
  if (rules.requireUppercase && !/[A-Z]/.test(value)) problems.push("needs_uppercase");
  if (rules.requireLowercase && !/[a-z]/.test(value)) problems.push("needs_lowercase");
  if (rules.requireSymbol && !/[^a-zA-Z0-9]/.test(value)) problems.push("needs_symbol");

  return problems;
}

/**
 * The site's rules, read defensively: a length from 8 to 64, and a number
 * required unless the rules say otherwise, which is the rule before rules
 * could be set. Anything missing or malformed falls back to that.
 */
export function readPasswordPolicy(value: unknown): PasswordPolicy {
  const raw = (value && typeof value === "object" ? value : {}) as Partial<Record<keyof PasswordPolicy, unknown>>;
  const length = Math.round(Number(raw.minLength));
  return {
    minLength: Number.isFinite(length) ? Math.min(PASSWORD_POLICY_MAX_MIN, Math.max(PASSWORD_MIN_LENGTH, length)) : PASSWORD_MIN_LENGTH,
    requireNumber: raw.requireNumber !== false,
    requireUppercase: raw.requireUppercase === true,
    requireLowercase: raw.requireLowercase === true,
    requireSymbol: raw.requireSymbol === true,
  };
}

/**
 * A 0 to 4 score for the meter.
 *
 * Length first, because length is what actually resists a guess, then one point
 * for mixing in something other than lowercase letters. Not an entropy estimate
 * and not presented as one: the label says "Weak" or "Strong", never a bit count
 * the number cannot support.
 */
export function passwordScore(password: string): PasswordScore {
  const value = String(password ?? "");
  if (value.length === 0) return 0;

  let score = 0;

  if (value.length >= PASSWORD_MIN_LENGTH) score += 1;
  if (value.length >= 12) score += 1;
  if (value.length >= 16) score += 1;

  const variety =
    (/[a-z]/.test(value) ? 1 : 0) +
    (/[A-Z]/.test(value) ? 1 : 0) +
    (/[0-9]/.test(value) ? 1 : 0) +
    (/[^a-zA-Z0-9]/.test(value) ? 1 : 0);

  if (variety >= 3) score += 1;

  if (COMMON_PASSWORDS.includes(value.toLowerCase())) return 0;

  return Math.min(4, score) as PasswordScore;
}

// ============================================================================
// COPY, NOT POLICY
// ============================================================================
// These two are deliberately outside the parity test. They are wording, and
// wording drifting between the panel and the component is cosmetic, where a
// rule drifting is a bug. PRD section 7.6 rule 4: never show a raw enum value.

export function passwordProblemMessage(problem: PasswordProblem, rules: PasswordPolicy = DEFAULT_PASSWORD_POLICY): string {
  switch (problem) {
    case "too_short":
      return `Use at least ${readPasswordPolicy(rules).minLength} characters.`;
    case "too_long":
      return `Keep it under ${PASSWORD_MAX_LENGTH} characters.`;
    case "needs_letter":
      return "Add at least one letter.";
    case "needs_number":
      return "Add at least one number.";
    case "needs_uppercase":
      return "Add an uppercase letter.";
    case "needs_lowercase":
      return "Add a lowercase letter.";
    case "needs_symbol":
      return "Add a symbol, such as ! or #.";
    case "contains_email":
      return "Do not use your email address in your password.";
    case "too_common":
      return "That password is too easy to guess. Pick another.";
  }
}

export function passwordScoreLabel(score: PasswordScore): string {
  switch (score) {
    case 0:
      return "Too weak";
    case 1:
      return "Weak";
    case 2:
      return "Fair";
    case 3:
      return "Good";
    case 4:
      return "Strong";
  }
}

/**
 * The one call a form makes.
 *
 * A separate function rather than `problems.length === 0` at every call site,
 * so "acceptable" has one definition. If a rule later becomes a warning rather
 * than a refusal, this is the only place that changes.
 */
export function isAcceptablePassword(
  password: string,
  email: string,
  policy: PasswordPolicy
): boolean {
  return passwordProblems(password, email, policy).length === 0;
}
