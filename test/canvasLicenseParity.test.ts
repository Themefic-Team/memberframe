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
/** Every canvas component; the bookmarks joined on 2026-10-25. */
const LICENSED = ["MemberAuth", "MemberDashboard", "MemberPricing", "MeteredPaywall", "ProtectedDownload", "BookmarkButton", "BookmarksTray"] as const;
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
    for (const name of LICENSED) expect(reference).not.toContain(name);
  });

  it("is drawn last in each licensed component, from the server's answer for this sealed instance", () => {
    for (const name of LICENSED) {
      const source = read(name);
      expect(source, name).toContain("const license = useMfLicense(CONFIG.apiBaseUrl, CONFIG.siteKey, props.mfSeal);");
      // A site this server does not know locks, rather than trusting the baked state.
      expect(source, name).toContain('body.reason === "site_not_found" ? { state: "copied" } : null');
      // Asked on mount and on a return after ten minutes, never on a timer: the
      // plugin's license push rewrites the baked lines on the canvas.
      expect(source, name).toContain("Date.now() - checkedAt >= MF_LICENSE_STALE_MS");
      expect(source, name).toContain('+ "|" + mfBakedLicense();');
      expect(block(source), name).not.toContain("setInterval");
      // 27-instance-seal.md: the Builder's seal travels in a hidden control.
      expect(source, name).toContain('mfSeal: { type: ControlType.String, title: "Seal", hidden: () => true },');
      expect(source, name).toContain("<MfLicenseLayer license={license} />");
      // The drafts it replaced are gone.
      expect(source, name).not.toMatch(/prolock|Trial Version|Component Locked/);
    }
  });

  it("shrinks the mark and the lock to an icon on a small component, such as a bookmark button", () => {
    expect(reference).toContain("@container (max-height: 64px) or (max-width: 200px) { .mf-wm {");
    expect(reference).toContain("@container (max-height: 64px) or (max-width: 140px) { .mf-lock {");
    expect(reference).toContain('<div className="mf-wm-frame">');
  });

  it("keeps a locked tray shut, since its drawer opens outside the lock card", () => {
    expect(read("BookmarksTray")).toContain('const showDrawer = usable && (onCanvas ? canvasPreview === "open" : open);');
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

  const helpers = (locked: boolean) =>
    // eslint-disable-next-line no-new-func
    new Function("IS_LOCKED", "IS_TRIAL", "React", "useState", "useEffect", "ControlType", `${js}\nreturn { mfEffectiveLicense, mfControls };`)(
      locked,
      false,
      { createElement: () => null },
      () => [null, () => undefined],
      () => undefined,
      { Enum: "enum" }
    ) as {
      mfEffectiveLicense(baked: string, answer: string, onCanvas: boolean): string;
      mfControls(controls: Record<string, Record<string, unknown>>): Record<string, Record<string, unknown>>;
    };

  it("on the canvas keeps the stricter of the file and the server; on the site the server wins", () => {
    const { mfEffectiveLicense } = helpers(false);
    // Signed out of the plugin: the file says locked, the server still says paid.
    expect(mfEffectiveLicense("locked", "active", true)).toBe("locked");
    expect(mfEffectiveLicense("locked", "active", false)).toBe("active");
    // A trial that ended while the plugin was closed: the server knows first.
    expect(mfEffectiveLicense("trial", "locked", true)).toBe("locked");
    expect(mfEffectiveLicense("active", "trial", true)).toBe("trial");
    expect(mfEffectiveLicense("active", "active", true)).toBe("active");
    // A copy or a foreign domain shows its own card everywhere.
    expect(mfEffectiveLicense("locked", "copied", true)).toBe("copied");
    expect(mfEffectiveLicense("active", "domain", false)).toBe("domain");
  });

  it("hides every setting while locked, keeping the seal", () => {
    const controls = {
      mfSeal: { type: "string", hidden: () => true },
      headline: { type: "string", title: "Headline" },
      mode: { type: "enum", hidden: () => false },
    };
    expect(helpers(false).mfControls(controls)).toBe(controls);
    const locked = helpers(true).mfControls(controls);
    expect(locked.mfSeal).toBe(controls.mfSeal);
    // BEAF's Status row, first, in place of the settings.
    expect(Object.keys(locked)[0]).toBe("mfLockedStatus");
    expect(locked.mfLockedStatus).toMatchObject({ type: "enum", title: "Status", optionTitles: ["Sign in or upgrade to customize"] });
    expect(locked.mfLockedStatus!.hidden).toBeUndefined();
    expect((locked.headline!.hidden as () => boolean)()).toBe(true);
    expect((locked.mode!.hidden as () => boolean)()).toBe(true);
    expect(locked.headline!.title).toBe("Headline");
  });

  it("wraps every licensed component's controls, so a locked file hides them", () => {
    for (const name of LICENSED) expect(read(name), name).toContain(`addPropertyControls(${name}, mfControls({`);
  });

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

  it("keeps a trial's end from the server, for the countdown that locks at that second", async () => {
    const host: { __mfTrialEnds?: Record<string, number> } = {};
    vi.stubGlobal("window", host);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ state: "trial", trialEndsAt: "2026-11-01T10:00:00.000Z" }) }))
    );
    const { mfFetchLicense } = load({ locked: false, trial: true });
    expect(await mfFetchLicense("https://api.example.com/", "mf_site_t")).toBe("trial");
    expect(host.__mfTrialEnds?.["https://api.example.com|mf_site_t"]).toBe(Date.parse("2026-11-01T10:00:00.000Z"));
    vi.unstubAllGlobals();
  });

  it("counts down in every component, so a running trial locks without a reload", () => {
    for (const name of LICENSED) expect(block(read(name)), name).toContain('window.setTimeout(() => setLicense("locked")');
  });
});
