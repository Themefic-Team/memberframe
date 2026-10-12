/**
 * The canvas component code generator. PRD task 1.4, feature F01.
 *
 * Layer 1 of the PRD section 16.1 triad: the generator is a pure string
 * function, so it tests cleanly in a node environment with no DOM.
 *
 * These tests matter more than their subject looks. The output of this function
 * is written into a creator's Framer project and runs on their published
 * website. A broken emit is not a plugin bug the creator can shrug at, it is
 * their page failing to render, so the adversarial-input block below is the
 * point of the file rather than a flourish.
 */

import { describe, expect, it } from "vitest";
import {
  CONFIG_END_MARKER,
  CONFIG_START_MARKER,
  CodeGenerationError,
  LOCK_STATE_SIGNATURE,
  MEMBER_GATE_FILE_NAME,
  MEMBER_GATE_DESCRIPTOR,
  buildConfigBlock,
  generateMemberGateCode,
  normalizeGateConfig,
} from "../src/services/canvasComponentCodeGenerator";
import { API_BASE_URL } from "../src/config/backend";
import {
  BLUR_MAX,
  BLUR_MIN,
  DEFAULT_MEMBER_GATE_CONFIG,
  type MemberGateConfig,
} from "../src/types/canvas";

/**
 * Pull one emitted field back out of generated code and decode it.
 *
 * Every string field is emitted as a JSON string literal, so `JSON.parse` on
 * the literal is an exact round trip. That is what makes the adversarial tests
 * meaningful: if the generator ever concatenated instead of serializing, the
 * parse fails or returns something other than the input.
 */
function readEmittedString(code: string, field: string): string {
  const match = new RegExp(`^  ${field}: (".*"),$`, "m").exec(code);

  if (!match) {
    throw new Error(`No emitted string field "${field}" found in the generated config block.`);
  }

  return JSON.parse(match[1]) as string;
}

function readEmittedNumber(code: string, field: string): number {
  const match = new RegExp(`^  ${field}: (-?[0-9.]+),$`, "m").exec(code);

  if (!match) {
    throw new Error(`No emitted numeric field "${field}" found in the generated config block.`);
  }

  return Number(match[1]);
}

const config = (overrides: Partial<MemberGateConfig> = {}): MemberGateConfig => ({
  ...DEFAULT_MEMBER_GATE_CONFIG,
  ...overrides,
});

describe("generateMemberGateCode: the shape of the output", () => {
  it("names the file MemberGate.tsx, extension included", () => {
    // Framer rejects JSX in a file that is not *.tsx, and createCodeFile takes
    // the name with its extension rather than deriving one.
    expect(generateMemberGateCode(config()).fileName).toBe(MEMBER_GATE_FILE_NAME);
    expect(MEMBER_GATE_FILE_NAME.endsWith(".tsx")).toBe(true);
  });

  it("keeps exactly one marker pair, so a second generation is still possible", () => {
    // Generating from generated output has to work: it is what a creator does
    // when they adjust the customizer and click Add to canvas again.
    const once = generateMemberGateCode(config({ cardTitle: "First" })).code;
    const twice = generateMemberGateCode(config({ cardTitle: "Second" }), once).code;

    expect(twice.split(CONFIG_START_MARKER)).toHaveLength(2);
    expect(twice.split(CONFIG_END_MARKER)).toHaveLength(2);
    expect(readEmittedString(twice, "cardTitle")).toBe("Second");
    expect(twice).not.toContain("First");
  });

  it("keeps the F19 lock-state signature intact", () => {
    // enforceLockState finds these lines by regex. If a future edit to the
    // authored component drops them, every deployed component is permanently
    // unlocked and nothing would otherwise say so.
    const { code } = generateMemberGateCode(config());

    for (const line of LOCK_STATE_SIGNATURE) {
      expect(code).toContain(line);
    }
  });

  it("changes nothing outside the config block", () => {
    const base = generateMemberGateCode(config()).code;
    const changed = generateMemberGateCode(config({ blurIntensity: 15 })).code;

    const strip = (code: string) =>
      code.slice(0, code.indexOf(CONFIG_START_MARKER)) +
      code.slice(code.indexOf(CONFIG_END_MARKER));

    expect(strip(changed)).toBe(strip(base));
  });

  it("carries the backend base URL from config, not a literal at the call site", () => {
    // PRD section 10.1: the base URL is configured in src/config/backend.ts and
    // never hardcoded at a call site. The canvas component cannot import it, so
    // the generator is the only legitimate way for it to arrive there.
    expect(readEmittedString(generateMemberGateCode(config()).code, "apiBaseUrl")).toBe(
      API_BASE_URL
    );
  });

  it("emits every field the authored component's GateConfig declares", () => {
    const { code } = generateMemberGateCode(config());
    const block = code.slice(code.indexOf(CONFIG_START_MARKER), code.indexOf(CONFIG_END_MARKER));

    for (const field of [
      "requiredTier",
      "fallbackAction",
      "redirectUrl",
      "cardTitle",
      "cardDescription",
      "blurIntensity",
      "apiBaseUrl",
      "sessionTtlMs",
    ]) {
      expect(block).toContain(`  ${field}: `);
    }
  });
});

describe("generateMemberGateCode: creator text cannot break the file", () => {
  it("round trips a title full of quotes, backslashes, and template syntax", () => {
    const hostile = 'He said "members only" \\ and ${process.exit(1)} `tick`';
    const { code } = generateMemberGateCode(config({ cardTitle: hostile }));

    // Decoding the emitted literal returns exactly what went in, which is only
    // true if the value was serialized rather than pasted into the source.
    expect(readEmittedString(code, "cardTitle")).toBe(hostile);
  });

  it("neutralises an attempt to close the literal and append code", () => {
    const breakout = '", apiBaseUrl: "https://evil.example.com';
    const { code } = generateMemberGateCode(config({ cardDescription: breakout }));

    expect(readEmittedString(code, "cardDescription")).toBe(breakout);
    // The real assertion: the injected key did not become a second assignment.
    expect(readEmittedString(code, "apiBaseUrl")).toBe(API_BASE_URL);
    expect(code).not.toContain("evil.example.com\",\n};");
  });

  it("collapses newlines and the two invisible line separators", () => {
    // U+2028 and U+2029 pass through JSON.stringify raw and are line
    // terminators to an older parser, so a title carrying one could parse
    // differently than it reads. They are removed, not escaped.
    const separators = String.fromCharCode(0x2028, 0x2029);
    const messy = `Top${separators}line\nsecond\tthird`;

    expect(normalizeGateConfig(config({ cardTitle: messy })).cardTitle).toBe(
      "Top line second third"
    );
  });

  it("caps the two free-text fields rather than embedding an essay", () => {
    const long = "a".repeat(5000);
    const normalized = normalizeGateConfig(
      config({ cardTitle: long, cardDescription: long })
    );

    expect(normalized.cardTitle.length).toBe(200);
    expect(normalized.cardDescription.length).toBe(500);
  });

  it("trims, because padding a label is not content", () => {
    expect(normalizeGateConfig(config({ cardTitle: "   Members Only   " })).cardTitle).toBe(
      "Members Only"
    );
  });
});

describe("normalizeGateConfig: redirect targets", () => {
  it("keeps a relative path, a fragment, and an explicit https URL", () => {
    for (const url of ["/sign-in", "./sign-in", "../sign-in", "#gate", "https://a.example.com"]) {
      expect(normalizeGateConfig(config({ redirectUrl: url })).redirectUrl).toBe(url);
    }
  });

  it("drops a javascript: target", () => {
    // The gate calls window.location.assign with this value. Some browsers
    // execute a javascript: URL there, and redirectUrl is exactly the kind of
    // field a creator pastes from somewhere else.
    expect(
      normalizeGateConfig(config({ redirectUrl: "javascript:alert(document.cookie)" })).redirectUrl
    ).toBe("");
  });

  it("drops data: and other schemes it does not recognise", () => {
    for (const url of ["data:text/html,<script>x</script>", "vbscript:x", "file:///etc/passwd"]) {
      expect(normalizeGateConfig(config({ redirectUrl: url })).redirectUrl).toBe("");
    }
  });
});

describe("normalizeGateConfig: enums and the blur range", () => {
  it("falls back to the default for a tier the property control cannot show", () => {
    // `anyone` is a legal RequiredTier and is deliberately not an option on the
    // F01 control. Emitting it as a defaultValue would leave Framer's sidebar
    // holding a selection its own options list cannot represent.
    expect(normalizeGateConfig(config({ requiredTier: "anyone" })).requiredTier).toBe(
      DEFAULT_MEMBER_GATE_CONFIG.requiredTier
    );
  });

  it("keeps each of the five tiers the control does offer", () => {
    for (const tier of ["signed_in", "free_member", "tier_1", "tier_2", "vip"] as const) {
      expect(normalizeGateConfig(config({ requiredTier: tier })).requiredTier).toBe(tier);
    }
  });

  it("falls back for an unknown fallback action", () => {
    expect(
      normalizeGateConfig(config({ fallbackAction: "explode" as never })).fallbackAction
    ).toBe(DEFAULT_MEMBER_GATE_CONFIG.fallbackAction);
  });

  it("clamps the blur radius to the property control's own bounds", () => {
    expect(normalizeGateConfig(config({ blurIntensity: 0 })).blurIntensity).toBe(BLUR_MIN);
    expect(normalizeGateConfig(config({ blurIntensity: 999 })).blurIntensity).toBe(BLUR_MAX);
    expect(normalizeGateConfig(config({ blurIntensity: 7.6 })).blurIntensity).toBe(8);
  });

  it("falls back for a blur radius that is not a number", () => {
    // A CSS declaration reading `blur(NaNpx)` is invalid and drops silently,
    // so a frosted gate would render as clear content.
    expect(normalizeGateConfig(config({ blurIntensity: Number.NaN })).blurIntensity).toBe(
      DEFAULT_MEMBER_GATE_CONFIG.blurIntensity
    );
    expect(
      normalizeGateConfig(config({ blurIntensity: Number.POSITIVE_INFINITY })).blurIntensity
    ).toBe(DEFAULT_MEMBER_GATE_CONFIG.blurIntensity);
  });

  it("reports back what it actually emitted, not what it was asked for", () => {
    // The Builder tab shows this to the creator, so a clamp has to be visible.
    const { config: emitted } = generateMemberGateCode(config({ blurIntensity: 999 }));
    expect(emitted.blurIntensity).toBe(BLUR_MAX);
  });
});

describe("generateMemberGateCode: it refuses a broken authored component", () => {
  it("throws when the marker pair is missing", () => {
    expect(() => generateMemberGateCode(config(), "const x = 1;")).toThrow(CodeGenerationError);
  });

  it("throws when the markers appear twice", () => {
    const doubled = [
      CONFIG_START_MARKER,
      CONFIG_END_MARKER,
      CONFIG_START_MARKER,
      CONFIG_END_MARKER,
    ].join("\n");

    expect(() => generateMemberGateCode(config(), doubled)).toThrow(/found 2 start and 2 end/);
  });

  it("throws when the output would lose the lock-state signature", () => {
    const noLockState = [CONFIG_START_MARKER, "const CONFIG = {};", CONFIG_END_MARKER].join("\n");

    expect(() => generateMemberGateCode(config(), noLockState)).toThrow(/lock-state line/);
  });
});

describe("buildConfigBlock", () => {
  it("opens and closes with the markers, so the replacement is self-delimiting", () => {
    const block = buildConfigBlock(MEMBER_GATE_DESCRIPTOR, config());

    expect(block.startsWith(CONFIG_START_MARKER)).toBe(true);
    expect(block.endsWith(CONFIG_END_MARKER)).toBe(true);
  });

  it("declares the same type annotation the authored component expects", () => {
    expect(buildConfigBlock(MEMBER_GATE_DESCRIPTOR, config())).toContain("const CONFIG: GateConfig = {");
  });

  it("emits the session TTL as a number, not a string", () => {
    expect(readEmittedNumber(buildConfigBlock(MEMBER_GATE_DESCRIPTOR, config()), "sessionTtlMs")).toBeGreaterThan(0);
  });
});
