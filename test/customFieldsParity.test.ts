/**
 * The profile field rules exist four times, and this keeps three of them honest.
 *
 * `src/utils/customFields.ts` is the plugin's copy. `<MemberDashboard>` and
 * `<OnboardingModal>` each carry another, because a canvas component is
 * compiled by Framer alone on the creator's site and cannot import from this
 * repository. The fourth copy, the server's, is compared with the plugin's by
 * the backend's own `test/parity.test.ts`.
 *
 * What divergence would cost: a dashboard that accepts a value the server
 * refuses shows the member an error about a field they filled in correctly;
 * a modal that hides a field the server considers visible submits without a
 * required answer and is refused with nothing on screen to fix. Comments and
 * whitespace may differ. Code may not.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (...segments: string[]) => readFileSync(path.join(process.cwd(), ...segments), "utf-8");

const plugin = read("src", "utils", "customFields.ts");
const dashboard = read("src", "canvas-components", "MemberDashboard.tsx");
const onboarding = read("src", "canvas-components", "OnboardingModal.tsx");

/**
 * Pull one function out by name, by counting braces.
 *
 * One step more careful than the extractor in the other parity tests, because
 * `checkValue` returns `{ value } | { problem }`: the first brace after the
 * name is its return type, and counting from there would compare signatures
 * only. So the parameter list is matched by its parentheses, and the body is
 * the first brace after it that ends a line, which a type literal never does.
 */
function extractFunction(source: string, name: string): string {
  const signature = new RegExp(`function\\s+${name}\\s*\\(`).exec(source);
  if (!signature) throw new Error(`No function named ${name} in the source.`);

  let parens = 0;
  let paramsEnd = -1;
  for (let index = source.indexOf("(", signature.index); index < source.length; index += 1) {
    if (source[index] === "(") parens += 1;
    if (source[index] === ")") parens -= 1;
    if (parens === 0) {
      paramsEnd = index;
      break;
    }
  }

  const body = /\{[ \t]*\r?\n/.exec(source.slice(paramsEnd));
  if (paramsEnd === -1 || !body) throw new Error(`No body found for ${name}.`);

  const open = paramsEnd + body.index;
  let depth = 0;

  for (let index = open; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(signature.index, index + 1);
  }

  throw new Error(`Unbalanced braces while extracting ${name}.`);
}

function extractConstant(source: string, name: string): string {
  const match = new RegExp(`const\\s+${name}[^=]*=\\s*([^;]+);`).exec(source);
  if (!match) throw new Error(`No constant named ${name} in the source.`);
  return (match[1] ?? "").trim();
}

function normalize(body: string): string {
  return body
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/[^\n]*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const SHARED = [
  "isSafeUrl",
  "isPhoneLike",
  "checkValue",
  "isFieldVisible",
  "toSubmittedValue",
  "validateProfile",
] as const;

const ONBOARDING_ONLY = ["needsOnboarding", "planSteps"] as const;

const CONSTANTS = ["MAX_TEXT_LENGTH", "MAX_TEXTAREA_LENGTH", "MAX_URL_LENGTH"] as const;

describe("MemberDashboard carries the plugin's rules unchanged", () => {
  for (const name of SHARED) {
    it(`${name} is identical`, () => {
      expect(normalize(extractFunction(dashboard, name))).toBe(
        normalize(extractFunction(plugin, name))
      );
    });
  }

  for (const name of CONSTANTS) {
    it(`${name} is identical`, () => {
      expect(extractConstant(dashboard, name)).toBe(extractConstant(plugin, name));
    });
  }
});

describe("OnboardingModal carries the plugin's rules unchanged", () => {
  for (const name of [...SHARED, ...ONBOARDING_ONLY]) {
    it(`${name} is identical`, () => {
      expect(normalize(extractFunction(onboarding, name))).toBe(
        normalize(extractFunction(plugin, name))
      );
    });
  }

  for (const name of CONSTANTS) {
    it(`${name} is identical`, () => {
      expect(extractConstant(onboarding, name)).toBe(extractConstant(plugin, name));
    });
  }
});

describe("the comparison can fail", () => {
  it("notices a one-character change to a rule", () => {
    // A parity test that passes on any input proves nothing. Perturb the
    // plugin's copy the way a careless edit would and confirm it is caught.
    const original = normalize(extractFunction(plugin, "isFieldVisible"));
    const perturbed = normalize(
      extractFunction(plugin.replace("String(parent) === field.showWhen.value", "String(parent) !== field.showWhen.value"), "isFieldVisible")
    );

    expect(perturbed).not.toBe(original);
  });

  it("extracts whole functions, not empty matches", () => {
    for (const name of [...SHARED, ...ONBOARDING_ONLY]) {
      expect(extractFunction(plugin, name).length).toBeGreaterThan(60);
    }
  });

  it("reaches past a return type written as an object literal", () => {
    // The trap described on `extractFunction`. If the body were missed, this
    // rule from deep inside `checkValue` would be absent from the extract.
    expect(extractFunction(plugin, "checkValue")).toContain("MAX_TEXTAREA_LENGTH : MAX_TEXT_LENGTH");
  });
});
