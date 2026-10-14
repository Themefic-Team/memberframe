import React from "react";
import { Checkbox, FieldRow, FieldRows, Segmented, TextField } from "../ui";
import { AUTH_PATH_FIELDS, isSafeSitePath } from "../../services/siteSettingsService";
import type { AuthSettings } from "../../types/connection";

export interface MembershipSettingsProps {
  value: AuthSettings;
  onChange: (next: AuthSettings) => void;
  disabled?: boolean;
}

const METHOD_OPTIONS = [
  { value: "password", label: "Password" },
  { value: "otp", label: "Email code" },
] as const satisfies ReadonlyArray<{ value: AuthSettings["defaultMethod"]; label: string }>;

/**
 * The membership paths and policy. Feature plan FP-02, FP-08.
 *
 * ## Why these five fields matter more than they look
 *
 * They are the only place that says where a membership lives. `<MemberGate>`
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
 */
export const MembershipSettings: React.FC<MembershipSettingsProps> = ({
  value,
  onChange,
  disabled = false,
}) => {
  const set = <Key extends keyof AuthSettings>(key: Key, next: AuthSettings[Key]): void =>
    onChange({ ...value, [key]: next });

  return (
    <>
      <FieldRows>
        {AUTH_PATH_FIELDS.map((spec) => {
          const current = value[spec.field];
          const invalid = !isSafeSitePath(current);

          return (
            <FieldRow key={spec.field} label={spec.label} htmlFor={`settings-${spec.field}`}>
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
      ) : (
        <p className="settings-help">
          The Builder tab creates these pages for you, and gates and emails point at them.
        </p>
      )}

      <FieldRows>
        <FieldRow label="Sign in opens with" fill>
          {/*
            A segmented control rather than a select: two options, and the
            choice is visible without opening anything. It still only takes
            effect on save, which is why the group below it is checkboxes.
          */}
          <Segmented
            label="Sign in opens with"
            options={METHOD_OPTIONS}
            value={value.defaultMethod}
            onChange={(next) => set("defaultMethod", next)}
          />
        </FieldRow>

        {/*
          A checkbox, not a toggle. PRD section 7.5 reserves the toggle for
          instant-apply controls, and nothing here applies until Save.
        */}
        <FieldRow label="Allow new sign ups" htmlFor="settings-allow-registration">
          <Checkbox
            id="settings-allow-registration"
            checked={value.allowRegistration}
            disabled={disabled}
            onChange={(checked) => set("allowRegistration", checked)}
          />
        </FieldRow>

        <FieldRow label="Require a strong password" htmlFor="settings-strong-password">
          <Checkbox
            id="settings-strong-password"
            checked={value.requirePasswordStrength}
            disabled={disabled}
            onChange={(checked) => set("requirePasswordStrength", checked)}
          />
        </FieldRow>
      </FieldRows>

      <p className="settings-help">
        {value.defaultMethod === "otp"
          ? "Email codes are not built yet, so visitors see the password form until they are."
          : value.allowRegistration
            ? "Visitors can create an account from the sign in page."
            : "Only members you add can sign in. The sign up form is hidden."}
      </p>
    </>
  );
};
