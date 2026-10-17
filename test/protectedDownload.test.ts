/**
 * FP-12 and PRD F10: the published half of Upgrade to Download.
 *
 * The server half (signing, expiry, tier refusal, cross-site isolation) is
 * proved in the API's own suite and end to end. These pin what the published
 * component must and must not do.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { generateProtectedDownloadCode } from "../src/services/canvasComponentCodeGenerator";
import { DEFAULT_PROTECTED_DOWNLOAD_CONFIG } from "../src/types/canvas";
import { assetSummary, formatBytes } from "../src/services/assetsService";
import { fileTierOptions } from "../src/components/manage/FilesPanel";

const source = readFileSync(path.join(process.cwd(), "src", "canvas-components", "ProtectedDownload.tsx"), "utf-8");

describe("the published component", () => {
  it("knows a file only by its Asset ID: no storage address can be in it", () => {
    for (const leak of ["s3://", "amazonaws.com", "r2.cloudflarestorage.com", "storageKey", "remoteUrl", "X-Amz-"]) {
      expect(source, leak).not.toContain(leak);
    }
  });

  it("locks out a second click while a link is being signed (criterion 5)", () => {
    expect(source).toContain("if (busy.current || load.phase !== \"ready\") return;");
    expect(source).toContain("busy.current = true;");
    expect(source).toContain('if (action.phase === "signing") return { ...base, title: t("preparing"), meta, disabled: true, spinning: true };');
  });

  it("asks the server, never decides from its own props", () => {
    expect(source).not.toMatch(/requiredTier\??:\s*(RequiredTier|string);\s*\n\s*\/\*\*/);
    expect(source).toContain("/api/assets/sign-download-url");
    expect(source).toContain("if (response.status === 403) {");
    expect(source).toContain('setLoad({ ...load, access: "upgrade" });');
  });

  it("sends a signed-out visitor to sign in and back, and an under-plan member to pricing", () => {
    expect(source).toContain("goTo(loginPath, CONFIG.loginPath);");
    expect(source).toContain("onPress: () => goTo(pricingPath, CONFIG.pricingPath),");
    expect(source).toContain("rememberReturn();");
  });

  it("follows only an http(s) link the server returns", () => {
    expect(source).toContain("!/^https?:\\/\\//.test(body.signedUrl)");
  });
});

describe("the generated file", () => {
  it("bakes in the connection and keeps the button copy safe", () => {
    const { code, config } = generateProtectedDownloadCode(
      { ...DEFAULT_PROTECTED_DOWNLOAD_CONFIG, buttonText: 'Get "it"\n', iconType: "nope" as never, defaultAssetId: "ast_abc123" },
      undefined,
      { apiBaseUrl: "https://api.example.com", siteKey: "k1", afterLoginPath: "", loginPath: "/login", afterLogoutPath: "/" }
    );
    expect(config.iconType).toBe("download");
    expect(config.defaultAssetId).toBe("ast_abc123");
    expect(code).toContain('buttonText: "Get \\"it\\"",');
    expect(code).toContain('siteKey: "k1",');
    expect(code).toContain('defaultAssetId: "ast_abc123",');
    expect(code).toContain('defaultValue: CONFIG.defaultAssetId || "",');
  });
});

describe("Manage, Files", () => {
  it("offers any signed-in member, then the site's tiers by rank", () => {
    expect(
      fileTierOptions([
        { key: "vip", name: "VIP", rank: 3 },
        { key: "free_member", name: "Free", rank: 0 },
        { key: "tier_2", name: "Gold", rank: 2 },
      ])
    ).toEqual([
      { value: "signed_in", label: "Any signed in member" },
      { value: "free_member", label: "Free or higher" },
      { value: "tier_2", label: "Gold or higher" },
      { value: "vip", label: "VIP only" },
    ]);
  });

  it("labels sizes and files the way the button does", () => {
    expect(formatBytes(0)).toBe("");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(44_040_192)).toBe("42 MB");
    expect(
      assetSummary({
        id: "ast_x",
        name: "Kit",
        fileName: "kit.zip",
        mimeType: "application/zip",
        sizeBytes: 44_040_192,
        source: "url",
        remoteUrl: "https://cdn.example.com/kit.zip",
        requiredTier: "tier_1",
        downloadCount: 0,
        lastDownloadAt: null,
        createdAt: "",
      })
    ).toBe("ZIP, 42 MB, linked");
  });
});
