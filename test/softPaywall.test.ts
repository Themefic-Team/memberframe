/**
 * FP-07 and F08: the soft paywall, run from the code that ships.
 *
 * The meter and the schema helper live inside `MeteredPaywall.tsx`, which is
 * compiled by Framer alone and cannot be imported here. So, like the shared
 * appearance block, each marked block is cut out of the source, transpiled,
 * and executed. What these tests prove is what a visitor's browser runs.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { generateMeteredPaywallCode } from "../src/services/canvasComponentCodeGenerator";
import { DEFAULT_METERED_PAYWALL_CONFIG } from "../src/types/canvas";

const DIR = path.join(process.cwd(), "src", "canvas-components");
const paywall = readFileSync(path.join(DIR, "MeteredPaywall.tsx"), "utf-8");

function cut(source: string, name: string): string {
  const start = source.indexOf(`// @memberframe-${name}-start`);
  const endMarker = `// @memberframe-${name}-end`;
  const end = source.indexOf(endMarker);
  if (start === -1 || end === -1) throw new Error(`${name} markers missing`);
  return source.slice(start, end + endMarker.length);
}

function load<T>(block: string, names: string[]): T {
  const js = ts.transpileModule(block, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None },
  }).outputText;
  // eslint-disable-next-line no-new-func
  return new Function(`${js}\nreturn { ${names.join(", ")} };`)() as T;
}

interface Answer {
  allowed: boolean;
  alreadyRead: boolean;
  count: number;
  limit: number;
  remaining: number;
  position: number | null;
  cycleStart: number;
  resetsAt: number;
}
interface State {
  slugs: string[];
  cycleStart: number;
}
interface Device {
  deviceId: string;
  periodDays: number;
  slugs: string[];
  cycleStart: number;
}

const meter = load<{
  decideMeter(state: State | null, slug: string, limit: number, periodDays: number, now: number, reads?: string[]): { state: State; answer: Answer };
  encodeMeter(record: Device, seed: string): string;
  decodeMeter(raw: string | null, seed: string): Device | null;
  currentDeviceReads(record: Device | null, periodDays: number, now: number): string[];
  articleSlug(articleId: string, pathname: string): string;
  meterPillKeys(answer: Answer): { main: string; sub: string };
}>(cut(paywall, "meter"), ["decideMeter", "encodeMeter", "decodeMeter", "currentDeviceReads", "articleSlug", "meterPillKeys"]);

const DAY = 86_400_000;
const start = 1_700_000_000_000;

describe("the device meter, PRD F07 acceptance criteria", () => {
  function readAll(slugs: string[], limit = 3, now = start, periodDays = 30) {
    let state: State | null = null;
    const answers: Answer[] = [];
    for (const slug of slugs) {
      const result = meter.decideMeter(state, slug, limit, periodDays, now);
      state = result.state;
      answers.push(result.answer);
    }
    return { state, answers };
  }

  it("shows article 1, 2 and 3 of 3, then locks article 4", () => {
    const { answers } = readAll(["/a", "/b", "/c", "/d"]);
    expect(answers.map((answer) => answer.position)).toEqual([1, 2, 3, null]);
    expect(answers.map((answer) => answer.allowed)).toEqual([true, true, true, false]);
  });

  it("does not take another credit for an article read again (criterion 1)", () => {
    const { answers, state } = readAll(["/a", "/a", "/a", "/b"]);
    expect(answers.map((answer) => answer.remaining)).toEqual([2, 2, 2, 1]);
    expect(answers[1]?.alreadyRead).toBe(true);
    expect(state?.slugs).toEqual(["/a", "/b"]);
  });

  it("resets exactly at cycle start plus the window (criterion 2)", () => {
    const { state } = readAll(["/a", "/b", "/c"]);
    expect(meter.decideMeter(state, "/d", 3, 30, start + 30 * DAY - 1).answer.allowed).toBe(false);
    expect(meter.decideMeter(state, "/d", 3, 30, start + 30 * DAY).answer).toMatchObject({ allowed: true, position: 1 });
    expect(meter.decideMeter(state, "/d", 3, 7, start + 7 * DAY).answer.allowed).toBe(true);
  });

  it("matches the server's rule on the same scenarios, so signing in changes nothing", () => {
    // The API's decideMeter (services/meterService.ts) is tested on these same
    // cases in the backend suite. Folding the device reads into a new cycle:
    expect(meter.decideMeter(null, "c", 3, 30, start, ["a", "b", "a"]).answer).toMatchObject({ position: 3, remaining: 0 });
    expect(meter.decideMeter(null, "d", 3, 30, start, ["a", "b", "c"]).answer.allowed).toBe(false);
  });

  it("keeps 500 tracked slugs within a few kilobytes of storage (criterion 6)", () => {
    const record: Device = {
      deviceId: "0123456789abcdef01234567",
      periodDays: 30,
      slugs: Array.from({ length: 500 }, (_, index) => `/blog/an-article-with-a-long-slug-${index}`),
      cycleStart: start,
    };
    const encoded = meter.encodeMeter(record, "seed");
    // localStorage allows about 5 MB per origin; this is a small fraction of it.
    expect(encoded.length).toBeLessThan(64 * 1024);
    expect(meter.decodeMeter(encoded, "seed")?.slugs.length).toBe(500);
  });
});

describe("device storage", () => {
  const record: Device = { deviceId: "abc", periodDays: 30, slugs: ["/a", "/b"], cycleStart: start };

  it("round-trips, and is not readable JSON in storage", () => {
    const encoded = meter.encodeMeter(record, "memberframe-meter:site");
    expect(encoded.startsWith("v1.")).toBe(true);
    expect(encoded).not.toContain("slugs");
    expect(meter.decodeMeter(encoded, "memberframe-meter:site")).toEqual(record);
  });

  it("rejects an edited value, another site's value, and junk", () => {
    const encoded = meter.encodeMeter(record, "memberframe-meter:site");
    const [version, body, sum] = encoded.split(".");
    const flipped = `${version}.${body?.slice(0, -2)}AA.${sum}`;
    expect(meter.decodeMeter(flipped, "memberframe-meter:site")).toBeNull();
    expect(meter.decodeMeter(`${version}.${body}.00000000`, "memberframe-meter:site")).toBeNull();
    expect(meter.decodeMeter(encoded, "memberframe-meter:other")).toBeNull();
    expect(meter.decodeMeter("not a meter", "x")).toBeNull();
    expect(meter.decodeMeter(null, "x")).toBeNull();
  });

  it("hands a member's server meter only the device's current-cycle reads", () => {
    expect(meter.currentDeviceReads(record, 30, start + DAY)).toEqual(["/a", "/b"]);
    expect(meter.currentDeviceReads(record, 30, start + 30 * DAY)).toEqual([]);
    expect(meter.currentDeviceReads(record, 7, start + DAY)).toEqual([]);
    expect(meter.currentDeviceReads(null, 30, start)).toEqual([]);
  });

  it("identifies an article by its Article ID, else its path", () => {
    expect(meter.articleSlug("", "/blog/post/")).toBe("/blog/post");
    expect(meter.articleSlug("", "/")).toBe("/");
    expect(meter.articleSlug("scaling-framer", "/blog/x")).toBe("scaling-framer");
    expect(meter.articleSlug("", "/blog/café menu")).toBe("/blog/caf--menu");
    expect(meter.articleSlug("x".repeat(400), "/").length).toBe(191);
  });
});

describe("counter copy pluralizes (criterion 4)", () => {
  const labels = Object.fromEntries(
    [...paywall.matchAll(/^\s{2}(pill[A-Za-z]+): \["[^"]*", "([^"]*)"\]/gm)].map((match) => [match[1], match[2]])
  ) as Record<string, string>;

  function text(position: number, limit: number) {
    const answer: Answer = {
      allowed: true,
      alreadyRead: false,
      count: position,
      limit,
      remaining: limit - position,
      position,
      cycleStart: start,
      resetsAt: start,
    };
    const keys = meter.meterPillKeys(answer);
    const fill = (value: string) =>
      value
        .split("{n}").join(String(position))
        .split("{limit}").join(String(limit))
        .split("{period}").join("month")
        .split("{remaining}").join(String(limit - position));
    return `${fill(labels[keys.main] ?? "")} | ${fill(labels[keys.sub] ?? "")}`;
  }

  it("reads naturally at every count", () => {
    expect(text(1, 3)).toBe("Article 1 of 3 free articles this month | 2 free articles remaining");
    expect(text(2, 3)).toBe("Article 2 of 3 free articles this month | 1 free article remaining");
    expect(text(3, 3)).toBe("Article 3 of 3 free articles this month | Last free article");
    expect(text(1, 1)).toBe("Your free article this month | Last free article");
  });
});

describe("the counter is optional, the meter is not (criterion 5)", () => {
  it("decides lock and open without reading showCounterPill", () => {
    const decide = paywall.slice(paywall.indexOf("async function decide("), paywall.indexOf("void decide(false);"));
    expect(decide).not.toContain("showCounterPill");
    // And only the first paywall on a page shows it.
    expect(paywall).toContain("if (!showCounterPill || pillClosed || meter.position === null || !leadsPage) return null;");
  });
});

describe("F08: Schema.org paywall markup", () => {
  const block = cut(paywall, "schema");
  const schema = load<{ mfPaywallSchema(type: string, headline: string, url: string): string; MF_GATED_BODY_CLASS: string }>(
    block,
    ["mfPaywallSchema", "MF_GATED_BODY_CLASS"]
  );

  it("emits valid JSON-LD that marks the gated body as not free", () => {
    const json = JSON.parse(schema.mfPaywallSchema("NewsArticle", "Scaling Framer", "https://example.com/blog/x"));
    expect(json).toEqual({
      "@context": "https://schema.org",
      "@type": "NewsArticle",
      headline: "Scaling Framer",
      url: "https://example.com/blog/x",
      isAccessibleForFree: "False",
      hasPart: { "@type": "WebPageElement", isAccessibleForFree: "False", cssSelector: ".memberframe-gated-body" },
    });
  });

  it("points cssSelector at the class the paywall puts on the gated content", () => {
    expect(schema.MF_GATED_BODY_CLASS).toBe("memberframe-gated-body");
    expect(paywall).toContain("linkedArticle.classList.add(MF_GATED_BODY_CLASS);");
  });

  it("cannot be broken out of its script element, and falls back to Article for an unknown type", () => {
    const text = schema.mfPaywallSchema("Bogus", "</script><script>alert(1)</script>", "https://x.test");
    expect(text).not.toContain("<");
    expect(JSON.parse(text)["@type"]).toBe("Article");
    expect(JSON.parse(schema.mfPaywallSchema("Article", "x".repeat(300), "u")).headline).toHaveLength(110);
  });

  it("keeps the article in the page for every visitor: cut with CSS, never removed", () => {
    // Crawler and person receive the same markup (F08 criterion 3).
    expect(paywall).toContain("clip-path: inset(0 0 calc(100% - ${cutAt}px) 0) !important;");
    expect(paywall).not.toContain("removeChild");
  });

  it("keeps focus and screen readers out of the frosted text (criterion 5)", () => {
    expect(paywall).toContain('if (locked) body.setAttribute("inert", "");');
  });
});

describe("the generated paywall", () => {
  const context = {
    apiBaseUrl: "https://api.example.com",
    siteKey: "site_123",
    afterLoginPath: "",
    loginPath: "/sign-in",
    afterLogoutPath: "/",
    tiers: [
      { key: "free_member", name: "Free", rank: 0 },
      { key: "pro_plus", name: "Pro \"Plus\"", rank: 2 },
      { key: "tier_1", name: "Silver", rank: 1 },
    ],
  };

  it("bakes in the connection and the clamped config", () => {
    const { code, config } = generateMeteredPaywallCode({ ...DEFAULT_METERED_PAYWALL_CONFIG, freeQuotaCount: 999 }, undefined, context);
    expect(config.freeQuotaCount).toBe(100);
    expect(code).toContain('siteKey: "site_123",');
    expect(code).toContain('apiBaseUrl: "https://api.example.com",');
    expect(code).toContain('loginPath: "/sign-in",');
    expect(code).toContain("freeQuotaCount: 100,");
  });

  it("sends its buttons to the site's own pricing page, from Payments", () => {
    expect(generateMeteredPaywallCode(DEFAULT_METERED_PAYWALL_CONFIG, undefined, { ...context, pricingPath: "/plans" }).code).toContain('pricingPath: "/plans",');
    expect(generateMeteredPaywallCode(DEFAULT_METERED_PAYWALL_CONFIG, undefined, context).code).toContain('pricingPath: "/pricing",');
    expect(generateMeteredPaywallCode(DEFAULT_METERED_PAYWALL_CONFIG, undefined, { ...context, pricingPath: "//evil.example" }).code).toContain('pricingPath: "/pricing",');
  });

  it("lists the site's tiers, by rank and escaped, under Full Access For", () => {
    const { code } = generateMeteredPaywallCode(DEFAULT_METERED_PAYWALL_CONFIG, undefined, context);
    // The locks' first group, same words and order; Free is any signed-in member.
    expect(code).toContain('    options: ["signed_in", "any_paid", "tier_1", "pro_plus", "chosen"],');
    expect(code).toContain(
      '    optionTitles: ["Any signed-in member", "Any paid plan", "Silver members or higher", "Pro \\"Plus\\" members or higher", "Only chosen tiers…"],'
    );
  });

  it("lists the site's tiers under Full Access Tiers, for Chosen Tiers", () => {
    const { code } = generateMeteredPaywallCode(DEFAULT_METERED_PAYWALL_CONFIG, undefined, context);
    expect(code).toContain('    options: ["free_member", "tier_1", "pro_plus"],');
    expect(code).toContain("hidden: (props) => props.unlimitedTier !== \"chosen\",");
  });
});
