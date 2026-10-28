/**
 * Marketplace review problems 2 and 8: the shipped plugin has one fixed,
 * public HTTPS backend and no dev wiring. Development doc:
 * 36-marketplace-review-fix-workflow.md step 1.
 *
 * Vitest runs in dev mode, so the production cases stub `import.meta.env.PROD`
 * and re-import the modules that read it at load time.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PRODUCTION_API_BASE_URL,
  assertProductionApiBaseUrl,
  isLoopbackUrl,
} from "../src/config/productionApi";
import {
  DEV_ONLY_END_MARKER,
  DEV_ONLY_START_MARKER,
  stripDevOnlyBlocks,
} from "../src/config/devOnlyBlocks";
import {
  DEFAULT_BOOKMARK_BUTTON_CONFIG,
  DEFAULT_BOOKMARKS_TRAY_CONFIG,
  DEFAULT_MEMBER_AUTH_CONFIG,
  DEFAULT_MEMBER_DASHBOARD_CONFIG,
  DEFAULT_MEMBER_PRICING_CONFIG,
  DEFAULT_METERED_PAYWALL_CONFIG,
  DEFAULT_PROTECTED_DOWNLOAD_CONFIG,
} from "../src/types/canvas";

async function loadProduction() {
  vi.resetModules();
  vi.stubEnv("PROD", true);
  vi.stubEnv("DEV", false);
  vi.stubEnv("VITE_API_BASE_URL", "http://127.0.0.1:4000");
  return {
    backend: await import("../src/config/backend"),
    generator: await import("../src/services/canvasComponentCodeGenerator"),
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("the production backend address", () => {
  it("is public HTTPS", () => {
    expect(PRODUCTION_API_BASE_URL.startsWith("https://")).toBe(true);
    expect(isLoopbackUrl(PRODUCTION_API_BASE_URL)).toBe(false);
    expect(() => assertProductionApiBaseUrl(PRODUCTION_API_BASE_URL)).not.toThrow();
  });

  it("stops the build for anything else", () => {
    expect(() => assertProductionApiBaseUrl("http://app.framefic.com/memberframe")).toThrow();
    expect(() => assertProductionApiBaseUrl("https://localhost:4000")).toThrow();
    expect(() => assertProductionApiBaseUrl("https://127.0.0.1")).toThrow();
    expect(() => assertProductionApiBaseUrl("")).toThrow();
  });

  it("is what a production build uses, whatever the .env says", async () => {
    const { backend } = await loadProduction();
    expect(backend.API_BASE_URL).toBe(PRODUCTION_API_BASE_URL);
    expect(backend.deployBaseUrl()).toBe(PRODUCTION_API_BASE_URL);
    expect(backend.deployBaseUrl("http://127.0.0.1:4000")).toBe(PRODUCTION_API_BASE_URL);
  });
});

describe("stripDevOnlyBlocks", () => {
  const source = [
    "const a = 1;",
    `  ${DEV_ONLY_START_MARKER}`,
    "  dev();",
    `  ${DEV_ONLY_END_MARKER}`,
    "const b = 2;",
  ].join("\n");

  it("removes the block and its marker lines, nothing else", () => {
    expect(stripDevOnlyBlocks(source)).toBe("const a = 1;\nconst b = 2;");
  });

  it("leaves a source without markers untouched", () => {
    expect(stripDevOnlyBlocks("const a = 1;\n")).toBe("const a = 1;\n");
  });

  it("refuses an unpaired marker", () => {
    expect(() => stripDevOnlyBlocks(`x\n${DEV_ONLY_START_MARKER}\ny`)).toThrow();
    expect(() => stripDevOnlyBlocks(`x\n${DEV_ONLY_END_MARKER}\ny`)).toThrow();
  });
});

describe("a component deployed by a production build", () => {
  it("carries no ngrok wiring and no loopback address, in all seven components", async () => {
    const { generator: g } = await loadProduction();
    const files = [
      g.generateComponentCode(g.MEMBER_AUTH_DESCRIPTOR, DEFAULT_MEMBER_AUTH_CONFIG),
      g.generateComponentCode(g.MEMBER_DASHBOARD_DESCRIPTOR, DEFAULT_MEMBER_DASHBOARD_CONFIG),
      g.generateComponentCode(g.MEMBER_PRICING_DESCRIPTOR, DEFAULT_MEMBER_PRICING_CONFIG),
      g.generateComponentCode(g.METERED_PAYWALL_DESCRIPTOR, DEFAULT_METERED_PAYWALL_CONFIG),
      g.generateComponentCode(g.PROTECTED_DOWNLOAD_DESCRIPTOR, DEFAULT_PROTECTED_DOWNLOAD_CONFIG),
      g.generateComponentCode(g.BOOKMARK_BUTTON_DESCRIPTOR, DEFAULT_BOOKMARK_BUTTON_CONFIG),
      g.generateComponentCode(g.BOOKMARKS_TRAY_DESCRIPTOR, DEFAULT_BOOKMARKS_TRAY_CONFIG),
    ];

    for (const { fileName, code } of files) {
      expect(code, fileName).not.toContain("ngrok");
      expect(code, fileName).not.toMatch(/127\.0\.0\.1|localhost/);
      expect(code, fileName).toContain(JSON.stringify(PRODUCTION_API_BASE_URL));
    }
  });

  it("is what the authored sources still keep for development", async () => {
    const g = await import("../src/services/canvasComponentCodeGenerator");
    expect(g.MEMBER_AUTH_DESCRIPTOR.source).toContain("ngrok-skip-browser-warning");
    expect(g.generateComponentCode(g.MEMBER_AUTH_DESCRIPTOR, DEFAULT_MEMBER_AUTH_CONFIG).code).toContain("ngrok-skip-browser-warning");
  });
});
