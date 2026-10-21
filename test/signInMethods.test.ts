/**
 * 31-sign-in-methods.md: Manage shows how each member signs in. One account
 * per email, so Google and then GitHub on the same address are two linked
 * sign ins on one member.
 */

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MemberSignInMethods, signupMethodLabel } from "../src/components/manage/MemberFlyout";
import type { SiteMemberRecord } from "../src/types/site";

const base: SiteMemberRecord = {
  id: "m1",
  email: "ada@example.com",
  name: "Ada",
  avatarUrl: null,
  tier: "free_member",
  status: "active",
  createdAt: "2026-10-20T10:00:00Z",
  lifetimeSpend: 0,
  currency: "USD",
  gateway: "stripe",
} as SiteMemberRecord;

const render = (member: Partial<SiteMemberRecord>) =>
  renderToStaticMarkup(React.createElement(MemberSignInMethods, { member: { ...base, ...member } }));

describe("signupMethodLabel", () => {
  it("names each way an account is made, and says so when it was not recorded", () => {
    expect(signupMethodLabel("google")).toBe("Google");
    expect(signupMethodLabel("github")).toBe("GitHub");
    expect(signupMethodLabel("email")).toBe("Email and password");
    expect(signupMethodLabel("added")).toBe("Added by you");
    expect(signupMethodLabel(null)).toBe("Not recorded");
  });
});

describe("the Sign-in methods section", () => {
  it("lists the provider it was made with and every linked sign in", () => {
    const html = render({
      signupMethod: "google",
      hasPassword: false,
      identities: [
        { provider: "google", email: "ada@example.com", createdAt: "2026-10-20T10:00:00Z", lastUsedAt: "2026-10-20T10:00:00Z" },
        { provider: "github", email: "ada@example.com", createdAt: "2026-10-21T10:00:00Z", lastUsedAt: "2026-10-21T10:00:00Z" },
      ],
    });
    expect(html).toContain("Sign-in methods");
    expect(html).toMatch(/Signed up with<\/dt><dd class="member-profile-value">Google, /);
    expect(html).toContain("GitHub");
    expect(html).toContain("ada@example.com. Last used");
    expect(html).toContain("Not set");
  });

  it("says Not recorded for an older member, and None when nothing is linked", () => {
    const html = render({ signupMethod: null, identities: [], hasPassword: true });
    expect(html).toContain("Not recorded");
    expect(html).toContain("None");
    expect(html).toContain(">Set<");
  });

  it("renders nothing for a backend that sends neither field", () => {
    expect(render({})).toBe("");
  });
});

describe("the member row", () => {
  it("shows the signup provider's mark, named for screen readers", () => {
    const row = readFileSync(join(__dirname, "..", "src", "components", "manage", "MemberRow.tsx"), "utf8");
    expect(row).toContain("isSignInProvider(member.signupMethod) ? (");
    expect(row).toContain("aria-label={`Signed up with ${SIGN_IN_PROVIDER_NAMES[member.signupMethod]}`}");
  });
});
