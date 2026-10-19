/**
 * Real data on the canvas. Development doc: 22-canvas-real-data.md.
 *
 * Four components carry the same `mfCanvasPreview` helper, because a canvas
 * component cannot import from this repository. This holds the copies equal,
 * compiles the helper and runs it against a fake fetch, and checks each
 * component keeps its sample when the site has nothing to show.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

const DIR = path.join(process.cwd(), "src", "canvas-components");
const FILES = ["MemberPricing", "MemberDashboard", "ProtectedDownload"] as const;
const sources = Object.fromEntries(FILES.map((name) => [name, readFileSync(path.join(DIR, `${name}.tsx`), "utf-8")])) as Record<
  (typeof FILES)[number],
  string
>;

function block(source: string): string {
  const start = source.indexOf("// @memberframe-canvas-preview-start");
  const end = source.indexOf("// @memberframe-canvas-preview-end");
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
}

/** The helper, compiled and run with a fake window and fetch. */
function helper(fetchImpl: (url: string, init: { headers: Record<string, string> }) => Promise<unknown>) {
  const js = ts.transpileModule(block(sources.MemberPricing), { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
  const window = {} as Record<string, unknown>;
  const run = new Function("window", "fetch", `${js}\nreturn mfCanvasPreview;`);
  return run(window, fetchImpl) as (base: string, key: string, asset?: string) => Promise<Record<string, unknown> | null>;
}

describe("the shared helper", () => {
  it("is identical in all four components", () => {
    const first = block(sources.MemberPricing);
    for (const name of FILES) expect(block(sources[name]), name).toBe(first);
  });

  it("asks the preview endpoint once per address, with no credentials or site header", async () => {
    const fetchImpl = vi.fn(async (_url: string, _init: { headers: Record<string, string> }) => ({
      ok: true,
      json: async () => ({ pricing: { tiers: [] } }),
    }));
    const preview = helper(fetchImpl);

    await preview("https://api.example.com/", "pk_live_abc");
    await preview("https://api.example.com", "pk_live_abc");
    await preview("https://api.example.com", "pk_live_abc", "asset_1");

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[0][0]).toBe("https://api.example.com/api/preview?site=pk_live_abc");
    expect(fetchImpl.mock.calls[1][0]).toBe("https://api.example.com/api/preview?site=pk_live_abc&asset=asset_1");
    expect(fetchImpl.mock.calls[0][1]).toEqual({ headers: { Accept: "application/json" } });
  });

  it("answers null, never throws, when it cannot help", async () => {
    const failing = helper(async () => {
      throw new Error("offline");
    });
    expect(await failing("https://api.example.com", "pk_live_abc")).toBeNull();

    const refused = helper(async () => ({ ok: false, json: async () => ({}) }));
    expect(await refused("https://api.example.com", "pk_live_abc")).toBeNull();

    const unused = vi.fn();
    const notConnected = helper(unused);
    expect(await notConnected("", "pk_live_abc")).toBeNull();
    expect(await notConnected("https://api.example.com", "")).toBeNull();
    expect(unused).not.toHaveBeenCalled();
  });
});

describe("each component on the canvas", () => {
  it("Pricing shows the site's plans, and keeps the samples when there are none", () => {
    expect(sources.MemberPricing).toContain("mfCanvasPreview(base, CONFIG.siteKey)");
    expect(sources.MemberPricing).toContain("pricing.tiers.length > 0");
    expect(sources.MemberPricing).toContain('onCanvas ? { phase: "ready", pricing: PREVIEW_PRICING }');
  });

  it("the Dashboard shows the site's own questions", () => {
    expect(sources.MemberDashboard).toMatch(/data\["profileFields"\]/);
    expect(sources.MemberDashboard).toContain("fields.length === 0) return;");
  });

  it("the Dashboard puts the preview member on the site's top tier", () => {
    expect(sources.MemberDashboard).toContain("tier.rank > best.rank ? tier : best");
  });

  it("Protected Download shows the chosen file's real label and plan", () => {
    expect(sources.ProtectedDownload).toContain("mfCanvasPreview(CONFIG.apiBaseUrl, CONFIG.siteKey, id)");
    expect(sources.ProtectedDownload).toContain("canvasAsset ? fileMeta(canvasAsset)");
    expect(sources.ProtectedDownload).toContain("canvasAsset ? canvasAsset.requiredTierName");
  });
});

describe("a sample is labelled as one", () => {
  it("Pricing says on the canvas when its plans are samples", () => {
    expect(sources.MemberPricing).toContain("onCanvas && pricing === PREVIEW_PRICING ?");
    expect(sources.MemberPricing).toContain("Sample plans. Your own appear here");
  });
});
