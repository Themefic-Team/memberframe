import React from "react";
import { Checkbox, FieldRow, FieldRows, TextField } from "../ui";
import { AUTH_PATH_FIELDS, isSafeSitePath } from "../../services/siteSettingsService";
import type { AuthSettings } from "../../types/connection";
import { PASSWORD_MIN_LENGTH, PASSWORD_POLICY_MAX_MIN, readPasswordPolicy, type PasswordPolicy } from "../../utils/credentials";

/** Why these rules cannot be saved, or null. Only the minimum can be wrong. */
export function passwordPolicyProblem(policy: PasswordPolicy | undefined): string | null {
  if (!policy) return null;
  const length = policy.minLength;
  return Number.isInteger(length) && length >= PASSWORD_MIN_LENGTH && length <= PASSWORD_POLICY_MAX_MIN
    ? null
    : `Choose a minimum between ${PASSWORD_MIN_LENGTH} and ${PASSWORD_POLICY_MAX_MIN} characters.`;
}

/** The rules in one sentence, as a member will meet them. */
export function passwordPolicySummary(policy: PasswordPolicy): string {
  const extras = [
    policy.requireNumber ? "a number" : "",
    policy.requireUppercase ? "an uppercase letter" : "",
    policy.requireLowercase ? "a lowercase letter" : "",
    policy.requireSymbol ? "a symbol" : "",
  ].filter(Boolean);
  const list = extras.length > 1 ? `${extras.slice(0, -1).join(", ")} and ${extras[extras.length - 1]}` : extras[0] ?? "";
  return `At least ${policy.minLength} characters, with a letter${list ? `, ${list}` : ""}.`;
}

const RULE_TOGGLES: ReadonlyArray<{ key: "requireNumber" | "requireUppercase" | "requireLowercase" | "requireSymbol"; label: string }> = [
  { key: "requireNumber", label: "Require a number" },
  { key: "requireUppercase", label: "Require an uppercase letter" },
  { key: "requireLowercase", label: "Require a lowercase letter" },
  { key: "requireSymbol", label: "Require a symbol" },
];

export interface MembershipSettingsProps {
  value: AuthSettings;
  onChange: (next: AuthSettings) => void;
  disabled?: boolean;
}

/**
 * The membership paths and policy. Feature plan FP-02, FP-08.
 *
 * ## Why these five fields matter more than they look
 *
 * They are the only place that says where a membership lives. A page lock
 * redirects a signed-out visitor to `loginPath`, the password reset email links
 * to `resetPath`, `<MemberAuth>` sends a member to `afterLoginPath` once signed
 * in, and the Builder tab creates exactly these pages. Every one of those is
 * baked into a deployed component or an email, so a wrong value here is found
 * by a visitor rather than by the creator.
 *
 * That is also why the Builder tab builds pages from these fields rather than
 * from its own list. One source of truth means a creator who sets
 * `/members/sign-in` gets that page, and cannot end up with a `/login` page
 * nothing points at.
 *
 * ## Validation is inline and it blocks the save
 *
 * `//evil.com` begins with a slash and is not a path: a browser reads it as
 * protocol-relative and leaves the site, so a value like it turns every
 * component that redirects into an open redirect. The server refuses it too.
 * This copy exists so the creator is told before they submit.
 *
 * ## Only what the server enforces lives here
 *
 * "Sign in opens with" was removed: nothing read it. Each `<MemberAuth>` has
 * its own Default Method control in Framer. The password rules are here, not
 * on each component (05-member-auth.md 13): the server enforces them on sign
 * up and reset, and every form on the site follows them without a republish. "Allow new sign ups" stays because the server
 * enforces it, so it closes registration for every sign in component on the
 * site and for anyone calling the API directly, which no canvas control can.
 */
export const MembershipSettings: React.FC<MembershipSettingsProps> = ({
  value,
  onChange,
  disabled = false,
}) => {
  const set = <Key extends keyof AuthSettings>(key: Key, next: AuthSettings[Key]): void =>
    onChange({ ...value, [key]: next });
  // The stored rules, or the defaults for an older server; the minimum as typed.
  const policy: PasswordPolicy = value.passwordPolicy ?? readPasswordPolicy(undefined);
  const setPolicy = (next: Partial<PasswordPolicy>) =>
    onChange({ ...value, passwordPolicy: { ...policy, ...next }, requirePasswordStrength: next.requireNumber ?? policy.requireNumber });
  const policyProblem = passwordPolicyProblem(policy);

  return (
    <>
      <FieldRows>
        {AUTH_PATH_FIELDS.map((spec) => {
          const current = value[spec.field];
          const invalid = !isSafeSitePath(current);

          return (
            <FieldRow
              key={spec.field}
              label={spec.label}
              htmlFor={`settings-${spec.field}`}
              hint={spec.hint}
            >
              <TextField
                id={`settings-${spec.field}`}
                value={current}
                invalid={invalid}
                disabled={disabled}
                placeholder="/login"
                onChange={(next) => set(spec.field, next)}
              />
            </FieldRow>
          );
        })}
      </FieldRows>

      {/*
        One message for the whole group rather than one per field. At 360px,
        five inline errors is a wall, and the rule is the same for all five, so
        saying it once is clearer than saying it five times.
      */}
      {AUTH_PATH_FIELDS.some((spec) => !isSafeSitePath(value[spec.field])) ? (
        <p className="settings-help settings-help-problem">
          Each path starts with one slash and stays on this site, for example /login.
        </p>
      ) : null}

      <FieldRows>
        {/*
          A checkbox, not a toggle. PRD section 7.5 reserves the toggle for
          instant-apply controls, and nothing here applies until Save.
        */}
        <FieldRow
          label="Allow new sign ups"
          htmlFor="settings-allow-registration"
          hint={
            value.allowRegistration
              ? "Visitors can create an account with a password or Google and the like. Email code sign in is for existing members only."
              : "The server refuses new accounts. Existing members can still sign in."
          }
        >
          <Checkbox
            id="settings-allow-registration"
            checked={value.allowRegistration}
            disabled={disabled}
            onChange={(checked) => set("allowRegistration", checked)}
          />
        </FieldRow>
      </FieldRows>

      {/*
        Password rules, for sign up and reset on every form on this site. Sign
        in never checks them, so a member whose password predates a stricter
        rule still signs in and meets it at their next reset.
      */}
      <FieldRows>
        <FieldRow
          label="Minimum password length"
          htmlFor="settings-password-min"
          hint={`From ${PASSWORD_MIN_LENGTH} to ${PASSWORD_POLICY_MAX_MIN} characters.`}
        >
          <TextField
            id="settings-password-min"
            inputMode="numeric"
            value={Number.isFinite(policy.minLength) && policy.minLength > 0 ? String(policy.minLength) : ""}
            invalid={policyProblem !== null}
            disabled={disabled}
            placeholder="8"
            onChange={(next) => setPolicy({ minLength: Number.parseInt(next.replace(/[^0-9]/g, ""), 10) || 0 })}
          />
        </FieldRow>
        {RULE_TOGGLES.map((rule) => (
          <FieldRow key={rule.key} label={rule.label} htmlFor={`settings-password-${rule.key}`}>
            <Checkbox
              id={`settings-password-${rule.key}`}
              checked={policy[rule.key]}
              disabled={disabled}
              onChange={(checked) => setPolicy({ [rule.key]: checked })}
            />
          </FieldRow>
        ))}
      </FieldRows>
      <p className={policyProblem ? "settings-help settings-help-problem" : "settings-help"}>
        {policyProblem ?? `${passwordPolicySummary(policy)} Used on sign up and password reset. Sign in is not affected.`}
      </p>

    </>
  );
};
