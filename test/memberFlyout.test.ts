/**
 * The member panel in Manage (2026-10-22 redesign): who the member is at a
 * glance, the two everyday actions side by side, each section in its own
 * well, a profile that lists answers rather than a wall of "Not answered",
 * and Delete last, as a danger button.
 */

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MemberFlyout } from "../src/components/manage/MemberFlyout";
import type { SiteMemberRecord } from "../src/types/site";
import type { CustomFieldDefinition } from "../src/utils/customFields";

const member = {
  id: "m1",
  email: "sydur@example.com",
  name: "Sydur Rahman",
  avatarUrl: null,
  tier: "free_member",
  status: "active",
  createdAt: "2026-10-20T10:00:00Z",
  lifetimeSpend: 0,
  currency: "USD",
  gateway: "stripe",
  signupMethod: "email",
  identities: [],
  hasPassword: true,
  metadata: { first_name: "Sydur" },
} as unknown as SiteMemberRecord;

const field = (key: string, label: string): CustomFieldDefinition =>
  ({ key, label, type: "text", required: false, options: [], placeholder: "", order: 0, showWhen: null }) as CustomFieldDefinition;

const render = (over: Partial<SiteMemberRecord> = {}, fields: CustomFieldDefinition[] = []) =>
  renderToStaticMarkup(
    React.createElement(MemberFlyout, {
      member: { ...member, ...over },
      busy: false,
      onAction: () => undefined,
      onClose: () => undefined,
      profileFields: fields,
    })
  );

describe("the member panel", () => {
  it("shows the member at a glance: initials, name, email, plan, and status", () => {
    const html = render();
    expect(html).toContain('<span class="member-avatar" aria-hidden="true">SR</span>');
    expect(html).toContain("sydur@example.com");
    expect(html).toMatch(/class="badge badge-success">Active</);
  });

  it("puts the two everyday actions side by side, and Delete last, as a danger button", () => {
    const html = render();
    const actions = html.slice(html.indexOf("member-flyout-actions"), html.indexOf("Sign-in methods"));
    expect(actions).toContain("Send magic link");
    expect(actions).toContain("Revoke access");
    expect(actions).not.toContain("Delete member");
    const danger = html.slice(html.indexOf("member-flyout-danger"));
    expect(danger).toMatch(/class="btn btn-danger btn-md fill"[^>]*>.*Delete member/);
  });

  it("lists profile answers, and names the unanswered in one line", () => {
    const html = render({}, [field("first_name", "First Name"), field("phone", "Phone Number"), field("address", "Address")]);
    expect(html).toContain("1 of 3 answered");
    expect(html).toContain("First Name");
    expect(html).toContain("Not answered: Phone Number, Address");
    expect(html.match(/Not answered/g)?.length).toBe(1);
  });

  it("says No answers yet rather than listing every question", () => {
    const html = render({ metadata: {} } as Partial<SiteMemberRecord>, [field("phone", "Phone Number"), field("address", "Address")]);
    expect(html).toContain("0 of 2 answered");
    expect(html).toContain("No answers yet.");
    expect(html).not.toContain("Phone Number");
  });

  it("shows the password as a badge", () => {
    expect(render()).toMatch(/class="badge badge-success">Set</);
    expect(render({ hasPassword: false })).toMatch(/class="badge badge-neutral">Not set</);
  });
});
