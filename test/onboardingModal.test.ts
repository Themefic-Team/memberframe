/**
 * `<OnboardingModal>` and the dashboard's profile form, as source and as
 * generated output. Feature plan FP-09, PRD feature F16, task 6.3.
 *
 * `jsdom` is not installed (blocker B5), so nothing here renders. What can be
 * proved without rendering is proved: the file stands alone, it touches no
 * storage but its own draft, it carries the F19 lock lines, and the generator
 * emits a file that parses with the creator's values in it and nothing unsafe.
 * The behaviour behind the steps is the plugin's `planSteps`,
 * `needsOnboarding`, and `validateProfile`, tested in `customFields.test.ts`
 * and held identical to this file by `customFieldsParity.test.ts`.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import {
  CONFIG_END_MARKER,
  CONFIG_START_MARKER,
  LOCK_STATE_SIGNATURE,
  ONBOARDING_MODAL_FILE_NAME,
  generateMemberDashboardCode,
  generateOnboardingModalCode,
  normalizeOnboardingConfig,
  type DeployContext,
} from "../src/services";
import {
  DEFAULT_MEMBER_DASHBOARD_CONFIG,
  DEFAULT_ONBOARDING_MODAL_CONFIG,
  type OnboardingModalConfig,
} from "../src/types/canvas";
import { CANVAS_COMPONENTS } from "../src/components/studio/componentRegistry";

const source = readFileSync(
  path.join(process.cwd(), "src", "canvas-components", "OnboardingModal.tsx"),
  "utf-8"
);
const code = source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");

const CONTEXT: DeployContext = {
  apiBaseUrl: "https://api.memberframe.framefic.com",
  siteKey: "site_live_abc123",
  afterLoginPath: "/members",
  loginPath: "/login",
  afterLogoutPath: "/",
};

const config = (over: Partial<OnboardingModalConfig> = {}): OnboardingModalConfig => ({
  ...DEFAULT_ONBOARDING_MODAL_CONFIG,
  ...over,
});

/** Syntax errors only: the file's real typecheck happens in Framer, against Framer's types. */
function syntaxErrors(file: string): string[] {
  const result = ts.transpileModule(file, {
    reportDiagnostics: true,
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 },
    fileName: "Component.tsx",
  });

  return (result.diagnostics ?? []).map((diagnostic) =>
    ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")
  );
}

describe("the component is standalone", () => {
  it("imports only what the Framer runtime supplies", () => {
    const specifiers = Array.from(
      source.matchAll(/^import\s[^;]*?from\s+"([^"]+)";/gm),
      (match) => match[1]
    );
    expect(specifiers.sort()).toEqual(["framer", "lucide-react", "react"]);
  });

  it("parses as written", () => {
    expect(syntaxErrors(source)).toEqual([]);
  });

  it("would notice if it did not, so the parse checks are not vacuous", () => {
    expect(syntaxErrors('const broken = "unterminated;\nexport default 1')).not.toEqual([]);
  });

  it("carries the F19 lock-state lines and the trial watermark", () => {
    for (const line of LOCK_STATE_SIGNATURE) expect(source).toContain(line);
    expect(code).toContain("IS_TRIAL && !IS_LOCKED");
  });
});


/**
 * Every Web Storage access in a source, by key. The only storage these
 * components may touch is the Route Shield's: a "1" signed-in hint, its session
 * cache (only ever removed here), the denied-path marker, and a confirmed
 * address handed from sign up to sign in. Never a token, never a password.
 */
function storageAccess(source: string): { calls: string[]; stray: boolean } {
  const calls = source.match(/(?:localStorage|sessionStorage)\.(?:getItem|setItem|removeItem)\([^,)]*(?:,[^)]*)?\)/g) ?? [];
  const stray = /(?:localStorage|sessionStorage)\s*(?:\[|\.(?!getItem|setItem|removeItem))/.test(source);
  return { calls, stray };
}

describe("storage", () => {
  it("never reads or writes a credential", () => {
    // PRD section 14.1 S2. The session is an HTTP-only cookie the browser
    // attaches; this file asks it to and never sees it.
    expect(code).not.toContain("localStorage");
    expect(code).not.toContain("document.cookie");
    expect(code).not.toContain("indexedDB");
    expect(code).toContain('credentials: "include"');
  });

  it("touches sessionStorage only inside the three draft helpers", () => {
    // PRD F16's reload criterion is the one reason this component has a
    // storage call at all. Any use outside the helpers is a new one, and
    // should have to explain itself by failing here.
    expect(code.match(/sessionStorage/g)).toHaveLength(3);

    for (const helper of ["loadDraft", "saveDraft", "clearDraft"]) {
      const start = code.indexOf(`function ${helper}(`);
      const end = code.indexOf("\n}\n", start);
      expect(code.slice(start, end)).toContain("sessionStorage");
    }
  });

  it("scopes the draft to the site and the member, and clears it on success", () => {
    expect(code).toContain("`${DRAFT_PREFIX}${CONFIG.siteKey || \"site\"}:${memberId}`");
    expect(code).toContain("clearDraft(state.memberId)");
  });

  it("drops a draft value whose field has since been deleted", () => {
    expect(code).toContain("if (known.has(key)) values[key] = value;");
  });
});

describe("accessibility contract", () => {
  it("announces the step as Step N of M", () => {
    // PRD F16 acceptance criterion 5.
    expect(code).toContain('aria-live="polite"');
    // The wording is a creator label now; the numbers are not.
    expect(code).toContain('stepCounter: ["Step counter", "Step {current} of {total}"]');
    expect(code).toContain('t("stepCounter", { current: stepIndex + 1, total: steps.length })');
  });

  it("is a labelled modal dialog with a focus trap when overlaid", () => {
    expect(code).toContain('role={overlay ? "dialog" : undefined}');
    expect(code).toContain("aria-modal={overlay ? true : undefined}");
    expect(code).toContain("aria-labelledby={headingId}");
    expect(code).toContain('event.key !== "Tab"');
  });

  it("offers a skip only on the optional step", () => {
    expect(code).toContain('step === "optional" && config.allowSkip');
  });
});

describe("generateOnboardingModalCode", () => {
  const generated = generateOnboardingModalCode(config(), undefined, CONTEXT);

  it("writes the component under its own file name", () => {
    expect(generated.fileName).toBe(ONBOARDING_MODAL_FILE_NAME);
  });

  it("bakes in the connection's base URL and site key", () => {
    expect(generated.code).toContain(`apiBaseUrl: "${CONTEXT.apiBaseUrl}",`);
    expect(generated.code).toContain(`siteKey: "${CONTEXT.siteKey}",`);
  });

  it("keeps exactly one marker pair and parses", () => {
    expect(generated.code.split(CONFIG_START_MARKER)).toHaveLength(2);
    expect(generated.code.split(CONFIG_END_MARKER)).toHaveLength(2);
    expect(syntaxErrors(generated.code)).toEqual([]);
  });

  it("emits exactly the fields the component's config interface declares", () => {
    const declared = /interface OnboardingConfig \{([\s\S]*?)\n\}/.exec(source)?.[1] ?? "";
    const declaredKeys = Array.from(declared.matchAll(/^\s{2}(\w+):/gm), (match) => match[1]).sort();

    const block = generated.code.slice(
      generated.code.indexOf(CONFIG_START_MARKER),
      generated.code.indexOf(CONFIG_END_MARKER)
    );
    const emittedKeys = Array.from(block.matchAll(/^\s{2}(\w+):/gm), (match) => match[1]).sort();

    expect(declaredKeys.length).toBeGreaterThan(5);
    expect(emittedKeys).toEqual(declaredKeys);
  });

  it("survives creator text built to break out of the string", () => {
    const hostile = generateOnboardingModalCode(
      config({ welcomeTitle: '"; alert(1); const x = "', welcomeMessage: "line break\\" }),
      undefined,
      CONTEXT
    );
    expect(syntaxErrors(hostile.code)).toEqual([]);
    expect(hostile.code).not.toContain('welcomeTitle: ""; alert(1)');
  });
});

describe("normalizeOnboardingConfig", () => {
  it("drops a completion redirect that could leave the site", () => {
    for (const unsafe of ["//evil.example", "https://evil.example", "javascript:alert(1)", "welcome"]) {
      expect(normalizeOnboardingConfig(config({ completionRedirect: unsafe })).completionRedirect).toBe("");
    }
    expect(normalizeOnboardingConfig(config({ completionRedirect: "/welcome" })).completionRedirect).toBe(
      "/welcome"
    );
  });

  it("refuses an accent that is not a colour and clamps the radius", () => {
    const normalized = normalizeOnboardingConfig(
      config({ accentColor: "red; } body { display: none", borderRadius: 99 })
    );
    expect(normalized.accentColor).toBe(DEFAULT_ONBOARDING_MODAL_CONFIG.accentColor);
    expect(normalized.borderRadius).toBe(32);
  });
});

describe("the picker", () => {
  it("lists the onboarding modal as deployable", () => {
    const entry = CANVAS_COMPONENTS.find((component) => component.id === "onboarding_modal");
    expect(entry?.deployable).toBe(true);
  });
});

describe("the dashboard's profile form", () => {
  const dashboard = readFileSync(
    path.join(process.cwd(), "src", "canvas-components", "MemberDashboard.tsx"),
    "utf-8"
  );
  const dashboardCode = dashboard.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");

  it("is emitted with its switch and still parses", () => {
    const generated = generateMemberDashboardCode(DEFAULT_MEMBER_DASHBOARD_CONFIG, undefined, CONTEXT);
    expect(generated.code).toContain("  showProfile: true,");
    expect(syntaxErrors(generated.code)).toEqual([]);
  });

  it("can be switched off", () => {
    const generated = generateMemberDashboardCode(
      { ...DEFAULT_MEMBER_DASHBOARD_CONFIG, showProfile: false },
      undefined,
      CONTEXT
    );
    expect(generated.code).toContain("  showProfile: false,");
  });

  it("reads and writes the profile with the cookie and no storage", () => {
    expect(dashboardCode).toContain('const PROFILE_PATH = "/api/member/profile";');
    expect(dashboardCode).toContain('method: "PATCH"');
    // Only the Route Shield's hint and cache, never the profile or a token.
    const { calls, stray } = storageAccess(dashboardCode);
    expect(stray).toBe(false);
    for (const call of calls) expect(call).toMatch(/\(`(memberframe:signed-in:|__mf_session_)\$\{CONFIG\.siteKey\}`/);
  });

  it("renders only the fields whose condition is met", () => {
    expect(dashboardCode).toContain(".filter((field) => isFieldVisible(field, profileValues))");
  });
});
