/**
 * The auth card is the component's frame (product owner, 2026-10-19): a fixed
 * width, no padding band around the card, and the trial mark inside the card's
 * bottom corner rather than in empty space below it.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const auth = readFileSync(join(__dirname, "..", "src", "canvas-components", "MemberAuth.tsx"), "utf8");
const builder = readFileSync(join(__dirname, "..", "src", "components", "tabs", "BuilderTab.tsx"), "utf8");

describe("the auth card fills its frame", () => {
  it("inserts every component at a fixed width and height, the paywall and dashboard fitting their content", () => {
    const sizes: Record<string, [string, string]> = {
      member_auth: ["400px", "620px"],
      member_login: ["400px", "600px"],
      member_register: ["400px", "680px"],
      member_password_reset: ["400px", "440px"],
      member_otp_verify: ["400px", "420px"],
      member_dashboard: ["480px", "fit-content"],
      member_pricing: ["960px", "600px"],
      metered_paywall: ["640px", "fit-content"],
      protected_download: ["340px", "88px"],
      bookmark_button: ["44px", "44px"],
      bookmarks_tray: ["44px", "44px"],
    };
    for (const [id, [width, height]] of Object.entries(sizes)) {
      expect(builder).toContain(`${id}: { width: "${width}", height: "${height}",`);
    }
    expect(builder).not.toMatch(/width: "100%", height/);
    expect(auth).toContain("@framerIntrinsicWidth 400");
    expect(auth).toContain("justify-content: safe center;");
  });

  it("has no padding band around the card, and the card is not capped narrower than the frame", () => {
    expect(auth).not.toContain("padding: clamp(48px, 8vh, 80px) 24px;");
    expect(auth).not.toMatch(/\.memberframe-auth-card \{[^}]*max-width: 440px/);
  });

  it("keeps room inside the card for the trial mark", () => {
    expect(auth).toContain('license === "trial" ? " has-mf-wm" : ""');
    expect(auth).toContain(".memberframe-auth-root.has-mf-wm:not(.is-modal) .memberframe-auth-card");
  });
});
