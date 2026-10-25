/**
 * Section locks, plugin side. Development doc: docs/development-docs/19-section-locks.md
 *
 * The rules are enforced by the Route Shield in the backend, which has its own
 * tests. What is proved here is the part the creator touches: the override
 * names Framer will list, the MemberFrameLocks file those come from (compiled and
 * run), the name validation the server repeats, and the "Who sees it" choices
 * built from the site's own tiers.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import {
  LEGACY_SECTION_LOCKS_FILE_NAME,
  SECTION_LOCKS_FILE_NAME,
  SECTION_LOCK_NAME_PATTERN,
  sectionLocksFilesToWrite,
  newSectionLock,
  normalizeSectionLockName,
  parseWhoSees,
  sectionLockNameProblem,
  sectionLockOverrideNames,
  sectionLockSlug,
  sectionLocksCode,
  staleSectionLocksFile,
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

describe("the MemberFrameLocks file", () => {
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
    // forwardRef returns its render function, so the test can call it with a ref.
    const react = {
      createElement: (type: unknown, props: Record<string, unknown>) => created.push({ type, props }),
      forwardRef: (render: (props: Record<string, unknown>, ref: unknown) => unknown) => render,
    };
    const exports: Record<string, (component: unknown) => (props: Record<string, unknown>, ref: unknown) => unknown> = {};
    // eslint-disable-next-line no-new-func
    new Function("exports", "require", js)(exports, (id: string) => (id === "react" ? react : undefined));

    const Layer = "Layer";
    const ref = { current: null };
    exports.GoldArticle!(Layer)({ className: "framer-abc", style: { width: 1 } }, ref);

    expect(created[0]!.type).toBe(Layer);
    // The ref reaches the layer: Framer's appear effects need it, or the layer stays invisible.
    expect(created[0]!.props).toEqual({
      className: "framer-abc mf-lock-gold-article",
      style: { width: 1 },
      ref,
      "data-mf-lock": "Gold article",
    });
    expect(code).toContain("return React.forwardRef(function Locked(props: any, ref: any) {");
  });

  it("rewrites on open only a file from before the overrides kept the ref", () => {
    const old = code.replace("return React.forwardRef(function Locked(props: any, ref: any) {", "function Locked(props: any) {");
    expect(staleSectionLocksFile(old, RULES)).toBe(true);
    expect(staleSectionLocksFile(code, RULES)).toBe(false);
    // A current file listing other rules waits for Save locks.
    expect(staleSectionLocksFile(sectionLocksCode([rule("Other")]), RULES)).toBe(false);
  });

  it("says where to edit, and is still a valid file with no locks", () => {
    expect(code).toContain("Edit your");
    expect(code).toContain("choose File MemberFrameLocks");
    expect(sectionLocksCode([])).toContain("No section locks yet");
    expect(sectionLocksCode([])).not.toContain("export function");
  });
});

describe("the locks file's name", () => {
  it("is MemberFrameLocks, and MemberLocks is only the old name", () => {
    expect(SECTION_LOCKS_FILE_NAME).toBe("MemberFrameLocks.tsx");
    expect(LEGACY_SECTION_LOCKS_FILE_NAME).toBe("MemberLocks.tsx");
  });

  it("a save writes MemberFrameLocks when there are locks, never creating it for nothing", () => {
    expect(sectionLocksFilesToWrite([], 2)).toEqual(["MemberFrameLocks.tsx"]);
    expect(sectionLocksFilesToWrite([], 0)).toEqual([]);
    // A lock was removed: the existing file is rewritten so its override goes too.
    expect(sectionLocksFilesToWrite(["MemberFrameLocks.tsx"], 0)).toEqual(["MemberFrameLocks.tsx"]);
  });

  it("keeps an older project's MemberLocks in step, so layers picked from it stay locked", () => {
    expect(sectionLocksFilesToWrite(["MemberLocks.tsx"], 1)).toEqual(["MemberFrameLocks.tsx", "MemberLocks.tsx"]);
    expect(sectionLocksFilesToWrite(["MemberLocks.tsx", "MemberFrameLocks.tsx"], 0)).toEqual(["MemberFrameLocks.tsx", "MemberLocks.tsx"]);
  });
});

describe("whoSeesOptions", () => {
  it("offers the shared list: who gets in, then who is kept out, never Free", () => {
    expect(whoSeesOptions(TIERS).map((option) => `${option.group}: ${option.label}`)).toEqual([
      "Who gets in: Any signed-in member",
      "Who gets in: Any paid plan",
      "Who gets in: Silver members or higher",
      "Who gets in: Gold members or higher",
      "Who gets in: Only chosen tiers…",
      "Who is kept out: Signed-out visitors only",
      "Who is kept out: Everyone without Silver",
      "Who is kept out: Everyone without Gold",
      "Who is kept out: Everyone except chosen tiers…",
    ]);
  });

  it("carries exact tiers through the choice, keeping the ticks, else ticking the lowest paid tier", () => {
    expect(whoSeesValue({ audience: "others", requiredTier: "only:tier_silver,tier_gold" })).toBe("others:__only__");
    expect(parseWhoSees("members:__only__", { requiredTier: "only:tier_gold" }, TIERS)).toEqual({ audience: "members", requiredTier: "only:tier_gold" });
    expect(parseWhoSees("members:__only__", { requiredTier: "signed_in" }, TIERS).requiredTier).toMatch(/^only:/);
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
