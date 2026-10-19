/**
 * The Email sending card's rules. Development doc: 25-custom-smtp.md.
 *
 * Pure, so the card's logic is testable without a DOM. The server checks the
 * same values again on save and is the authority on the one rule the panel
 * cannot know: whether a private host is allowed, which differs between a
 * developer's machine and production.
 */

import type { StoredIntegration } from "../components/settings/integrationRegistry";

export const SMTP_INTEGRATION_ID = "custom_smtp";

export type SmtpSecurity = "ssl" | "starttls" | "none";

export const SECURITY_OPTIONS: ReadonlyArray<{ value: SmtpSecurity; label: string }> = [
  { value: "starttls", label: "STARTTLS (587)" },
  { value: "ssl", label: "SSL/TLS (465)" },
  { value: "none", label: "None (unencrypted)" },
];

/** The port a provider usually uses for each kind of security. */
export function suggestedPort(security: SmtpSecurity): string {
  return security === "ssl" ? "465" : "587";
}

export interface SmtpDraft {
  host: string;
  port: string;
  security: SmtpSecurity;
  username: string;
  /** Empty means "keep the stored one". The server never sends it back. */
  password: string;
  fromName: string;
  fromAddress: string;
  replyTo: string;
}

const EMAIL = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]+$/;

const isSecurity = (value: unknown): value is SmtpSecurity =>
  value === "ssl" || value === "starttls" || value === "none";

/** The form, filled from what is saved. */
export function smtpDraftFrom(stored: StoredIntegration | undefined): SmtpDraft {
  const values = stored?.values ?? {};
  const security = isSecurity(values["security"]) ? values["security"] : "starttls";
  return {
    host: values["host"] ?? "",
    port: values["port"] ?? suggestedPort(security),
    security,
    username: values["username"] ?? "",
    password: "",
    fromName: values["fromName"] ?? "",
    fromAddress: values["fromAddress"] ?? "",
    replyTo: values["replyTo"] ?? "",
  };
}

/** One message per field that needs a fix, keyed by the draft's field name. */
export function smtpDraftProblems(draft: SmtpDraft, passwordStored: boolean): Partial<Record<keyof SmtpDraft, string>> {
  const problems: Partial<Record<keyof SmtpDraft, string>> = {};
  const host = draft.host.trim();
  const port = draft.port.trim();

  if (host === "") problems.host = "Enter the SMTP host, for example smtp.example.com.";
  else if (/[\s/:@]/.test(host)) problems.host = "Enter the host name only, with no http:// or port.";

  if (!/^\d{1,5}$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
    problems.port = "Enter the port, usually 587 or 465.";
  }

  if (draft.username.trim() !== "" && draft.password === "" && !passwordStored) {
    problems.password = "Enter the password for this username.";
  }

  if (!EMAIL.test(draft.fromAddress.trim())) problems.fromAddress = "Enter the address emails are sent from.";
  if (draft.fromName.length > 100) problems.fromName = "Keep the name under 100 characters.";
  if (draft.replyTo.trim() !== "" && !EMAIL.test(draft.replyTo.trim())) {
    problems.replyTo = "Enter a valid address, or leave it empty.";
  }

  return problems;
}

/**
 * The values to save. Every integration save replaces the whole entry, so all
 * the public values go every time. The password goes only when one was typed:
 * left out, the server keeps the one it holds.
 */
export function smtpValues(draft: SmtpDraft): Record<string, string> {
  const values: Record<string, string> = {
    host: draft.host.trim(),
    port: draft.port.trim(),
    security: draft.security,
    username: draft.username.trim(),
    fromName: draft.fromName.trim(),
    fromAddress: draft.fromAddress.trim(),
    replyTo: draft.replyTo.trim(),
  };
  if (draft.password !== "") values["password"] = draft.password;
  return values;
}

export interface SmtpStatus {
  enabled: boolean;
  configured: boolean;
  last: { at: string; sent: boolean; error: string | null } | null;
}

/**
 * What the card's bar says. The same words as the Integration cards, 1 to 2 of
 * them, since a badge never wraps (design-system.md section 10, Content).
 */
export function smtpBadge(
  enabled: boolean,
  status: SmtpStatus | null
): { tone: "neutral" | "success" | "warning"; label: string } {
  if (!enabled) return { tone: "neutral", label: "Not connected" };
  if (status && status.last && !status.last.sent) return { tone: "warning", label: "Send failed" };
  return { tone: "success", label: "Connected" };
}

/**
 * The card's banner when the latest send through the site's server failed, or
 * null. A success needs no banner: the badge already says Connected.
 */
export function lastSendFailure(status: SmtpStatus | null): string | null {
  if (!status || !status.enabled || !status.last || status.last.sent) return null;
  return `${status.last.error ?? "Your server refused it."} The email went out from MemberFrame instead.`;
}
