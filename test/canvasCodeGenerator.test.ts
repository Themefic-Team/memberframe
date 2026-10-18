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
 *
 * The generator core is shared by every component. These tests drive it
 * through the metered paywall, which has free-text fields, a numeric range,
 * and the connection values, so every path the core takes is reached.
 */

import { describe, expect, it } from "vitest";
import {
  CONFIG_END_MARKER,
  CONFIG_START_MARKER,
  CodeGenerationError,
  LOCK_STATE_SIGNATURE,
  METERED_PAYWALL_DESCRIPTOR,
  METERED_PAYWALL_FILE_NAME,
  buildConfigBlock,
  generateMeteredPaywallCode,
  normalizeMeteredPaywallConfig,
} from "../src/services/canvasComponentCodeGenerator";
import { API_BASE_URL } from "../src/config/backend";
import {
  BLUR_MAX,
  BLUR_MIN,
  DEFAULT_METERED_PAYWALL_CONFIG,
  type MeteredPaywallConfig,
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

const config = (overrides: Partial<MeteredPaywallConfig> = {}): MeteredPaywallConfig => ({
  ...DEFAULT_METERED_PAYWALL_CONFIG,
  ...overrides,
});

describe("the shape of the output", () => {
  it("names the file with its .tsx extension", () => {
    // Framer rejects JSX in a file that is not *.tsx, and createCodeFile takes
    // the name with its extension rather than deriving one.
    expect(generateMeteredPaywallCode(config()).fileName).toBe(METERED_PAYWALL_FILE_NAME);
    expect(METERED_PAYWALL_FILE_NAME.endsWith(".tsx")).toBe(true);
  });

  it("keeps exactly one marker pair, so a second generation is still possible", () => {
    // Generating from generated output has to work: it is what happens when a
    // creator clicks Add to canvas again.
    const once = generateMeteredPaywallCode(config({ cardTitle: "First" })).code;
    const twice = generateMeteredPaywallCode(config({ cardTitle: "Second" }), once).code;

    expect(twice.split(CONFIG_START_MARKER)).toHaveLength(2);
    expect(twice.split(CONFIG_END_MARKER)).toHaveLength(2);
    expect(readEmittedString(twice, "cardTitle")).toBe("Second");
    expect(twice).not.toContain("First");
  });

  it("keeps the F19 lock-state signature intact", () => {
    // enforceLockState finds these lines by regex. If a future edit to the
    // authored component drops them, every deployed component is permanently
    // unlocked and nothing would otherwise say so.
    const { code } = generateMeteredPaywallCode(config());

    for (const line of LOCK_STATE_SIGNATURE) {
      expect(code).toContain(line);
    }
  });

  it("changes nothing outside the config block", () => {
    const base = generateMeteredPaywallCode(config()).code;
    const changed = generateMeteredPaywallCode(config({ blurIntensity: 15 })).code;

    const strip = (code: string) =>
      code.slice(0, code.indexOf(CONFIG_START_MARKER)) + code.slice(code.indexOf(CONFIG_END_MARKER));

    expect(strip(changed)).toBe(strip(base));
  });

  it("carries the backend base URL from config, not a literal at the call site", () => {
    // PRD section 10.1: the base URL is configured in src/config/backend.ts and
    // never hardcoded at a call site. The canvas component cannot import it, so
    // the generator is the only legitimate way for it to arrive there.
    expect(readEmittedString(generateMeteredPaywallCode(config()).code, "apiBaseUrl")).toBe(API_BASE_URL);
  });
});

describe("creator text cannot break the file", () => {
  it("round trips a title full of quotes, backslashes, and template syntax", () => {
    const hostile = 'He said "members only" \\ and ${process.exit(1)} `tick`';
    const { code } = generateMeteredPaywallCode(config({ cardTitle: hostile }));

    // Decoding the emitted literal returns exactly what went in, which is only
    // true if the value was serialized rather than pasted into the source.
    expect(readEmittedString(code, "cardTitle")).toBe(hostile);
  });

  it("neutralises an attempt to close the literal and append code", () => {
    const breakout = '", apiBaseUrl: "https://evil.example.com';
    const { code } = generateMeteredPaywallCode(config({ cardDescription: breakout }));

    expect(readEmittedString(code, "cardDescription")).toBe(breakout);
    // The real assertion: the injected key did not become a second assignment.
    expect(readEmittedString(code, "apiBaseUrl")).toBe(API_BASE_URL);
    expect(code).not.toContain('evil.example.com",\n};');
  });

  it("collapses newlines and the two invisible line separators", () => {
    // U+2028 and U+2029 pass through JSON.stringify raw and are line
    // terminators to an older parser, so a title carrying one could parse
    // differently than it reads. They are removed, not escaped.
    const separators = String.fromCharCode(0x2028, 0x2029);
    const messy = `Top${separators}line\nsecond\tthird`;

    expect(normalizeMeteredPaywallConfig(config({ cardTitle: messy })).cardTitle).toBe("Top line second third");
  });

  it("caps the free-text fields rather than embedding an essay", () => {
    const long = "a".repeat(5000);
    const normalized = normalizeMeteredPaywallConfig(config({ cardTitle: long, cardDescription: long }));

    expect(normalized.cardTitle.length).toBe(200);
    expect(normalized.cardDescription.length).toBe(500);
  });

  it("trims, because padding a label is not content", () => {
    expect(normalizeMeteredPaywallConfig(config({ cardTitle: "   Members Only   " })).cardTitle).toBe("Members Only");
  });
});

describe("numeric ranges", () => {
  it("clamps the blur radius into the control's range", () => {
    expect(generateMeteredPaywallCode(config({ blurIntensity: 999 })).config.blurIntensity).toBe(BLUR_MAX);
    expect(generateMeteredPaywallCode(config({ blurIntensity: 0 })).config.blurIntensity).toBe(BLUR_MIN);
  });
});

describe("it refuses a broken authored component", () => {
  it("throws when the marker pair is missing", () => {
    expect(() => generateMeteredPaywallCode(config(), "const x = 1;")).toThrow(CodeGenerationError);
  });

  it("throws when the markers appear twice", () => {
    const doubled = [CONFIG_START_MARKER, CONFIG_END_MARKER, CONFIG_START_MARKER, CONFIG_END_MARKER].join("\n");

    expect(() => generateMeteredPaywallCode(config(), doubled)).toThrow(/found 2 start and 2 end/);
  });

  it("throws when the output would lose the lock-state signature", () => {
    const noLockState = [CONFIG_START_MARKER, "const CONFIG = {};", CONFIG_END_MARKER].join("\n");

    expect(() => generateMeteredPaywallCode(config(), noLockState)).toThrow(/lock-state line/);
  });
});

describe("buildConfigBlock", () => {
  it("opens and closes with the markers, so the replacement is self-delimiting", () => {
    const block = buildConfigBlock(METERED_PAYWALL_DESCRIPTOR, config());

    expect(block.startsWith(CONFIG_START_MARKER)).toBe(true);
    expect(block.endsWith(CONFIG_END_MARKER)).toBe(true);
  });

  it("declares the same type annotation the authored component expects", () => {
    expect(buildConfigBlock(METERED_PAYWALL_DESCRIPTOR, config())).toContain("const CONFIG: PaywallConfig = {");
  });

  it("emits the session TTL as a number, not a string", () => {
    expect(readEmittedNumber(buildConfigBlock(METERED_PAYWALL_DESCRIPTOR, config()), "sessionTtlMs")).toBeGreaterThan(0);
  });
});
