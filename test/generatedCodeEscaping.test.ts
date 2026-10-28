/**
 * Marketplace audit I6: creator text cannot break out of generated code.
 *
 * Every generator, with every string field and every connection value set to
 * text built to escape a string literal, a template literal, a style element,
 * or a comment. Three things must hold for each component:
 *
 *   1. The file still parses: TypeScript reports no syntax error.
 *   2. The CONFIG block reads back to exactly the normalized values, so the
 *      text arrived as data and nothing else.
 *   3. Everything outside the CONFIG block is byte-identical to a deploy with
 *      the defaults: no value leaked into the component's code.
 */

import ts from "typescript";
import { describe, expect, it } from "vitest";
import {
  AUTH_SCREEN_DESCRIPTORS,
  CONFIG_END_MARKER,
  CONFIG_START_MARKER,
  DISCONNECTED_DEPLOY_CONTEXT,
  generateAuthScreenCode,
  generateBookmarkButtonCode,
  generateBookmarksTrayCode,
  generateMemberAuthCode,
  generateMemberDashboardCode,
  generateMemberPricingCode,
  generateMeteredPaywallCode,
  generateProtectedDownloadCode,
  type DeployContext,
  type GeneratedCanvasFile,
} from "../src/services/canvasComponentCodeGenerator";
import {
  DEFAULT_BOOKMARKS_TRAY_CONFIG,
  DEFAULT_BOOKMARK_BUTTON_CONFIG,
  DEFAULT_MEMBER_AUTH_CONFIG,
  DEFAULT_MEMBER_DASHBOARD_CONFIG,
  DEFAULT_MEMBER_PRICING_CONFIG,
  DEFAULT_METERED_PAYWALL_CONFIG,
  DEFAULT_PROTECTED_DOWNLOAD_CONFIG,
} from "../src/types/canvas";

const SEP = String.fromCharCode(0x2028);
const HOSTILE = `a"b'c\`d\${process.exit()}e</style><script>alert(1)</script>\\f/* g */ // h${SEP}i`;

/** Every string field of a config replaced with the hostile text. */
function hostile<T extends object>(config: T): T {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(config)) out[key] = typeof value === "string" ? HOSTILE : value;
  return out as T;
}

const HOSTILE_CONTEXT: DeployContext = {
  apiBaseUrl: HOSTILE,
  siteKey: HOSTILE,
  afterLoginPath: HOSTILE,
  loginPath: HOSTILE,
  afterLogoutPath: HOSTILE,
  signupPath: HOSTILE,
  resetPath: HOSTILE,
  pricingPath: HOSTILE,
  tiers: [{ key: "gold_plus", name: HOSTILE, rank: 1 }],
};

type Generate = (hostileInput: boolean) => GeneratedCanvasFile<unknown>;

const CASES: Array<[string, Generate]> = [
  ["MemberAuth", (bad) => generateMemberAuthCode(bad ? hostile(DEFAULT_MEMBER_AUTH_CONFIG) : DEFAULT_MEMBER_AUTH_CONFIG, undefined, bad ? HOSTILE_CONTEXT : DISCONNECTED_DEPLOY_CONTEXT)],
  ["MemberDashboard", (bad) => generateMemberDashboardCode(bad ? hostile(DEFAULT_MEMBER_DASHBOARD_CONFIG) : DEFAULT_MEMBER_DASHBOARD_CONFIG, undefined, bad ? HOSTILE_CONTEXT : DISCONNECTED_DEPLOY_CONTEXT)],
  ["MemberPricing", (bad) => generateMemberPricingCode(bad ? hostile(DEFAULT_MEMBER_PRICING_CONFIG) : DEFAULT_MEMBER_PRICING_CONFIG, undefined, bad ? HOSTILE_CONTEXT : DISCONNECTED_DEPLOY_CONTEXT)],
  ["MeteredPaywall", (bad) => generateMeteredPaywallCode(bad ? hostile(DEFAULT_METERED_PAYWALL_CONFIG) : DEFAULT_METERED_PAYWALL_CONFIG, undefined, bad ? HOSTILE_CONTEXT : DISCONNECTED_DEPLOY_CONTEXT)],
  ["ProtectedDownload", (bad) => generateProtectedDownloadCode(bad ? hostile(DEFAULT_PROTECTED_DOWNLOAD_CONFIG) : DEFAULT_PROTECTED_DOWNLOAD_CONFIG, undefined, bad ? HOSTILE_CONTEXT : DISCONNECTED_DEPLOY_CONTEXT)],
  ["BookmarkButton", (bad) => generateBookmarkButtonCode(bad ? hostile(DEFAULT_BOOKMARK_BUTTON_CONFIG) : DEFAULT_BOOKMARK_BUTTON_CONFIG, undefined, bad ? HOSTILE_CONTEXT : DISCONNECTED_DEPLOY_CONTEXT)],
  ["BookmarksTray", (bad) => generateBookmarksTrayCode(bad ? hostile(DEFAULT_BOOKMARKS_TRAY_CONFIG) : DEFAULT_BOOKMARKS_TRAY_CONFIG, undefined, bad ? HOSTILE_CONTEXT : DISCONNECTED_DEPLOY_CONTEXT)],
  ...(Object.keys(AUTH_SCREEN_DESCRIPTORS) as Array<keyof typeof AUTH_SCREEN_DESCRIPTORS>).map(
    (id): [string, Generate] => [
      `auth screen ${id}`,
      (bad) => generateAuthScreenCode(id, bad ? hostile(DEFAULT_MEMBER_AUTH_CONFIG) : DEFAULT_MEMBER_AUTH_CONFIG, undefined, bad ? HOSTILE_CONTEXT : DISCONNECTED_DEPLOY_CONTEXT),
    ]
  ),
];

function syntaxErrors(code: string): string[] {
  const result = ts.transpileModule(code, {
    fileName: "Component.tsx",
    reportDiagnostics: true,
    compilerOptions: { jsx: ts.JsxEmit.Preserve, target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext },
  });
  return (result.diagnostics ?? []).map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"));
}

/** The code with the CONFIG block cut out, and the block's object literal. */
function split(code: string): { outside: string; literal: string } {
  const start = code.indexOf(CONFIG_START_MARKER);
  const end = code.indexOf(CONFIG_END_MARKER) + CONFIG_END_MARKER.length;
  const block = code.slice(start, end);
  const open = block.indexOf("= {");
  const close = block.lastIndexOf("};");
  return { outside: code.slice(0, start) + code.slice(end), literal: block.slice(open + 2, close + 1) };
}

/** Evaluate the object literal, which only ever holds strings, numbers, booleans, and one nested object. */
function readLiteral(literal: string): Record<string, unknown> {
  return new Function(`return (${literal});`)() as Record<string, unknown>;
}

describe("generated code keeps creator text as data (audit I6)", () => {
  for (const [name, generate] of CASES) {
    it(`${name}: parses, reads back exactly, and changes nothing outside CONFIG`, () => {
      const bad = generate(true);
      const good = generate(false);

      expect(syntaxErrors(bad.code), name).toEqual([]);

      const badParts = split(bad.code);
      const goodParts = split(good.code);
      const read = readLiteral(badParts.literal);
      for (const [key, value] of Object.entries(bad.config as Record<string, unknown>)) {
        expect(read[key], `${name}.${key}`).toEqual(value);
      }

      // The tier rewrite changes the Access Tier option lines on purpose; with
      // no tiers in the default context, compare everything else.
      const withoutTierLines = (code: string) =>
        code
          .split("\n")
          .filter((line) => !/^\s*(options|optionTitles): \[/.test(line))
          .join("\n");
      expect(withoutTierLines(badParts.outside), name).toBe(withoutTierLines(goodParts.outside));
    });
  }

  it("a hostile tier name is written into the option titles as a string, and still parses", () => {
    const code = generateMeteredPaywallCode(DEFAULT_METERED_PAYWALL_CONFIG, undefined, HOSTILE_CONTEXT).code;
    expect(syntaxErrors(code)).toEqual([]);
    expect(code).toContain('"gold_plus"');
  });

  it("no raw line separator survives into any generated file", () => {
    for (const [name, generate] of CASES) expect(generate(true).code.includes(SEP), name).toBe(false);
  });
});
