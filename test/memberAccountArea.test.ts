/**
 * The account area's own rules in `<MemberDashboard>`
 * (docs/development-docs/33-member-account.md): which sections show, the
 * `#account-<section>` address, the photo checks, and the delete
 * confirmation. The marked block is transpiled and run, as the appearance
 * block is in canvasAppearanceParity.test.ts.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const source = readFileSync(path.join(process.cwd(), "src", "canvas-components", "MemberDashboard.tsx"), "utf8");
const START = "// @memberframe-account-start";
const END = "// @memberframe-account-end";

type Section = "overview" | "membership" | "billing" | "bookmarks" | "profile" | "security";

interface AccountHelpers {
  visibleSections(toggles: Record<string, boolean> | null | undefined, legacy: { showBilling: boolean; showProfile: boolean }): Section[];
  sectionFromHash(hash: string, shown: Section[]): Section | null;
  pickSection(preferred: unknown, shown: Section[]): Section;
  avatarProblem(file: { type: string; size: number }): "type" | "size" | null;
  confirmsDeleteEmail(typed: string, email: string): boolean;
  providerName(provider: string): string;
  safeItemHref(url: string): string | null;
}

const helpers = (() => {
  const start = source.indexOf(START);
  const end = source.indexOf(END);
  if (start === -1 || end === -1) throw new Error("account markers missing");
  const js = ts.transpileModule(source.slice(start, end), { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
  const names = ["visibleSections", "sectionFromHash", "pickSection", "avatarProblem", "confirmsDeleteEmail", "providerName", "safeItemHref"];
  return new Function(`${js}\nreturn { ${names.join(", ")} };`)() as AccountHelpers;
})();

const ALL = { showBilling: true, showProfile: true };

describe("visibleSections", () => {
  it("shows every section in menu order by default", () => {
    expect(helpers.visibleSections(undefined, ALL)).toEqual(["overview", "membership", "billing", "bookmarks", "profile", "security"]);
  });

  it("hides a section turned off in Sections", () => {
    expect(helpers.visibleSections({ bookmarks: false, security: false }, ALL)).toEqual(["overview", "membership", "billing", "profile"]);
  });

  it("keeps the older controls working: Billing off hides Membership and Billing, Profile Form off hides Profile", () => {
    expect(helpers.visibleSections(undefined, { showBilling: false, showProfile: false })).toEqual(["overview", "bookmarks", "security"]);
  });

  it("never shows an empty menu", () => {
    const off = { overview: false, membership: false, billing: false, bookmarks: false, profile: false, security: false };
    expect(helpers.visibleSections(off, ALL)).toEqual(["overview"]);
  });
});

describe("the #account-<section> address", () => {
  const shown: Section[] = ["overview", "billing", "security"];

  it("names a section that shows", () => {
    expect(helpers.sectionFromHash("#account-billing", shown)).toBe("billing");
  });

  it("ignores another hash, an unknown section, and a hidden one", () => {
    expect(helpers.sectionFromHash("#sign-in", shown)).toBeNull();
    expect(helpers.sectionFromHash("#account-orders", shown)).toBeNull();
    expect(helpers.sectionFromHash("#account-bookmarks", shown)).toBeNull();
    expect(helpers.sectionFromHash("", shown)).toBeNull();
  });

  it("falls back to the first section shown", () => {
    expect(helpers.pickSection("security", shown)).toBe("security");
    expect(helpers.pickSection("profile", shown)).toBe("overview");
    expect(helpers.pickSection(undefined, ["billing"])).toBe("billing");
  });
});

describe("the photo checks before upload", () => {
  it("takes PNG, JPEG, and WebP up to 2 MB", () => {
    expect(helpers.avatarProblem({ type: "image/png", size: 1024 })).toBeNull();
    expect(helpers.avatarProblem({ type: "image/jpeg", size: 2 * 1024 * 1024 })).toBeNull();
    expect(helpers.avatarProblem({ type: "image/webp", size: 10 })).toBeNull();
  });

  it("refuses another type, SVG included, and anything larger", () => {
    expect(helpers.avatarProblem({ type: "image/svg+xml", size: 10 })).toBe("type");
    expect(helpers.avatarProblem({ type: "image/gif", size: 10 })).toBe("type");
    expect(helpers.avatarProblem({ type: "image/png", size: 2 * 1024 * 1024 + 1 })).toBe("size");
  });
});

describe("deleting the account", () => {
  it("needs the member's own address, typed in", () => {
    expect(helpers.confirmsDeleteEmail(" Member@Example.com ", "member@example.com")).toBe(true);
    expect(helpers.confirmsDeleteEmail("member@example.co", "member@example.com")).toBe(false);
    expect(helpers.confirmsDeleteEmail("", "")).toBe(false);
  });

  it("asks before deleting, and is refused while a plan renews", () => {
    expect(source).toContain('setConfirm({ kind: "delete" })');
    expect(source).toContain('reason === "active_plan"');
    expect(source).toContain("confirm?.kind === \"delete\" && !confirmsDeleteEmail(deleteEmail, member.email)");
  });
});

describe("saved items and sign-in methods", () => {
  it("opens only an https address or a page on this site", () => {
    expect(helpers.safeItemHref("https://example.com/a")).toBe("https://example.com/a");
    expect(helpers.safeItemHref("/articles/a")).toBe("/articles/a");
    expect(helpers.safeItemHref("//evil.example.com")).toBeNull();
    expect(helpers.safeItemHref("javascript:alert(1)")).toBeNull();
  });

  it("names each provider", () => {
    expect(helpers.providerName("github")).toBe("GitHub");
    expect(helpers.providerName("other")).toBe("other");
  });
});

describe("the menu and the address", () => {
  it("keeps Framer's history state when it changes the section", () => {
    expect(source).toContain("window.history.pushState(window.history.state,");
    expect(source).toContain('window.addEventListener("popstate", follow);');
  });

  it("shows the section the creator picked on the canvas", () => {
    expect(source).toContain("onCanvas ? pickSection(canvasSection, shown)");
  });

  it("switches to a top menu below 720px, or when Navigation says so", () => {
    expect(source).toContain("@container (max-width: 719px)");
    expect(source).toContain('${topNavRules(".mf-acct.is-nav-top")}');
  });
});
