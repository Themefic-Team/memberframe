/**
 * `<MemberGate>` held to the plugin. PRD task 1.7, PRD section 11.3.
 *
 * PRD section 11.3 states that `isEntitled` is "implemented identically in the
 * plugin, the canvas components, and the backend" and that "divergence between
 * the three is a security defect". The canvas component is deployed into a
 * creator's Framer project and cannot import anything from this repo, so the
 * resolver exists here twice by necessity. This file is what stops the two
 * copies drifting.
 *
 * It reads both files from disk as text rather than importing them, because
 * importing `MemberGate.tsx` would need the `framer` module, which is supplied
 * by the Framer runtime and is deliberately not installed.
 *
 * **The third copy is out of repo and is not checked by anything.** PRD section
 * 10.1 puts the backend in a separate repository, so the server's resolver can
 * still diverge from both of these and no test anywhere will say so. That is
 * blocker B1 and it is the remaining hole in section 11.3's guarantee.
 *
 * The rest of the file asserts the handful of structural properties that decide
 * whether the deployed component is safe, and that no unit test could otherwise
 * reach while `jsdom` is absent: that it imports nothing from this repo, that
 * it reads no token from browser storage, and that it has no code path to
 * content before entitlement resolves.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/** Vitest runs from the project root, which is where the paths below resolve. */
const PLUGIN_RESOLVER = path.join(process.cwd(), "src", "utils", "entitlement.ts");
const CANVAS_COMPONENT = path.join(process.cwd(), "src", "canvas-components", "MemberGate.tsx");

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

describe("the deployed component is standalone", () => {
  /** Every module specifier the component imports from. */
  const specifiers = Array.from(
    canvasSource.matchAll(/^import\s[^;]*?from\s+"([^"]+)";/gm),
    (match) => match[1]
  );

  it("imports only what the Framer runtime supplies", () => {
    // A relative import would resolve here and typecheck here and then fail on
    // the creator's published site, where this file sits alone in their project.
    expect(specifiers.sort()).toEqual(["framer", "lucide-react", "react"]);
  });

  it("imports nothing by a relative path", () => {
    for (const specifier of specifiers) {
      expect(specifier.startsWith(".")).toBe(false);
    }
  });
});

describe("the deployed component is safe by construction", () => {
  it("reads no token from browser storage", () => {
    // PRD section 14.1 S2: member sessions use HTTP-only cookies and a JWT in
    // localStorage is forbidden. F01's own prose describes reading "the local
    // JWT", which S2 does not permit. Conflict C4.
    //
    // Checked against the source with comments removed, because the component's
    // own comment explains the rule and names the API it must not call. The
    // stripping mangles the `https://` inside string literals, which does not
    // matter for an assertion that something is absent.
    const code = canvasSource
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/\/\/[^\n]*/g, " ");

    expect(code).not.toContain("localStorage");
    expect(code).not.toContain("sessionStorage");
    expect(code).not.toContain("document.cookie");
  });

  it("sends the credential by letting the browser attach it", () => {
    expect(canvasSource).toContain('credentials: "include"');
  });

  it("handles all five cases from the PRD section 10.6 error contract", () => {
    expect(canvasSource).toContain("response.status === 401");
    expect(canvasSource).toContain("response.status === 403");
    // Everything else that is not ok, which covers 429 and 5xx, plus a catch
    // for a network failure. All four resolve to a locked render.
    expect(canvasSource).toContain("if (!response.ok) return { kind: \"unavailable\" };");
    expect(canvasSource).toContain("} catch {");
  });

  it("makes one request per page, not one per gate", () => {
    // PRD P4. The cache lives at module scope, so every instance on the page
    // shares it, and a failed check stays failed for the TTL, which is what
    // section 10.6 asks for on a 429: no retry storm.
    expect(canvasSource).toContain("let cachedSession");
    expect(canvasSource).toContain("CONFIG.sessionTtlMs");
  });

  it("issues exactly one fetch call in the whole file", () => {
    expect(canvasSource.match(/fetch\(/g)).toHaveLength(1);
  });

  it("starts in a state that renders locked", () => {
    // The gate mounts with no result and `entitled` requires a resolved member
    // session, so there is no window in which content is rendered before
    // entitlement is known. This is what makes the PRD section 16.4 line
    // "disabling JavaScript leaves gated content locked" true by construction.
    expect(canvasSource).toContain("useState<SessionResult | null>(null)");
    expect(canvasSource).toContain("result !== null &&");
    expect(canvasSource).toContain('result.kind === "member" &&');
  });

  it("never fetches or navigates while the creator is on the canvas", () => {
    expect(canvasSource).toContain("if (onCanvas) return;");
    expect(canvasSource).toContain("RenderTarget.current()");
  });

  it("keeps the F19 lock-state block in the exact patchable shape", () => {
    // enforceLockState rewrites these by regex. PRD section 9.3 requirement 3.
    expect(canvasSource).toContain("const IS_LOCKED = false;");
    expect(canvasSource).toContain("const IS_TRIAL = false;");
    expect(canvasSource).toContain("// @plugin-lock-state: unlocked");
    expect(canvasSource).toContain("// @plugin-trial-state: paid");
  });

  it("declares all seven F01 property controls", () => {
    for (const control of [
      "contentSlot",
      "requiredTier",
      "fallbackAction",
      "redirectUrl",
      "cardTitle",
      "cardDescription",
      "blurIntensity",
    ]) {
      expect(canvasSource).toContain(`  ${control}: {`);
    }
  });

  it("hides the three conditional controls exactly as F01 specifies", () => {
    expect(canvasSource).toContain('props.fallbackAction !== "redirect"');
    expect(canvasSource).toContain('props.fallbackAction !== "custom_card"');
    expect(canvasSource).toContain('props.fallbackAction !== "blur"');
  });

  it("carries no inline style and no unicode emoji", () => {
    // npm run lint:css covers the first already. Asserted here too because this
    // is the file whose styling ends up on someone else's website.
    expect(canvasSource).not.toMatch(/\bstyle\s*=\s*\{\{/);
    expect(canvasSource).not.toMatch(
      /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u
    );
  });

  it("gives every icon stroke=currentColor, per the icon standard", () => {
    const icons = canvasSource.match(/<(Lock|Crown)\s[^>]*>/g) ?? [];

    expect(icons.length).toBeGreaterThan(0);
    for (const icon of icons) {
      expect(icon).toContain('stroke="currentColor"');
    }
  });
});
