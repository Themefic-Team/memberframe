/**
 * F19's license block in the canvas components. Development doc:
 * 19-pro-lock-and-trial.md section 3.
 *
 * Framer compiles each component alone, so the watermark and the lock are
 * copied into every licensed file; this keeps the copies identical, keeps them
 * out of the bookmarks (product owner: too small for either), and runs the
 * block's fetch to prove the server's word maps onto the three states.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

const DIR = path.join(process.cwd(), "src", "canvas-components");
const LICENSED = ["MemberAuth", "MemberDashboard", "MemberPricing", "MeteredPaywall", "ProtectedDownload"] as const;
const UNLICENSED = ["BookmarkButton", "BookmarksTray"] as const;
const read = (name: string) => readFileSync(path.join(DIR, `${name}.tsx`), "utf-8");

const START = "// @memberframe-license-start";
const END = "// @memberframe-license-end";

function block(source: string): string {
  const start = source.indexOf(START);
  const end = source.indexOf(END);
  if (start === -1 || end === -1) throw new Error("license markers missing");
  return source.slice(start, end + END.length);
}

describe("the shared license block", () => {
  const reference = block(read("MemberAuth"));

  it("is byte-identical in every licensed component", () => {
    for (const name of LICENSED) expect(block(read(name)), name).toBe(reference);
  });

  it("names no component, so it stays shareable", () => {
    for (const name of [...LICENSED, ...UNLICENSED]) expect(reference).not.toContain(name);
  });

  it("is drawn last in each licensed component, from the server's answer for this sealed instance", () => {
    for (const name of LICENSED) {
      const source = read(name);
      expect(source, name).toContain("const license = useMfLicense(CONFIG.apiBaseUrl, CONFIG.siteKey, props.mfSeal);");
      // A site this server does not know locks, rather than trusting the baked state.
      expect(source, name).toContain('body.reason === "site_not_found" ? { state: "copied" } : null');
      // Re-checked while open, so an ended trial locks without a reload.
      expect(source, name).toContain("window.setInterval(check, MF_LICENSE_RECHECK_MS)");
      // 27-instance-seal.md: the Builder's seal travels in a hidden control.
      expect(source, name).toContain('mfSeal: { type: ControlType.String, title: "Seal", hidden: () => true },');
      expect(source, name).toContain("<MfLicenseLayer license={license} />");
      // The drafts it replaced are gone.
      expect(source, name).not.toMatch(/prolock|Trial Version|Component Locked/);
    }
  });

  it("is absent from the bookmarks, which show neither the mark nor the lock", () => {
    for (const name of UNLICENSED) {
      const source = read(name);
      expect(source, name).not.toContain(START);
      expect(source, name).not.toMatch(/MfLicenseLayer|-watermark|prolock/);
    }
  });

  it("copies the BEAF watermark: bottom right, the Framefic mark, linking to framefic.com", () => {
    expect(reference).toContain('href="https://framefic.com"');
    expect(reference).toContain("Made with");
    expect(reference).toMatch(/\.mf-wm \{ position: absolute; bottom: 10px; right: 12px;/);
    expect(reference).toContain("linear-gradient(135deg, #5271ff 0%, #3557ff 100%)");
  });
});

describe("what the block reads from the server", () => {
  const js = ts.transpileModule(block(read("MemberAuth")), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None, jsx: ts.JsxEmit.React },
  }).outputText;

  const load = (baked: { locked: boolean; trial: boolean }) =>
    // eslint-disable-next-line no-new-func
    new Function("IS_LOCKED", "IS_TRIAL", "React", "useState", "useEffect", `${js}\nreturn { mfBakedLicense, mfFetchLicense };`)(
      baked.locked,
      baked.trial,
      { createElement: () => null },
      () => [null, () => undefined],
      () => undefined
    ) as {
      mfBakedLicense(): string;
      mfFetchLicense(base: string, key: string): Promise<string | null>;
    };

  it("starts from the four baked lines", () => {
    expect(load({ locked: true, trial: false }).mfBakedLicense()).toBe("locked");
    expect(load({ locked: false, trial: true }).mfBakedLicense()).toBe("trial");
    expect(load({ locked: false, trial: false }).mfBakedLicense()).toBe("active");
  });

  it("maps the server's three words, and keeps the baked state when the server cannot be reached", async () => {
    const answers: Record<string, unknown> = { a: { state: "active" }, t: { state: "trial" }, e: { state: "expired" } };
    vi.stubGlobal("window", {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const key = new URL(url).searchParams.get("site") ?? "";
        if (key === "down") throw new Error("offline");
        return { ok: true, json: async () => answers[key] };
      })
    );
    const { mfFetchLicense } = load({ locked: false, trial: false });
    expect(await mfFetchLicense("https://api.example.com/", "a")).toBe("active");
    expect(await mfFetchLicense("https://api.example.com", "t")).toBe("trial");
    expect(await mfFetchLicense("https://api.example.com", "e")).toBe("locked");
    expect(await mfFetchLicense("https://api.example.com", "down")).toBeNull();
    expect(await mfFetchLicense("https://api.example.com", "")).toBeNull();
    vi.unstubAllGlobals();
  });
});
