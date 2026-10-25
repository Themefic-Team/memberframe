/**
 * Section locks: rules a creator writes, picked per layer in Framer's sidebar.
 * Development doc: `docs/development-docs/19-section-locks.md`.
 *
 * Saving the rules writes `MemberFrameLocks.tsx` into the creator's project,
 * with one code override per rule, named after it. In Framer the creator
 * selects a layer and picks the rule under Code overrides, File
 * MemberFrameLocks. The override only tags the layer; the Route Shield
 * enforces the rule from the site settings, so changing who sees a rule needs
 * no republish.
 */

import type { SectionLockRule } from "../types/connection";
import { accessOptions, accessValue, parseAccess } from "./accessChoices";

/** The code file the overrides live in. Framer lists it as "MemberFrameLocks". */
export const SECTION_LOCKS_FILE_NAME = "MemberFrameLocks.tsx";

/**
 * The file's name before 2026-10-25. A layer keeps pointing at the file its
 * override was picked from, and a plugin cannot re-point it, so a project that
 * already has this file keeps it, written with the same overrides, and its
 * locked layers keep working. New projects never get it.
 */
export const LEGACY_SECTION_LOCKS_FILE_NAME = "MemberLocks.tsx";

/**
 * Which locks files a save writes, given the project's code files: the
 * current one when there are locks or it already exists (never created for
 * nothing), and the legacy one only where it already exists.
 */
export function sectionLocksFilesToWrite(existing: ReadonlyArray<string>, lockCount: number): string[] {
  const files: string[] = [];
  if (lockCount > 0 || existing.includes(SECTION_LOCKS_FILE_NAME)) files.push(SECTION_LOCKS_FILE_NAME);
  if (existing.includes(LEGACY_SECTION_LOCKS_FILE_NAME)) files.push(LEGACY_SECTION_LOCKS_FILE_NAME);
  return files;
}

/**
 * The server's rule, held to it: letters, digits, spaces, and - _ . only.
 * The name ends up inside a CSS selector on the live site, so the character
 * set is what keeps a quote or a backslash out of it.
 */
export const SECTION_LOCK_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 _.-]{0,59}$/;

export const MAX_SECTION_LOCKS = 50;

/** Trim and collapse spaces, the form a name is stored and compared in. */
export function normalizeSectionLockName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

/**
 * A rule's identity, the server's `sectionLockSlug`: lowercase, every run of
 * other characters one dash. It is the class the override adds, so two rules
 * may not share it.
 */
export function sectionLockSlug(name: string): string {
  return normalizeSectionLockName(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Why a rule's name cannot be saved, or null. */
export function sectionLockNameProblem(rules: ReadonlyArray<Pick<SectionLockRule, "name">>, index: number): string | null {
  const name = normalizeSectionLockName(rules[index]?.name ?? "");
  if (name === "") return "Give this lock a name.";
  if (!SECTION_LOCK_NAME_PATTERN.test(name)) {
    return "Use letters, digits, spaces, dots, dashes, or underscores, starting with a letter or digit.";
  }
  const slug = sectionLockSlug(name);
  const clash = rules.findIndex((rule, other) => other !== index && sectionLockSlug(rule.name) === slug);
  return clash !== -1 ? "Another lock has this name." : null;
}

/**
 * The override name Framer shows for each rule, in rule order.
 *
 * The rule name as one word: "Gold article" becomes `GoldArticle`. A name
 * starting with a digit gets `Lock` in front, since a function name cannot
 * start with one, and a clash gets a number appended.
 */
export function sectionLockOverrideNames(rules: ReadonlyArray<Pick<SectionLockRule, "name">>): string[] {
  const taken = new Set<string>();
  return rules.map((rule) => {
    const words = normalizeSectionLockName(rule.name).match(/[A-Za-z0-9]+/g) ?? [];
    let name = words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join("") || "Lock";
    if (/^[0-9]/.test(name)) name = `Lock${name}`;
    let unique = name;
    for (let n = 2; taken.has(unique); n++) unique = `${name}${n}`;
    taken.add(unique);
    return unique;
  });
}

/**
 * The whole `MemberFrameLocks.tsx`, from the rules. The legacy
 * `MemberLocks.tsx` gets the same content.
 *
 * Every rule gets an override, switched off or not, so a layer never loses its
 * override because a rule was paused. Names and slugs go in through JSON, so
 * nothing in a rule can break the file. No JSX, so the file needs nothing
 * from Framer's compiler beyond plain TypeScript.
 */
export function sectionLocksCode(rules: ReadonlyArray<SectionLockRule>): string {
  const valid = rules.filter((_, index) => sectionLockNameProblem(rules, index) === null);
  const names = sectionLockOverrideNames(valid);

  const overrides = valid.map((rule, index) => {
    const ruleName = normalizeSectionLockName(rule.name);
    return [
      `/** ${ruleName} */`,
      `export function ${names[index]}(Component: React.ComponentType<any>): React.ComponentType<any> {`,
      `  return lock(Component, ${JSON.stringify(ruleName)}, ${JSON.stringify(sectionLockSlug(ruleName))})`,
      "}",
    ].join("\n");
  });

  return [
    "// MemberFrame section locks.",
    "//",
    "// Written by the MemberFrame plugin each time you click Save locks. Edit your",
    "// locks in the plugin (Settings, Page Locks, Section Locks), not here: this",
    "// file is replaced on every save.",
    "//",
    "// To lock a layer, select it, then in the right sidebar open Code overrides,",
    "// choose File MemberFrameLocks and the lock by name. The override only marks the",
    "// layer; the MemberFrame Route Shield on your published site decides who",
    "// sees it, from the rules saved in the plugin.",
    "",
    'import * as React from "react"',
    "",
    "// forwardRef, as Framer's own overrides do: Framer's appear and scroll",
    "// effects hold the layer by its ref, and without it the layer stays at its",
    "// starting state (often invisible) on the published site.",
    "function lock(Component: React.ComponentType<any>, rule: string, slug: string): React.ComponentType<any> {",
    "  return React.forwardRef(function Locked(props: any, ref: any) {",
    '    const className = props && props.className ? props.className + " mf-lock-" + slug : "mf-lock-" + slug',
    '    return React.createElement(Component, { ...props, ref, className, "data-mf-lock": rule })',
    "  }) as React.ComponentType<any>",
    "}",
    "",
    ...(overrides.length > 0 ? overrides : ["// No section locks yet. Add one in the plugin, then click Save locks."]),
    "",
  ].join("\n");
}

/**
 * Whether a project's locks file was written by an older plugin: one
 * whose overrides drop the layer's ref, so Framer's appear effects never run
 * and a locked layer stays invisible. Only that is rewritten on open; a file
 * that merely lists other rules waits for Save locks, as before.
 */
export function staleSectionLocksFile(content: string, rules: ReadonlyArray<SectionLockRule>): boolean {
  return !content.includes("React.forwardRef(function Locked") && content !== sectionLocksCode(rules);
}

export interface SectionLockTier {
  key: string;
  name: string;
  rank: number;
}

/** "Who sees it", as one choice: `members:tier_gold` or `others:signed_in`. */
export interface WhoSeesOption {
  value: string;
  label: string;
  group?: string;
}

/**
 * "Who sees it": the shared list, the same as page locks and the paywall
 * (services/accessChoices.ts, 19-section-locks.md 9).
 */
export function whoSeesOptions(tiers: ReadonlyArray<SectionLockTier>): WhoSeesOption[] {
  return accessOptions(tiers, { others: true });
}

export function whoSeesValue(rule: Pick<SectionLockRule, "audience" | "requiredTier">): string {
  return accessValue(rule);
}

export function parseWhoSees(
  value: string,
  current?: Pick<SectionLockRule, "requiredTier">,
  tiers: ReadonlyArray<SectionLockTier> = []
): Pick<SectionLockRule, "audience" | "requiredTier"> {
  return parseAccess(value, current, tiers);
}

/** A new rule with a name no other rule has: "Section lock 1", "Section lock 2"... */
export function newSectionLock(existing: ReadonlyArray<SectionLockRule>): SectionLockRule {
  const taken = new Set(existing.map((rule) => sectionLockSlug(rule.name)));
  let n = existing.length + 1;
  while (taken.has(`section-lock-${n}`)) n++;
  return {
    name: `Section lock ${n}`,
    enabled: true,
    audience: "members",
    requiredTier: "signed_in",
    lockedAction: "hide",
  };
}
