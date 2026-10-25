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

describe("uploaded on the canvas, stored by Framer (32-canvas-downloads.md)", () => {
  const controls = source.slice(source.indexOf("addPropertyControls(ProtectedDownload"));
  const destructure = source.slice(source.indexOf("export default function ProtectedDownload("), source.indexOf("} = props;"));

  it("takes the file, its name, and who may download it in the sidebar, like the other content blocks", () => {
    expect(controls).toMatch(/file: \{\s*type: ControlType\.File,\s*title: "File",\s*allowedFileTypes: \[/);
    expect(controls).toMatch(/access: \{\s*type: ControlType\.Enum,\s*title: "Access",\s*options: \["members", "password"\],/);
    expect(controls).toContain('options: ["signed_in", "any_paid", "tier_1", "tier_2", "vip", "chosen"],');
    expect(controls).toMatch(/whoCanDownload: \{[\s\S]*?hidden: \(props\) => props\.access === "password",/);
    expect(controls).toMatch(/chosenTiers: \{[\s\S]*?hidden: \(props\) => props\.access === "password" \|\| props\.whoCanDownload !== "chosen",/);
    expect(controls).toMatch(/password: \{[\s\S]*?hidden: \(props\) => props\.access !== "password",/);
    // No help text under File, Who Can Download, or Password (2026-10-22).
    for (const name of ["file", "whoCanDownload", "password"]) {
      const start = controls.indexOf(`  ${name}: {`);
      expect(controls.slice(start, controls.indexOf("\n  },", start)), name).not.toContain("description:");
    }
    // Typed as dots in the sidebar, like any password field.
    expect(controls).toMatch(/password: \{[\s\S]*?obscured: true,/);
    // Set by the plugin; never typed.
    expect(controls).toMatch(/assetId: \{[\s\S]*?hidden: \(\) => true,/);
  });

  it("never sends or links the file's address or the sidebar's password", () => {
    // The password prop is not even read; only what the visitor typed is sent.
    expect(destructure).not.toMatch(/\bpassword\b/);
    expect(source).toContain('body: JSON.stringify(load.access === "password" ? { assetId: id, password: typedPassword } : { assetId: id }),');
    // The file prop is read only to tell whether it still waits for the plugin.
    expect(source).toContain('const unsecured = typeof file === "string" && file.trim() !== "";');
    expect(source).not.toMatch(/href=\{file\}|assign\(file\)|fetch\(file/);
  });

  it("warns on the canvas until the plugin secures the file, and stays shut on the site", () => {
    expect(source).toContain('if (unsecured) return { ...base, meta: fileMetaLabel || "", note: t(savedButShown ? "clearFile" : "unsecured"), noteError: true };');
    expect(source).toContain('if (id === "" && unsecured) return { ...base, title: t("notReady"), disabled: true, locked: true };');
  });

  it("never sends a visitor to sign in for a file set to Password that the server has not switched yet", () => {
    expect(source).toContain('if (accessChoice === "password" && (access === "sign_in" || access === "upgrade")) {');
    const guard = source.indexOf('if (accessChoice === "password" && (access === "sign_in"');
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(source.indexOf('    if (access === "sign_in") {'));
  });

  it("asks for the password in a popup opened by the button, rendered into the page's body (2026-10-22)", () => {
    expect(source).toContain('import { createPortal } from "react-dom";');
    expect(source).toContain("setAsking(true);");
    expect(source).toMatch(/className="mf-download-dialog"\s*role="dialog"\s*aria-modal=\{true\}/);
    expect(source).toContain("document.body");
    // No password field next to the button any more.
    const main = source.slice(source.indexOf("  return (\n    <div className={`mf-download "));
    expect(main.slice(0, main.indexOf("{popup}"))).not.toContain('type="password"');
    // Right password: the popup closes as the download starts. Wrong: the error shows in the popup.
    expect(source).toContain('setAction({ phase: "started" });\n      setAsking(false);');
    expect(source).toMatch(/className="mf-download-dialog-error" role="alert"/);
    // Escape and the backdrop close it, never mid-request.
    expect(source).toContain('if (event.key === "Escape" && !busy.current) setAsking(false);');
  });

  it("asks a password file's visitor for the password, and says when it is wrong", () => {
    expect(source).toContain('type="password"');
    expect(source).toContain('if (response.status === 401 && load.access === "password") {');
    expect(source).toContain('setAction({ phase: "error", message: t("wrongPassword") });');
  });

  it("lists the site's own tiers in Who Can Download and Chosen Tiers", () => {
    const { code } = generateProtectedDownloadCode(DEFAULT_PROTECTED_DOWNLOAD_CONFIG, undefined, {
      apiBaseUrl: "https://api.example.com",
      siteKey: "k1",
      afterLoginPath: "",
      loginPath: "/login",
      afterLogoutPath: "/",
      tiers: [
        { key: "free_member", name: "Free", rank: 0 },
        { key: "tier_gold", name: "Gold", rank: 2 },
        { key: "tier_silver", name: "Silver", rank: 1 },
      ],
    });
    expect(code).toContain('    options: ["signed_in", "any_paid", "tier_silver", "tier_gold", "chosen"],');
    expect(code).toContain('    optionTitles: ["Any signed-in member", "Any paid plan", "Silver members or higher", "Gold members or higher", "Only chosen tiers…"],');
    expect(code).toContain('options: ["free_member", "tier_silver", "tier_gold"],');
  });
});

describe("no Files in Manage", () => {
  it("has no Files segment and no file picker in the Builder", () => {
    const manage = readFileSync(path.join(process.cwd(), "src", "components", "tabs", "ManageTab.tsx"), "utf-8");
    const builder = readFileSync(path.join(process.cwd(), "src", "components", "tabs", "BuilderTab.tsx"), "utf-8");
    expect(manage).not.toContain("FilesPanel");
    expect(manage).not.toContain('"files"');
    expect(builder).not.toContain("Attach file");
    expect(builder).not.toContain("fetchAssets");
  });
});
