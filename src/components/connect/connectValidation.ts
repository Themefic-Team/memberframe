/**
 * The Connect tab's pure logic.
 *
 * Separated from the component for the usual reason in this repository:
 * `jsdom` is not installed (blocker B5), so no test renders a React component,
 * and anything worth testing has to live where a node test can reach it.
 *
 * Everything here is a hint rather than a rule. The server validates the same
 * things again and its answer is the one that counts. The point of a copy here
 * is that a creator is told before they submit, not after a round trip.
 */

/** The six-digit connect code. */
export const CONNECT_CODE_LENGTH = 6;

export type EmailProblem = "empty" | "no_at" | "no_domain" | "too_long" | "has_space";

/**
 * Check an address loosely, and say which way it is wrong.
 *
 * Deliberately permissive, and the same shape as the server's regex so a
 * creator is never refused here for a reason the server would not have had.
 * Strict RFC validation rejects addresses that work, and the only cost of being
 * permissive is one wasted email.
 */
export function emailProblem(value: string): EmailProblem | null {
  const trimmed = value.trim();

  if (trimmed === "") return "empty";
  if (trimmed.length > 254) return "too_long";
  if (/\s/.test(trimmed)) return "has_space";

  const at = trimmed.indexOf("@");
  if (at <= 0 || at !== trimmed.lastIndexOf("@") || at === trimmed.length - 1) return "no_at";

  const domain = trimmed.slice(at + 1);
  if (!domain.includes(".") || domain.startsWith(".") || domain.endsWith(".")) return "no_domain";

  return null;
}

/** What to show under the email field. Never the raw problem value, per PRD section 7.6 rule 4. */
export function emailProblemMessage(problem: EmailProblem): string {
  switch (problem) {
    case "empty":
      return "Enter the email address to connect with.";
    case "no_at":
      return "An email address needs a name and a domain, like you@studio.com.";
    case "no_domain":
      return "That domain does not look complete.";
    case "too_long":
      return "That is longer than any real email address.";
    case "has_space":
      return "An email address cannot contain a space.";
  }
}

/**
 * Keep only digits, and only as many as a code has.
 *
 * Applied as the creator types. The common case this fixes is pasting a code
 * out of an email client that carried a trailing space or a non-breaking space,
 * which would otherwise fail validation with nothing visibly wrong.
 */
export function normalizeCode(value: string): string {
  return value.replace(/\D/g, "").slice(0, CONNECT_CODE_LENGTH);
}

export function codeComplete(value: string): boolean {
  return normalizeCode(value).length === CONNECT_CODE_LENGTH;
}

/**
 * Turn a refusal from the connect endpoints into something a creator can act on.
 *
 * `reason` is a wire value and PRD section 7.6 rule 4 forbids showing one, so
 * every path from a refusal to the screen goes through here.
 *
 * `project_claimed_by_another_account` is the one that needs real words. It
 * means the Framer project is already connected to a different MemberFrame
 * account, there is no transfer flow (conflict C28), and a creator staring at
 * "forbidden" would have no idea what to do.
 */
export function connectFailureMessage(reason: string | null): string {
  switch (reason) {
    case "invalid_code":
      return "That code is not right, or it has expired. Ask for a new one.";
    case "resend_too_soon":
      return "A code was just sent. Wait a moment before asking for another.";
    case "project_claimed_by_another_account":
      return "This Framer project is already connected to another MemberFrame account.";
    case "not_connected":
      return "This panel is not connected yet.";
    default:
      return "That did not work. Check the address and try again.";
  }
}

/**
 * How a creator should read an origin we are about to allow.
 *
 * The allowlist is what verifies a request: the site key is public and baked
 * into every published component, so a lifted key is useless from an origin
 * that is not on this list. A creator seeing the list is seeing the security
 * boundary, which is worth making legible rather than hiding.
 */
export function describeOrigin(origin: string): string {
  try {
    const url = new URL(origin);
    return url.host;
  } catch {
    return origin;
  }
}

/**
 * Is this worth sending as an origin?
 *
 * The server normalizes and refuses properly. This catches the single most
 * common creator mistake, which is typing a bare domain, before a round trip
 * that would come back as `no_valid_origins`.
 */
export function looksLikeOrigin(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed === "") return false;

  try {
    const url = new URL(trimmed);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}
