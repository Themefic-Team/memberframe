/**
 * The password policy exists twice, and this is what keeps the copies honest.
 *
 * Same arrangement as `test/entitlementParity.test.ts`, and for the same
 * unavoidable reason: `src/canvas-components/MemberAuth.tsx` is compiled by
 * Framer alone on a creator's published site, so it cannot import
 * `src/utils/credentials.ts`. Duplication is the architecture, not a shortcut.
 *
 * What divergence would cost: the panel-side copy is what tests and any future
 * creator-facing preview read, the component copy is what visitors actually
 * meet, and the backend has a third copy that nothing here can see. A rule that
 * drifts produces a form that accepts what the server refuses, with no field to
 * blame and no error anyone can act on.
 *
 * The messages are deliberately NOT compared. Wording drifting is cosmetic.
 * Rules drifting is a defect.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const MODULE_PATH = path.join(process.cwd(), "src", "utils", "credentials.ts");
const COMPONENT_PATH = path.join(process.cwd(), "src", "canvas-components", "MemberAuth.tsx");

const moduleSource = readFileSync(MODULE_PATH, "utf-8");
const componentSource = readFileSync(COMPONENT_PATH, "utf-8");

/**
 * Pull one function out by name, by matching braces.
 *
 * A regex cannot do this: the body contains braces, and a greedy or lazy match
 * stops at the wrong one. Depth counting is the only thing that terminates in
 * the right place.
 */
function extractFunction(source: string, name: string): string {
  const signature = new RegExp(`function\\s+${name}\\s*\\(`).exec(source);
  if (!signature) throw new Error(`No function named ${name} in the source.`);

  const open = source.indexOf("{", signature.index);
  let depth = 0;

  for (let index = open; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(signature.index, index + 1);
  }

  throw new Error(`Unbalanced braces while extracting ${name}.`);
}

/** Pull a single-line `const NAME = value;` declaration's value. */
function extractConstant(source: string, name: string): string {
  const match = new RegExp(`${name}\\s*=\\s*([^;]+);`).exec(source);
  if (!match) throw new Error(`No constant named ${name} in the source.`);
  return match[1].trim();
}

/** Pull an array literal's entries, whatever the line breaks look like. */
function extractArrayEntries(source: string, name: string): string[] {
  const start = new RegExp(`${name}[^=]*=\\s*\\[`).exec(source);
  if (!start) throw new Error(`No array named ${name} in the source.`);

  const open = source.indexOf("[", start.index);
  const close = source.indexOf("]", open);
  if (close === -1) throw new Error(`Unterminated array ${name}.`);

  return source
    .slice(open + 1, close)
    .split(",")
    .map((entry) => entry.trim().replace(/^["']|["']$/g, ""))
    .filter((entry) => entry !== "");
}

/**
 * Comments and whitespace are allowed to differ. The component's copy carries a
 * different explanation of why it is a copy, which is not a divergence.
 */
function normalize(body: string): string {
  return body
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/[^\n]*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const SHARED_FUNCTIONS = ["looksLikeEmail", "passwordProblems", "readPasswordPolicy", "passwordScore"] as const;
const SHARED_CONSTANTS = [
  "PASSWORD_MIN_LENGTH",
  "PASSWORD_MAX_LENGTH",
  "EMAIL_FRAGMENT_MIN_LENGTH",
  "PASSWORD_POLICY_MAX_MIN",
] as const;

describe("the shared rules are byte-identical once comments are stripped", () => {
  for (const name of SHARED_FUNCTIONS) {
    it(`${name} matches in both copies`, () => {
      const fromModule = normalize(extractFunction(moduleSource, name));
      const fromComponent = normalize(extractFunction(componentSource, name));

      expect(fromComponent).toBe(fromModule);
    });
  }
});

describe("the policy numbers match too", () => {
  // A function body that matches while the numbers differ would pass the check
  // above and still disagree with the server. The minimum length is the one
  // most likely to be "improved" in one file only.
  for (const name of SHARED_CONSTANTS) {
    it(`${name} matches in both copies`, () => {
      expect(extractConstant(componentSource, name)).toBe(extractConstant(moduleSource, name));
    });
  }

  it("the common-password list matches entry for entry, in order", () => {
    const fromModule = extractArrayEntries(moduleSource, "COMMON_PASSWORDS");
    const fromComponent = extractArrayEntries(componentSource, "COMMON_PASSWORDS");

    expect(fromComponent).toEqual(fromModule);
  });

  it("found a real list, so the comparison is not vacuously empty", () => {
    expect(extractArrayEntries(moduleSource, "COMMON_PASSWORDS").length).toBeGreaterThan(5);
  });
});

describe("the extractor can fail, which is the only reason to trust it", () => {
  it("throws on a function that is not there", () => {
    expect(() => extractFunction(moduleSource, "noSuchFunction")).toThrow(/No function named/);
  });

  it("throws on unbalanced braces rather than returning a truncated body", () => {
    expect(() => extractFunction("function broken() { if (true) {", "broken")).toThrow(
      /Unbalanced braces/
    );
  });

  it("throws on a constant that is not there", () => {
    expect(() => extractConstant(moduleSource, "NO_SUCH_CONSTANT")).toThrow(/No constant named/);
  });

  it("notices a changed rule rather than passing anything that parses", () => {
    // The real proof is perturbation: this is the same body with `<` flipped to
    // `<=`, which is exactly the off-by-one a careless edit produces, and the
    // comparison has to reject it.
    const real = normalize(extractFunction(moduleSource, "passwordProblems"));
    const perturbed = real.replace(
      "value.length < rules.minLength",
      "value.length <= rules.minLength"
    );

    expect(perturbed).not.toBe(real);
    expect(normalize(extractFunction(componentSource, "passwordProblems"))).not.toBe(perturbed);
  });

  it("notices a changed number", () => {
    const real = extractConstant(moduleSource, "PASSWORD_MIN_LENGTH");
    expect(real).not.toBe("12");
    expect(extractConstant(componentSource, "PASSWORD_MIN_LENGTH")).toBe(real);
  });
});

describe("the copies have not grown an import between them", () => {
  it("the component still imports only what Framer supplies", () => {
    // If `MemberAuth.tsx` ever imports `../utils/credentials`, this whole test
    // file becomes pointless and the component breaks on the creator's site,
    // where that path does not exist.
    //
    // Checked against the import statements rather than the file text. The
    // component's own comments name that module, as they should, and a
    // substring search over the whole source would match the comment and fail.
    const specifiers = Array.from(
      componentSource.matchAll(/^import\s[^;]*?from\s+"([^"]+)";/gms),
      (match) => match[1]
    );

    expect(specifiers.length).toBeGreaterThan(0);

    for (const specifier of specifiers) {
      expect(specifier.startsWith(".")).toBe(false);
    }
  });

  it("the shared functions in the component are module scope, not nested", () => {
    // A copy nested inside the component function would still extract and still
    // match, while being re-created on every render. Cheap to check, and it
    // catches a refactor that moved them inward.
    for (const name of SHARED_FUNCTIONS) {
      expect(componentSource).toMatch(new RegExp(`^function ${name}\\(`, "m"));
    }
  });
});
