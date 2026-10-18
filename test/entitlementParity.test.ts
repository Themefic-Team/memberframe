/**
 * The canvas copy of `isEntitled` held to the plugin's. PRD section 11.3.
 *
 * PRD section 11.3 states that `isEntitled` is "implemented identically in the
 * plugin, the canvas components, and the backend" and that "divergence between
 * the three is a security defect". The canvas component is deployed into a
 * creator's Framer project and cannot import anything from this repo, so the
 * resolver exists here twice by necessity. This file is what stops the two
 * copies drifting.
 *
 * The canvas copy lives in `<MeteredPaywall>`, the component that gates on
 * the same rule. It reads both files from disk as text rather than importing
 * them, because importing a canvas component would need the `framer` module, which is supplied
 * by the Framer runtime and is deliberately not installed.
 *
 * **The third copy is out of repo and is not checked by anything.** PRD section
 * 10.1 puts the backend in a separate repository, so the server's resolver can
 * still diverge from both of these and no test anywhere will say so. That is
 * blocker B1 and it is the remaining hole in section 11.3's guarantee.
 *
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/** Vitest runs from the project root, which is where the paths below resolve. */
const PLUGIN_RESOLVER = path.join(process.cwd(), "src", "utils", "entitlement.ts");
const CANVAS_COMPONENT = path.join(process.cwd(), "src", "canvas-components", "MeteredPaywall.tsx");

const pluginSource = readFileSync(PLUGIN_RESOLVER, "utf-8");
const canvasSource = readFileSync(CANVAS_COMPONENT, "utf-8");

/**
 * Pull one function out of a source file by brace matching.
 *
 * Brace matching before comment stripping, not after: stripping `//` comments
 * from a whole file also mangles any `https://` inside a string literal, and
 * this component contains one.
 */
function extractFunction(source: string, name: string): string {
  const signature = new RegExp(`function\\s+${name}\\s*\\(`).exec(source);

  if (!signature) {
    throw new Error(`No function named ${name} in the source.`);
  }

  const open = source.indexOf("{", signature.index);

  if (open === -1) {
    throw new Error(`No body found for ${name}.`);
  }

  let depth = 0;

  for (let index = open; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) {
      return source.slice(signature.index, index + 1);
    }
  }

  throw new Error(`Unbalanced braces while extracting ${name}.`);
}

/** Comments and whitespace are not behaviour. Everything else is. */
function normalize(code: string): string {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/[^\n]*/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^export\s+/, "")
    .trim();
}

const pluginResolver = extractFunction(pluginSource, "isEntitled");
const canvasResolver = extractFunction(canvasSource, "isEntitled");

describe("the extraction itself is sound", () => {
  // A broken extractor comparing two empty strings would pass every test below.
  it("found a real function body in each file", () => {
    expect(pluginResolver.length).toBeGreaterThan(200);
    expect(canvasResolver.length).toBeGreaterThan(200);
  });

  it("captured each body to its closing brace", () => {
    for (const body of [pluginResolver, canvasResolver]) {
      expect(body.trimEnd().endsWith("}")).toBe(true);
      expect(body).toContain("return held.rank >= required.rank;");
    }
  });
});

describe("the two copies of isEntitled are identical", () => {
  it("matches character for character once comments and spacing are removed", () => {
    // If this fails, one copy was edited and the other was not. Fix the drift
    // rather than relaxing the test: PRD section 11.3 calls this a security
    // defect, not a style inconsistency.
    expect(normalize(canvasResolver)).toBe(normalize(pluginResolver));
  });

  it("takes the same four parameters in the same order", () => {
    const parameters = (body: string) =>
      normalize(body.slice(body.indexOf("("), body.indexOf("): boolean")));

    expect(parameters(canvasResolver)).toBe(parameters(pluginResolver));
  });
});

describe("the resolver's individual guarantees, pinned separately", () => {
  // Normalizing to the same string is one assertion and it could in principle
  // pass for the wrong reason. Each behaviour PRD section 11.3 specifies is
  // also pinned on its own, in both copies.
  const copies: ReadonlyArray<[string, string]> = [
    ["plugin", normalize(pluginResolver)],
    ["canvas", normalize(canvasResolver)],
  ];

  for (const [label, body] of copies) {
    it(`${label}: treats active and trialing as valid`, () => {
      expect(body).toContain('session.status === "active"');
      expect(body).toContain('session.status === "trialing"');
    });

    it(`${label}: keeps a past_due member in until the grace window ends`, () => {
      expect(body).toContain(
        '(session.status === "past_due" && nowSeconds < session.gracePeriodEndsAt)'
      );
    });

    it(`${label}: keeps a canceled member in until the paid period ends`, () => {
      expect(body).toContain(
        '(session.status === "canceled" && nowSeconds < session.currentPeriodEnd)'
      );
    });

    it(`${label}: compares ranks hierarchically, not for equality`, () => {
      expect(body).toContain("held.rank >= required.rank");
      expect(body).not.toContain("held.rank === required.rank");
    });

    it(`${label}: fails closed when either tier key is missing from the table`, () => {
      expect(body).toContain("if (!required || !held) return false;");
    });

    it(`${label}: fails closed on an absent session`, () => {
      expect(body).toContain("if (!session) return false;");
    });

    it(`${label}: uses a strict comparison on both time windows`, () => {
      // `<=` would hand out one free second of paid content at each boundary,
      // and the boundary is where a dunning job runs.
      expect(body).not.toContain("nowSeconds <= session");
    });
  }
});
