/**
 * 05-member-auth.md 13: the creator sets the password rules once, in
 * Settings, Membership; the server enforces them and every form shows them.
 */

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MembershipSettings, passwordPolicyProblem, passwordPolicySummary } from "../src/components/settings/MembershipSettings";
import type { AuthSettings } from "../src/types/connection";

const auth: AuthSettings = {
  loginPath: "/login",
  signupPath: "/signup",
  resetPath: "/reset-password",
  afterLoginPath: "/dashboard",
  afterLogoutPath: "/",
  allowRegistration: true,
  defaultMethod: "password",
  requirePasswordStrength: true,
  rememberMeDays: 30,
};

const component = readFileSync(join(__dirname, "..", "src", "canvas-components", "MemberAuth.tsx"), "utf8");

describe("the rules in Settings, Membership", () => {
  it("say what a member will meet, in one sentence", () => {
    expect(passwordPolicySummary({ minLength: 8, requireNumber: true, requireUppercase: false, requireLowercase: false, requireSymbol: false })).toBe(
      "At least 8 characters, with a letter, a number."
    );
    expect(passwordPolicySummary({ minLength: 12, requireNumber: true, requireUppercase: true, requireLowercase: false, requireSymbol: true })).toBe(
      "At least 12 characters, with a letter, a number, an uppercase letter and a symbol."
    );
  });

  it("refuse a minimum outside 8 to 64 before saving", () => {
    const base = { minLength: 8, requireNumber: true, requireUppercase: false, requireLowercase: false, requireSymbol: false };
    expect(passwordPolicyProblem(base)).toBeNull();
    expect(passwordPolicyProblem({ ...base, minLength: 5 })).toMatch(/between 8 and 64/);
    expect(passwordPolicyProblem({ ...base, minLength: 80 })).toMatch(/between 8 and 64/);
    expect(passwordPolicyProblem(undefined)).toBeNull();
  });

  it("show the length and the four rules, defaults for an older server", () => {
    const html = renderToStaticMarkup(React.createElement(MembershipSettings, { value: auth, onChange: () => undefined }));
    for (const label of ["Minimum password length", "Require a number", "Require an uppercase letter", "Require a lowercase letter", "Require a symbol"]) {
      expect(html).toContain(label);
    }
    expect(html).toContain("Used on sign up and password reset. Sign in is not affected.");
  });
});

describe("the forms", () => {
  it("show the site's rules under the password field where one is chosen", () => {
    expect(component).toContain('{choosingPassword && !passwordProblem ? <p className="memberframe-auth-rules">{passwordRulesLine(rules)}</p> : null}');
    expect(component).toContain("function passwordRulesLine(rules: PasswordPolicy): string {");
  });

  it("name the minimum the site set when a password is too short", () => {
    expect(component).toContain("return `Use at least ${rules.minLength} characters.`;");
  });
});
