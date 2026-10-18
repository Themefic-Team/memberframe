/**
 * Section locks, plugin side. Development doc: docs/development-docs/19-section-locks.md
 *
 * The rules are enforced by the Route Shield in the backend, which has its own
 * tests. What is proved here is the part the creator touches: the override
 * names Framer will list, the MemberLocks file those come from (compiled and
 * run), the name validation the server repeats, and the "Who sees it" choices
 * built from the site's own tiers.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import {
  SECTION_LOCK_NAME_PATTERN,
  newSectionLock,
  normalizeSectionLockName,
  parseWhoSees,
  sectionLockNameProblem,
  sectionLockOverrideNames,
  sectionLockSlug,
  sectionLocksCode,
  whoSeesOptions,
  whoSeesValue,
} from "../src/services/sectionLocks";
import type { SectionLockRule } from "../src/types/connection";

const TIERS = [
  { key: "free_member", name: "Free", rank: 0 },
  { key: "tier_gold", name: "Gold", rank: 2 },
  { key: "tier_silver", name: "Silver", rank: 1 },
];

const rule = (name: string, enabled = true): SectionLockRule => ({
  name,
  enabled,
  audience: "members",
  requiredTier: "signed_in",
  lockedAction: "hide",
});

describe("names", () => {
  it("tidies a rule name and slugs it the way the server does", () => {
    expect(normalizeSectionLockName("  Gold   article ")).toBe("Gold article");
    expect(sectionLockSlug("  Gold   Article ")).toBe("gold-article");
    expect(sectionLockSlug("v2.0 promo")).toBe("v2-0-promo");
  });

  it("refuses an empty name, a character that could reach a selector, and a duplicate", () => {
    expect(sectionLockNameProblem([rule("Gold article")], 0)).toBeNull();
    expect(sectionLockNameProblem([rule("  ")], 0)).toMatch(/name/);
    expect(sectionLockNameProblem([rule('Gold"]')], 0)).toMatch(/letters/);
    expect(sectionLockNameProblem([rule("Gold Article"), rule("gold-article")], 1)).toMatch(/Another/);
  });

  it("holds the server's pattern character for character", () => {
    const server = readFileSync(
      path.join(process.cwd(), "..", "memberframe-backend", "src", "lib", "siteSettings.ts"),
      "utf-8"
    );
    expect(server).toContain(`SECTION_LOCK_NAME_PATTERN = ${SECTION_LOCK_NAME_PATTERN.toString()};`);
  });
});

describe("the override names Framer lists", () => {
  it("is each rule's name as one word", () => {
    expect(sectionLockOverrideNames([rule("Experience"), rule("Gold article"), rule("2024 promo")])).toEqual([
      "Experience",
      "GoldArticle",
      "Lock2024Promo",
    ]);
  });

  it("never repeats a name", () => {
    expect(sectionLockOverrideNames([rule("goldArticle"), rule("gold article")])).toEqual([
      "GoldArticle",
      "GoldArticle2",
    ]);
  });
});

describe("the MemberLocks file", () => {
  const RULES = [rule("Experience"), rule("Gold article", false), rule('bad"name')];
  const code = sectionLocksCode(RULES);

  it("exports one override per valid lock, paused ones included, and skips invalid ones", () => {
    const exported = [...code.matchAll(/export function (\w+)\(/g)].map((match) => match[1]);
    expect(exported).toEqual(["Experience", "GoldArticle"]);
    expect(code).not.toContain("bad");
  });

  it("compiles, and an override tags the layer and keeps its own class", () => {
    const js = ts.transpileModule(code, {
      compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
    }).outputText;

    const created: Array<{ type: unknown; props: Record<string, unknown> }> = [];
    const react = { createElement: (type: unknown, props: Record<string, unknown>) => created.push({ type, props }) };
    const exports: Record<string, (component: unknown) => (props: Record<string, unknown>) => unknown> = {};
    // eslint-disable-next-line no-new-func
    new Function("exports", "require", js)(exports, (id: string) => (id === "react" ? react : undefined));

    const Layer = "Layer";
    exports.GoldArticle!(Layer)({ className: "framer-abc", style: { width: 1 } });

    expect(created[0]!.type).toBe(Layer);
    expect(created[0]!.props).toEqual({
      className: "framer-abc mf-lock-gold-article",
      style: { width: 1 },
      "data-mf-lock": "Gold article",
    });
  });

  it("says where to edit, and is still a valid file with no locks", () => {
    expect(code).toContain("Edit your");
    expect(sectionLocksCode([])).toContain("No section locks yet");
    expect(sectionLocksCode([])).not.toContain("export function");
  });
});

describe("whoSeesOptions", () => {
  it("offers signed in and out, then a pair per paid tier by rank, never Free", () => {
    expect(whoSeesOptions(TIERS).map((option) => option.label)).toEqual([
      "Any signed-in member",
      "Signed-out visitors only",
      "Silver members or higher",
      "Everyone without Silver",
      "Gold members or higher",
      "Everyone without Gold",
    ]);
  });

  it("round-trips a rule's audience and tier", () => {
    const value = whoSeesValue({ audience: "others", requiredTier: "tier_gold" });
    expect(value).toBe("others:tier_gold");
    expect(parseWhoSees(value)).toEqual({ audience: "others", requiredTier: "tier_gold" });
    expect(parseWhoSees("nonsense")).toEqual({ audience: "members", requiredTier: "signed_in" });
  });
});

describe("newSectionLock", () => {
  it("picks a name no other rule has", () => {
    expect(newSectionLock([]).name).toBe("Section lock 1");
    expect(newSectionLock([rule("Section lock 2")]).name).toBe("Section lock 3");
  });
});
