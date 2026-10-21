/**
 * The four dedicated auth screens: `<MemberLogin>`, `<MemberRegister>`,
 * `<MemberPasswordReset>`, and `<MemberOtpVerify>`.
 *
 * All four are `MemberAuth.tsx` deployed with a screen baked in and the export
 * renamed, so what needs proving is the generation, not the flows: those are
 * `<MemberAuth>`'s and `memberAuth.test.ts` covers them. Rendering is still out
 * of reach, blocker B5.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import {
  AUTH_SCREEN_DEFAULTS,
  AUTH_SCREEN_DESCRIPTORS,
  CONFIG_END_MARKER,
  CONFIG_START_MARKER,
  CodeGenerationError,
  generateAuthScreenCode,
  generateMemberAuthCode,
  type AuthScreenComponentId,
  type DeployContext,
} from "../src/services";
import { DEFAULT_MEMBER_AUTH_CONFIG } from "../src/types/canvas";
import { CANVAS_COMPONENTS } from "../src/components/studio/componentRegistry";

const source = readFileSync(
  path.join(process.cwd(), "src", "canvas-components", "MemberAuth.tsx"),
  "utf-8"
);

const CONTEXT: DeployContext = {
  apiBaseUrl: "https://api.memberframe.framefic.com",
  siteKey: "site_live_abc123",
  afterLoginPath: "/dashboard",
  loginPath: "/login",
  afterLogoutPath: "/",
  signupPath: "/register",
  resetPath: "/reset-password",
};

const SCREENS: ReadonlyArray<[AuthScreenComponentId, string, string, string]> = [
  ["member_login", "MemberLogin", "MemberLogin.tsx", "login"],
  ["member_register", "MemberRegister", "MemberRegister.tsx", "register"],
  ["member_password_reset", "MemberPasswordReset", "MemberPasswordReset.tsx", "reset"],
  ["member_otp_verify", "MemberOtpVerify", "MemberOtpVerify.tsx", "otp"],
];

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

function configKeys(code: string): string[] {
  const block = code.slice(code.indexOf(CONFIG_START_MARKER), code.indexOf(CONFIG_END_MARKER));
  return Array.from(block.matchAll(/^\s{2}(\w+):/gm), (match) => match[1] ?? "").sort();
}

const declaredKeys = (() => {
  const body = /interface AuthConfig \{([\s\S]*?)\n\}/.exec(source)?.[1] ?? "";
  return Array.from(body.matchAll(/^\s{2}(\w+):/gm), (match) => match[1] ?? "").sort();
})();

describe("each dedicated screen", () => {
  for (const [id, name, fileName, screen] of SCREENS) {
    describe(name, () => {
      const generated = generateAuthScreenCode(id, AUTH_SCREEN_DEFAULTS[id], undefined, CONTEXT);

      it("deploys to its own file, so it never overwrites Member Auth", () => {
        expect(generated.fileName).toBe(fileName);
      });

      it("exports under its own name, with its controls attached to it", () => {
        expect(generated.code).toContain(`export default function ${name}(`);
        expect(generated.code).toContain(`addPropertyControls(${name},`);
        expect(generated.code).not.toContain("export default function MemberAuth(");
        expect(generated.code).not.toContain("addPropertyControls(MemberAuth,");
      });

      it("bakes in its screen", () => {
        expect(generated.code).toContain(`  screen: "${screen}",`);
      });

      it("emits every field the component's config interface declares, and no other", () => {
        expect(configKeys(generated.code)).toEqual(declaredKeys);
      });

      it("parses", () => {
        expect(syntaxErrors(generated.code)).toEqual([]);
      });

      it("carries the connection", () => {
        expect(generated.code).toContain(`siteKey: "${CONTEXT.siteKey}",`);
        expect(generated.code).toContain(`loginPath: "${CONTEXT.loginPath}",`);
      });
    });
  }
});

describe("Member Auth itself", () => {
  const generated = generateMemberAuthCode(DEFAULT_MEMBER_AUTH_CONFIG, undefined, CONTEXT);

  it("is unchanged in name and file, and offers every flow", () => {
    expect(generated.fileName).toBe("MemberAuth.tsx");
    expect(generated.code).toContain("export default function MemberAuth(");
    expect(generated.code).toContain('  screen: "all",');
  });

  it("emits the same complete config block", () => {
    // Guards every key comparison in this file: two empty lists are equal.
    expect(declaredKeys.length).toBe(26);
    expect(configKeys(generated.code)).toEqual(declaredKeys);
    expect(syntaxErrors(generated.code)).toEqual([]);
  });
});

describe("links between the screens", () => {
  it("emits the sign up link target when sign up has its own page", () => {
    const generated = generateAuthScreenCode("member_login", undefined, undefined, CONTEXT);
    expect(generated.code).toContain('  signupPath: "/register",');
  });

  it("leaves it empty when sign up shares the login page, so login never links to itself", () => {
    const generated = generateAuthScreenCode("member_login", undefined, undefined, {
      ...CONTEXT,
      signupPath: "/login",
    });
    expect(generated.code).toContain('  signupPath: "",');
  });

  it("refuses an unusable link target in the component before navigating", () => {
    const helper = /function linkablePath\([\s\S]*?\n\}/.exec(source)?.[0] ?? "";
    expect(helper).toContain('path.startsWith("//")');
    expect(helper).toContain('path.includes("\\\\")');
    expect(helper).toContain("window.location.pathname !== path");
  });
});

describe("what a dedicated screen fixes in place", () => {
  it("starts each screen on its own view", () => {
    // Member Login starts on its Default Method, password unless the creator chose the code.
    expect(source).toContain('if (screen === "login") return !enablePasswordAuth || defaultAuthMethod === "otp" ? "otp" : "password_signin";');
    expect(source).toContain('if (screen === "register") return "password_signup";');
    expect(source).toContain('if (screen === "otp") return "otp";');
    expect(source).toContain('if (screen === "reset") return readResetToken() !== null ? "reset" : "forgot";');
  });

  it("lets Member Login sign in with a code in the same card", () => {
    // Password Auth and Default Method apply to Member Login as to Member Auth.
    expect(source).toContain('const passwordless = screen === "all" || screen === "login";');
    expect(source).toContain('const enablePasswordAuth = passwordless ? passwordControl : screen !== "otp";');
    // With no Code Sign In Page set, the code link switches the form in place.
    expect(source).toContain('flowLink(t("codeLink"), "otp", otpPath, undefined, screen === "login")');
    expect(source).toContain('flowLink(t("passwordLink"), "password_signin", "", undefined, true)');
  });

  it("shows no provider buttons on the reset and code screens", () => {
    expect(source).toContain(
      'const providersAllowed = screen === "all" || screen === "login" || screen === "register";'
    );
  });

  it("keeps the sign in and sign up tabs to Member Auth", () => {
    expect(source).toContain('!dedicated && (view === "password_signin" || view === "password_signup")');
  });
});

describe("the rename refuses a source it cannot apply to", () => {
  it("throws rather than deploying a component with detached controls", () => {
    const broken = source.replace("addPropertyControls(MemberAuth,", "addPropertyControls(Other,");

    expect(() =>
      generateAuthScreenCode("member_login", undefined, broken, CONTEXT)
    ).toThrow(CodeGenerationError);
  });
});

describe("the picker", () => {
  it("lists all four as deployable, alongside Member Auth", () => {
    for (const id of [...Object.keys(AUTH_SCREEN_DESCRIPTORS), "member_auth"]) {
      expect(CANVAS_COMPONENTS.find((entry) => entry.id === id)?.deployable).toBe(true);
    }
  });
});
