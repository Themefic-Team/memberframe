/**
 * `<MemberAuth>`, the component and its generator. PRD task 2.5, feature F05.
 *
 * Same shape as `test/entitlementParity.test.ts`: the component is deployed into
 * a creator's Framer project and cannot be imported here, because it needs the
 * `framer` module that the Framer runtime supplies and that is deliberately not
 * installed. So its invariants are asserted against its source text.
 *
 * That is a real guard and not a substitute for rendering it. `jsdom` is still
 * absent (blocker B5), so nothing here drives a Tab key, opens a popup, or
 * watches a countdown tick.
 *
 * The `postMessage` block is the one that matters. An OAuth callback listener
 * that does not pin its origin lets any window with a handle on this one tell
 * the component a sign-in succeeded.
 */

import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  CONFIG_END_MARKER,
  CONFIG_START_MARKER,
  MEMBER_AUTH_DESCRIPTOR,
  MEMBER_AUTH_FILE_NAME,
  generateMemberAuthCode,
  isSafeCssColor,
  normalizeAuthConfig,
} from "../src/services/canvasComponentCodeGenerator";
import {
  AUTH_RADIUS_MAX,
  AUTH_RADIUS_MIN,
  DEFAULT_MEMBER_AUTH_CONFIG,
  type MemberAuthConfig,
} from "../src/types/canvas";

const COMPONENT_PATH = path.join(process.cwd(), "src", "canvas-components", "MemberAuth.tsx");
const source = readFileSync(COMPONENT_PATH, "utf-8");

/** The source with comments removed, for assertions about absence. */
const code = source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");

/**
 * The component without its F19 license block. That block reads the license
 * with one GET and is held on its own by canvasLicenseParity.test.ts; every
 * auth request is outside it.
 */
const authCode = source
  .replace(/\/\/ @memberframe-license-start[\s\S]*?\/\/ @memberframe-license-end/, "")
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/\/\/[^\n]*/g, " ");

const config = (overrides: Partial<MemberAuthConfig> = {}): MemberAuthConfig => ({
  ...DEFAULT_MEMBER_AUTH_CONFIG,
  ...overrides,
});

describe("the component is standalone", () => {
  const specifiers = Array.from(
    source.matchAll(/^import\s[^;]*?from\s+"([^"]+)";/gm),
    (match) => match[1]
  );

  it("imports only what the Framer runtime supplies", () => {
    // A relative import resolves here and typechecks here, then fails on the
    // creator's published site where this file sits alone in their project.
    // `react-dom` is Framer's own, for the modal's portal, as Protected Download uses it.
    expect(specifiers.sort()).toEqual(["framer", "lucide-react", "react", "react-dom"]);
  });

  it("found some imports, so the match is not vacuously empty", () => {
    expect(specifiers.length).toBe(4);
  });
});

describe("the postMessage handler is pinned to one origin", () => {
  it("compares the origin for equality", () => {
    // PRD section 14.1 S8 and section 16.4. Equality, not a substring test.
    expect(code).toContain("event.origin !== expectedOrigin");
  });

  it("never loosens the origin test to a substring match", () => {
    // The plausible regression: someone relaxes this to make a staging domain
    // work. `includes` matches api.memberframe.framefic.com.attacker.example.
    expect(code).not.toMatch(/origin\s*\.\s*includes/);
    expect(code).not.toMatch(/origin\s*\.\s*endsWith/);
    expect(code).not.toMatch(/origin\s*\.\s*startsWith/);
    expect(code).not.toMatch(/origin\s*===\s*"\*"/);
  });

  it("never posts to a wildcard target origin", () => {
    expect(code).not.toContain('"*"');
    // The only postMessage calls are on the BroadcastChannel, which cannot
    // leave this origin. Nothing posts to a window, where a target origin
    // would matter.
    const posts = code.match(/[\w.]+\.postMessage\(/g) ?? [];
    expect(posts.length).toBeGreaterThan(0);
    for (const call of posts) expect(call).toBe("channel.postMessage(");
  });

  it("also checks the message came from the window it opened", () => {
    expect(code).toContain("event.source !== popupRef.current");
  });

  it("also checks the message type before reading the payload", () => {
    expect(code).toContain("payload.type !== OAUTH_MESSAGE_TYPE");
  });

  it("derives the expected origin from the injected API base URL", () => {
    // Not a literal. The generator injects the base URL, so a staging build
    // pins staging rather than carrying a hardcoded production host.
    expect(code).toContain("apiOrigin(CONFIG.apiBaseUrl)");
  });

  it("bails out when the origin cannot be determined", () => {
    // A malformed base URL must fail closed, not match everything.
    expect(code).toContain("expectedOrigin === null");
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

describe("the component holds no credential", () => {
  it("reads no token from browser storage", () => {
    // PRD section 14.1 S2: the session is an HTTP-only cookie, so the browser
    // holds it and this component never sees it. Storage holds only the Route
    // Shield's keys, and the one localStorage value is the literal "1".
    const { calls, stray } = storageAccess(code);
    expect(stray).toBe(false);
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) {
      expect(call).toMatch(/\((HINT_KEY|SESSION_CACHE_KEY|DENIED_KEY|VERIFIED_KEY|CHECKOUT_INTENT_KEY|RETURN_KEY|MODAL_SHOWN_KEY)[,)]/);
      if (call.startsWith("localStorage.setItem")) expect(call).toBe('localStorage.setItem(HINT_KEY, "1")');
      if (call.includes("SESSION_CACHE_KEY")) expect(call).toContain("removeItem");
    }
    expect(code).not.toContain("document.cookie");
  });

  it("lets the browser attach the credential instead", () => {
    expect(code).toContain('credentials: "include"');
  });

  it("never reads a session token out of a response body", () => {
    // PRD section 10.2's verify-otp returns { token, user }, which is the
    // creator flow. A member session must not arrive that way. Conflict C11.
    //
    // This was a blanket ban on the word `token` until FP-02, which introduced
    // a reset token that legitimately arrives in a URL. The assertion is now
    // the thing it always meant: nothing is read off a parsed response body.
    expect(code).not.toMatch(/payload\.token/);
    expect(code).not.toMatch(/body\.token/);
    expect(code).not.toMatch(/\.token\s*\?\?/);
    expect(code).not.toMatch(/json\(\)[^;]*\.token/);
  });

  it("the only token it handles came from the URL, not from a server reply", () => {
    // FP-02 section 2.3. The reset token is read once, from `location.search`,
    // and sent straight back. It is never persisted and never logged.
    expect(code).toContain("readResetToken");
    expect(code).toContain("window.location.search");
    expect(code).not.toContain("console.");
  });

  it("strips the reset token from the URL once it is spent", () => {
    // A URL reaches browser history and the `Referer` of anything the page
    // loads next. `05-member-auth.md` section 9.6.
    expect(code).toContain("replaceState");
  });
});

describe("the email code flow", () => {
  it("asks for a six digit code", () => {
    expect(code).toContain("const CODE_LENGTH = 6");
  });

  it("locks resend for sixty seconds", () => {
    expect(code).toContain("const RESEND_LOCK_SECONDS = 60");
  });

  it("derives the countdown from a deadline rather than decrementing", () => {
    // A backgrounded tab stops firing timers, and a decrementing counter
    // resumes with a stale number, so the button unlocks late or early.
    expect(code).toContain("function secondsRemaining(resendAtMs: number, nowMs: number)");
    expect(code).toContain("resendAtMs - nowMs");
  });

  it("gives a wrong code, an expired code, and a dead code different copy", () => {
    // F05: "An expired code past 10 minutes is rejected with a distinct message
    // from a wrong code." A bare 401 cannot carry that, so the server returns a
    // reason and the component maps it.
    for (const reason of ["invalid_code", "expired_code", "too_many_attempts"]) {
      expect(code).toContain(reason);
    }
  });

  it("handles a 429 on send without retrying", () => {
    expect(code).toContain("response.status === 429");
    expect(code).not.toMatch(/setTimeout\([^)]*sendCode/);
  });

  it("makes exactly three fetch calls for six endpoints", () => {
    // Two for the code flow, send and verify, and one shared by all four FP-02
    // password endpoints. A fourth appearing means a flow grew its own request
    // and its own error handling, which is where the one that forgets to clear
    // the password comes from. The license block's GET is not an auth
    // request, and canvasLicenseParity.test.ts holds it on its own (F19). Nor
    // is the password rules GET (05-member-auth.md 13): it carries nothing.
    expect(authCode.match(/fetch\(/g)).toHaveLength(4);
    expect(authCode).toContain("void fetch(`${CONFIG.apiBaseUrl}${AUTH_CONFIG_PATH}`, { credentials: \"omit\", headers: apiHeaders(false) })");
  });
});

describe("the OAuth popup", () => {
  it("handles a blocked popup with an inline error rather than silence", () => {
    // F05: "OAuth popup blocked by the browser produces an actionable inline
    // error, not a silent failure."
    expect(code).toContain("if (!tab)");
    expect(code).toMatch(/blocked the sign in tab/i);
  });

  it("tells the visitor what to do about it", () => {
    expect(source).toMatch(/Allow popups/i);
  });

  it("opens a tab, not a window", () => {
    // Size features ("width=480,...") are what make a browser open a separate
    // window. None means a tab, which is what the user asked for.
    expect(code).toContain('window.open(url, "memberframe-oauth")');
    expect(code).not.toMatch(/window\.open\([^)]*width=/);
  });

  it("finishes the sign in on the site's own page, not on the API's", () => {
    // A cookie set while the tab is on the API's address lands in another
    // partition, so the API sends the tab back here with a one-time code and
    // this page exchanges it. The return address is this page, never a
    // constant, and the API checks it against the site's allowlist.
    expect(code).toContain('query.set("returnTo"');
    expect(code).toContain('const OAUTH_EXCHANGE_PATH = "/api/member/oauth/exchange"');
    expect(code).toMatch(/submitCredentials\(\s*OAUTH_EXCHANGE_PATH,/);
    // The code leaves the address bar before anything else happens.
    expect(code).toContain("window.history.replaceState(");
  });

  it("hands the result to the tab that started it, then goes to After sign in", () => {
    expect(code).toContain('const OAUTH_CHANNEL = "memberframe-oauth"');
    expect(code).toContain("announceOAuthResult(true, \"\", redirectAfterAuth)");
    // Only the tab that started a sign in answers and navigates.
    expect(code).toContain('data.type !== "result" || !oauthPendingRef.current');
  });

  it("never reports failure just because the tab looks closed", () => {
    // Google's pages cut the opener link, which some browsers report as
    // closed while the visitor is still signing in. Focus, not closed, stops
    // the spinner, and it does so without an error.
    expect(code).not.toContain("tab.closed");
    expect(code).toContain('window.addEventListener("focus", onFocus)');
  });
});

describe("the modal is keyboard operable", () => {
  it("closes on Escape", () => {
    expect(code).toContain('event.key === "Escape"');
  });

  it("cycles Tab within the dialog rather than letting focus leave", () => {
    expect(code).toContain('event.key !== "Tab"');
    expect(code).toContain("event.shiftKey");
    expect(code).toContain("last.focus()");
    expect(code).toContain("first.focus()");
  });

  it("marks the modal as a dialog for assistive technology", () => {
    expect(code).toContain('role={authMode === "modal" ? "dialog" : undefined}');
    expect(code).toContain("aria-modal");
  });
});

describe("the component is safe by construction", () => {
  it("sanitizes the creator colour before it reaches a style block", () => {
    // accentColor is creator data that ends in a CSS declaration, and a Framer
    // variable can set a prop the generator never saw. `red; } body { ... }`
    // would be CSS injection on the creator's own published page.
    //
    // The sanitizer lives in the shared appearance block now, and its
    // behaviour, injection attempts included, is executed in
    // test/canvasAppearanceParity.test.ts. Here: this component routes the
    // creator's accent through it and nowhere else.
    expect(code).toContain("function mfSafeColor(");
    expect(code).toContain("mfAppearanceVars({");
    expect(code).toContain("accent: accentColor,");
    expect(code).not.toContain("--memberframe-auth-accent: ${");
  });

  it("clamps the creator radius", () => {
    expect(code).toContain("radius: borderRadius,");
    // Same bound as the Corner Radius control, asserted further down.
    expect(code).toContain("radiusMax: 24,");
  });

  it("scopes its custom properties per instance, the same on server and browser", () => {
    // Two sign-in boxes on one page with different accents must not overwrite
    // each other, which a shared class would allow. The scope comes from the
    // rule itself, not useId, so a published page's first paint is styled.
    expect(code).toContain("data-memberframe-auth={styled.scope}");
    expect(code).toContain('const styled = mfStyleScope("mfa", scopedVars);');
    expect(code).toContain("<style>{styled.css}</style>");
  });

  it("carries no inline style and no unicode emoji", () => {
    // Against the comment-stripped source, matching `npm run lint:css`, which
    // skips comment lines. The file's own header quotes `style={{ }}` while
    // explaining why it does not use one.
    expect(code).not.toMatch(/\bstyle\s*=\s*\{\{/);
    expect(source).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u);
  });

  it("keeps the F19 lock-state block patchable", () => {
    expect(source).toContain("const IS_LOCKED = false;");
    expect(source).toContain("const IS_TRIAL = false;");
    expect(source).toContain("// @plugin-lock-state: unlocked");
    expect(source).toContain("// @plugin-trial-state: paid");
  });

  it("gives every Lucide icon stroke=currentColor", () => {
    const icons = code.match(/<(ArrowRight|Loader2|Mail|ShieldCheck)\s[^>]*>/g) ?? [];

    expect(icons.length).toBeGreaterThan(0);
    for (const icon of icons) {
      expect(icon).toContain('stroke="currentColor"');
    }
  });

  it("draws the brand marks as SVG, never a raster: Google's full-colour G, the others in the button's colour", () => {
    // A documented deviation: the icon rule says stroke=currentColor, Lucide
    // carries no brand marks, and a brand glyph is a filled shape rather than a
    // line. Google's G is public/google-icon.svg, its gradient G, in full colour.
    const marks = code.match(/fill="currentColor"/g) ?? [];

    expect(marks.length).toBe(3);
    expect(code).toContain('fill="#3086FF"');
    for (const paint of ["paint0_radial", "paint3_radial", "paint7_linear"]) {
      expect(code).toContain(`fill="url(#memberframe-google-${paint})"`);
    }
    expect(code).not.toContain("<img");
    expect(code).not.toMatch(/url\(data:image/);
  });

  it("gives each provider button its brand's colours, light and dark", () => {
    expect(code).toContain("className={`memberframe-auth-provider is-${provider}`}");
    // light-dark() follows the theme's color-scheme, so Dark and Auto need no media query.
    expect(code).toContain(".memberframe-auth-provider.is-google { background: light-dark(#ffffff, #131314); border-color: light-dark(#747775, #8e918f);");
    expect(code).toContain(".memberframe-auth-provider.is-apple { background: light-dark(#000000, #ffffff);");
    expect(code).toContain(".memberframe-auth-provider.is-github { background: #24292f;");
    expect(code).toContain(".memberframe-auth-provider.is-discord { background: #5865f2; border-color: #5865f2; color: #ffffff; }");
  });

  it("respects a reduced motion preference on its spinner", () => {
    expect(source).toContain("prefers-reduced-motion");
  });

  it("says so rather than rendering a dead form when no method is enabled", () => {
    expect(code).toContain("!emailEnabled && providers.length === 0");
  });
});

describe("the property controls", () => {
  /** Ten from task 2.5, three from FP-02. */
  const EVERY_CONTROL = [
    "authMode",
    "modalTrigger",
    "modalTriggerId",
    "modalDelay",
    "modalScrollPercent",
    "modalOncePerSession",
    "modalCanvasPreview",
    "headline",
    "welcomeMessage",
    "emailEnabled",
    "googleEnabled",
    "appleEnabled",
    "githubEnabled",
    "discordEnabled",
    "accentColor",
    "borderRadius",
    "enablePasswordAuth",
    "defaultAuthMethod",
    // The dedicated screens' link targets. Hidden on `<MemberAuth>` itself.
    "loginPath",
    "signupPath",
    "resetPath",
    "otpPath",
  ];

  it("declares all seventeen", () => {
    for (const control of EVERY_CONTROL) {
      expect(source).toContain(`  ${control}: {`);
    }
  });

  it("reads every default from CONFIG, so the panel and the sidebar agree", () => {
    const controlBlock = source.slice(source.indexOf("addPropertyControls(MemberAuth"));
    const defaults = controlBlock.match(/defaultValue: [^,\n]+/g) ?? [];

    expect(defaults.length).toBe(EVERY_CONTROL.length);
    for (const line of defaults) {
      expect(line).toContain("CONFIG.");
    }
  });

  it("hides the two password sub-controls when password auth is off", () => {
    // FP-02 section 3.2. A "Strong Password" toggle with no password form to
    // govern is a control that appears to do nothing.
    // On `<MemberAuth>` itself (screen "all"). The dedicated screens have their
    // own rule: no method choice at all, and a strength toggle only where a
    // new password is chosen.
    const controlBlock = source.slice(source.indexOf("addPropertyControls(MemberAuth"));

    expect(controlBlock).toContain(
      'hidden: (props) => (CONFIG.screen !== "all" && CONFIG.screen !== "login") || !props.enablePasswordAuth'
    );
    // Strong Password is gone: the rules are the site's (05-member-auth.md 13).
    expect(controlBlock).not.toContain("requirePasswordStrength");
  });

  it("gives the method enum readable option titles", () => {
    // PRD section 7.6 rule 4: never surface a raw enum value. `otp` in a
    // Framer sidebar means nothing to a designer.
    const controlBlock = source.slice(source.indexOf("addPropertyControls(MemberAuth"));

    expect(controlBlock).toContain('optionTitles: ["Email & Password", "Passwordless Code"]');
    expect(controlBlock).toContain('options: ["password", "otp"]');
  });

  it("bounds the radius control to the range the component clamps to", () => {
    const controlBlock = source.slice(source.indexOf("addPropertyControls(MemberAuth"));

    expect(controlBlock).toContain("min: 0");
    expect(controlBlock).toContain("max: 24");
  });
});

describe("isSafeCssColor", () => {
  it("accepts the notations a Color control produces", () => {
    for (const colour of [
      "#fff",
      "#5271ff",
      "#5271ffcc",
      "rgb(82, 113, 255)",
      "rgba(82, 113, 255, 0.5)",
      "hsl(230, 100%, 66%)",
      "hsla(230, 100%, 66%, 0.4)",
    ]) {
      expect(isSafeCssColor(colour), colour).toBe(true);
    }
  });

  it("refuses anything that could close a declaration", () => {
    for (const attack of [
      "red; } body { display: none } .x {",
      "#fff; background: url(https://evil.example.com)",
      "var(--anything)",
      "#fff /* comment */",
      "expression(alert(1))",
      "url(javascript:alert(1))",
    ]) {
      expect(isSafeCssColor(attack), attack).toBe(false);
    }
  });

  it("refuses a bare colour name, because the whitelist is notational", () => {
    // Narrower than CSS allows, and deliberately: a Color control emits one of
    // the three notations above, so accepting arbitrary identifiers buys
    // nothing and widens the surface.
    expect(isSafeCssColor("red")).toBe(false);
  });

  it("refuses an empty value and an absurdly long one", () => {
    expect(isSafeCssColor("")).toBe(false);
    expect(isSafeCssColor("   ")).toBe(false);
    expect(isSafeCssColor(`#${"f".repeat(60)}`)).toBe(false);
  });
});

describe("normalizeAuthConfig", () => {
  it("falls back to the brand accent for an unsafe colour", () => {
    expect(normalizeAuthConfig(config({ accentColor: "red; } body {" })).accentColor).toBe(
      DEFAULT_MEMBER_AUTH_CONFIG.accentColor
    );
  });

  it("keeps a safe colour untouched", () => {
    expect(normalizeAuthConfig(config({ accentColor: "#112233" })).accentColor).toBe("#112233");
  });

  it("clamps the radius to the control's own bounds", () => {
    expect(normalizeAuthConfig(config({ borderRadius: -10 })).borderRadius).toBe(AUTH_RADIUS_MIN);
    expect(normalizeAuthConfig(config({ borderRadius: 999 })).borderRadius).toBe(AUTH_RADIUS_MAX);
    expect(normalizeAuthConfig(config({ borderRadius: 9.6 })).borderRadius).toBe(10);
    expect(normalizeAuthConfig(config({ borderRadius: Number.NaN })).borderRadius).toBe(
      DEFAULT_MEMBER_AUTH_CONFIG.borderRadius
    );
  });

  it("falls back to inline for an unknown display mode", () => {
    expect(
      normalizeAuthConfig(config({ authMode: "lightbox" as MemberAuthConfig["authMode"] })).authMode
    ).toBe("inline");
  });

  it("collapses newlines in the two text fields", () => {
    expect(normalizeAuthConfig(config({ headline: "Sign\nin" })).headline).toBe("Sign in");
  });

  it("coerces every provider flag to a boolean", () => {
    const coerced = normalizeAuthConfig(
      config({ googleEnabled: "yes" as unknown as boolean, appleEnabled: 0 as unknown as boolean })
    );

    expect(coerced.googleEnabled).toBe(true);
    expect(coerced.appleEnabled).toBe(false);
  });
});

describe("generateMemberAuthCode", () => {
  it("names the file MemberAuth.tsx", () => {
    expect(generateMemberAuthCode(config()).fileName).toBe(MEMBER_AUTH_FILE_NAME);
    expect(MEMBER_AUTH_FILE_NAME.endsWith(".tsx")).toBe(true);
  });

  it("keeps one marker pair, so a second generation still works", () => {
    const once = generateMemberAuthCode(config({ headline: "First" })).code;
    const twice = generateMemberAuthCode(config({ headline: "Second" }), once).code;

    expect(twice.split(CONFIG_START_MARKER)).toHaveLength(2);
    expect(twice).toContain('headline: "Second"');
    expect(twice).not.toContain("First");
  });

  it("annotates the block with the type the authored file declares", () => {
    expect(generateMemberAuthCode(config()).code).toContain("const CONFIG: AuthConfig = {");
    expect(MEMBER_AUTH_DESCRIPTOR.configTypeName).toBe("AuthConfig");
  });

  it("emits booleans as booleans, not as strings", () => {
    const { code: emitted } = generateMemberAuthCode(config({ googleEnabled: true }));

    expect(emitted).toContain("googleEnabled: true,");
    expect(emitted).not.toContain('googleEnabled: "true"');
  });

  it("round trips a hostile headline through a string literal", () => {
    const hostile = 'Sign in "now" \\ or ${process.exit(1)}';
    const { code: emitted } = generateMemberAuthCode(config({ headline: hostile }));
    const match = /^  headline: (".*"),$/m.exec(emitted);

    expect(match).toBeTruthy();
    expect(JSON.parse(match![1])).toBe(hostile);
  });

  it("never emits an unsafe colour, even if asked to", () => {
    const { code: emitted } = generateMemberAuthCode(
      config({ accentColor: "#fff; } body { display: none } .x {" })
    );

    // Asserted against the emitted config block rather than the whole file:
    // the component's own header quotes that exact string while explaining why
    // it is refused.
    const block = emitted.slice(
      emitted.indexOf(CONFIG_START_MARKER),
      emitted.indexOf(CONFIG_END_MARKER)
    );

    expect(block).not.toContain("display: none");
    expect(block).toContain(`accentColor: "${DEFAULT_MEMBER_AUTH_CONFIG.accentColor}"`);
  });

  it("keeps the lock-state signature, which the generator asserts", () => {
    expect(generateMemberAuthCode(config()).code).toContain("const IS_LOCKED = false;");
  });

  it("carries the backend base URL rather than a literal at the call site", () => {
    expect(generateMemberAuthCode(config()).code).toMatch(/apiBaseUrl: "https?:\/\//);
  });

  it("changes nothing outside the config block", () => {
    const base = generateMemberAuthCode(config()).code;
    const changed = generateMemberAuthCode(config({ borderRadius: 20 })).code;

    const strip = (text: string) =>
      text.slice(0, text.indexOf(CONFIG_START_MARKER)) + text.slice(text.indexOf(CONFIG_END_MARKER));

    expect(strip(changed)).toBe(strip(base));
  });
});

describe("FP-02: the password flow exists and is reachable", () => {
  it("declares all four password endpoints", () => {
    for (const path of [
      "/api/member/register",
      "/api/member/login-password",
      "/api/member/forgot-password",
      "/api/member/reset-password",
    ]) {
      expect(code).toContain(path);
    }
  });

  it("marks them as proposals rather than quotations", () => {
    // Conflict C11, now six routes rather than two. PRD section 10.4 lists
    // none of them, and a reader of this file has to know that.
    expect(source).toContain("proposals, not quotations");
  });

  it("sends no siteId in any request body", () => {
    // FP-02's contract includes one. It is left out deliberately: the backend
    // knows the site from the request origin, and a client-supplied siteId is
    // a cross-site read waiting to be tried.
    expect(code).not.toMatch(/siteId/);
  });

  it("separates where the visitor is from what the component is doing", () => {
    // `05-member-auth.md` section 9.2. Five views times six phases is what
    // folding them into one union would have cost.
    expect(code).toContain("type AuthView =");
    expect(code).toContain("type AuthState =");
  });

  it("carries all five views", () => {
    for (const view of ["otp", "password_signin", "password_signup", "forgot", "reset"]) {
      expect(code).toContain(`"${view}"`);
    }
  });
});

describe("FP-02: the plaintext password does not outlive its submit", () => {
  it("clears it on every exit path from a request", () => {
    // Three call sites: after the response arrives, whatever the status, and in
    // the catch. A path that returns without clearing is the defect this guards.
    expect(code.match(/setPassword\(""\)/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it("clears it when the visitor changes view", () => {
    // A password typed into sign-up and carried into sign-in would be submitted
    // by a form the visitor never filled.
    const effect = code.slice(code.indexOf("setPassword(\"\")"));
    expect(effect).toContain("[view]");
  });

  it("never writes it anywhere that survives the page", () => {
    for (const sink of ["document.cookie", "setPluginData"]) {
      expect(code).not.toContain(sink);
    }
    // The only values written to storage are the hint and a confirmed address.
    for (const call of storageAccess(code).calls.filter((entry) => entry.includes("setItem"))) {
      expect(call.toLowerCase()).not.toContain("password");
    }
  });

  it("never logs it, because there is no logging at all", () => {
    expect(code).not.toContain("console.");
  });

  it("never puts a credential in a URL", () => {
    // A query string reaches browser history and the `Referer` header. Every
    // password request is a POST with a JSON body.
    expect(code).not.toMatch(/password=\$\{/);
    expect(code).not.toMatch(/URLSearchParams\([^)]*password/);
  });

  it("posts every credential, never gets", () => {
    // The password rules GET sends no credential and no cookie.
    const fetchCalls = (authCode.match(/fetch\([^)]*\)[\s\S]{0,400}?\}\)/g) ?? []).filter((call) => !call.includes("AUTH_CONFIG_PATH"));
    expect(fetchCalls.length).toBeGreaterThan(0);

    for (const call of fetchCalls) {
      expect(call).toContain('method: "POST"');
    }
  });
});

describe("FP-02: what the password path refuses to reveal", () => {
  it("gives one message for a wrong password and an unknown address", () => {
    // FP-02 section 3.4 rule 3, and the easiest line in the component to break
    // later by being helpful.
    expect(code).toContain("Invalid email or password.");
    expect(code).not.toMatch(/no account with that email/i);
    expect(code).not.toMatch(/email not found/i);
    expect(code).not.toMatch(/wrong password/i);
  });

  it("never asks whether a password is set", () => {
    // An SSO-only member has a NULL hash. A response that said so would be an
    // enumeration oracle. See `00-member-data-model.md` section 5.2.
    expect(code).not.toMatch(/hasPassword/);
    expect(code).not.toMatch(/passwordSet/);
  });

  it("says if rather than we sent on the reset confirmation", () => {
    // A confident "we sent you a link" tells an attacker the address exists.
    expect(code).toContain("has an account, a reset link");
  });

  it("shows the same confirmation screen whatever the server knows", () => {
    // The screen is driven by one phase with no branch on whether the address
    // was found, because the server never says.
    expect(code).toContain('phase: "reset_requested"');
    expect(code).not.toMatch(/accountExists/);
  });
});

describe("FP-02: the form details that only matter when they are wrong", () => {
  it("asks a password manager for the right thing on each view", () => {
    // `current-password` fills an existing secret, `new-password` generates
    // one. The wrong value on sign-up offers the old password for a new account.
    //
    // The field is one helper, so the value arrives as an argument rather than
    // a literal attribute. Checking the attribute binding alone would not say
    // which view gets which, which is the part worth asserting.
    expect(code).toContain("autoComplete={autoComplete}");

    // The visible label comes from the Labels group; the autocomplete token
    // does not, so a creator renaming a field cannot change which one it is.
    expect(code).toContain('passwordField(t("passwordLabel"), "current-password")');
    expect(code).toContain('passwordField(t("passwordLabel"), "new-password")');
    expect(code).toContain('passwordField(t("newPasswordLabel"), "new-password")');

    // And the type is narrowed, so a fourth call cannot pass something else.
    expect(code).toContain('autoComplete: "current-password" | "new-password"');
  });

  it("has a show and hide toggle whose label says what pressing it does", () => {
    // A button reading "Hide" while the password is hidden is the usual bug.
    expect(code).toContain('showPassword ? "Hide password" : "Show password"');
    expect(code).toContain("aria-pressed={showPassword}");
  });

  it("switches the input type rather than faking it", () => {
    expect(code).toContain('type={showPassword ? "text" : "password"}');
  });

  it("sends rememberMe as a flag and claims nothing about the cookie", () => {
    // The 30-day lifetime is entirely the backend's. The component cannot see
    // a cookie it is not allowed to read.
    expect(code).toContain("rememberMe");
    expect(code).not.toMatch(/maxAge|max-age|expires/i);
  });

  it("does not validate the password on sign-in", () => {
    // A member whose password predates a rule change must still get in. The
    // server is the only authority on whether it is correct.
    const signIn = code.slice(code.indexOf("const signInWithPassword"));
    const body = signIn.slice(0, signIn.indexOf("}, ["));

    expect(body).toContain('password === ""');
    expect(body).not.toContain("passwordProblems");
  });

  it("does validate the password where one is being chosen", () => {
    for (const handler of ["const register", "const completePasswordReset"]) {
      const section = code.slice(code.indexOf(handler));
      expect(section.slice(0, 600)).toContain("passwordProblems");
    }
  });
});

describe("FP-02: the three new controls round-trip through the generator", () => {
  it("emits them into the config block, with the site's password rules", () => {
    const generated = generateMemberAuthCode(config({ enablePasswordAuth: true, defaultAuthMethod: "otp" }), undefined, {
      apiBaseUrl: "https://api.example.com",
      siteKey: "site_1",
      afterLoginPath: "",
      loginPath: "/login",
      afterLogoutPath: "/",
      passwordPolicy: { minLength: 12, requireNumber: false, requireUppercase: true, requireLowercase: false, requireSymbol: true },
    }).code;

    const block = generated.slice(
      generated.indexOf(CONFIG_START_MARKER),
      generated.indexOf(CONFIG_END_MARKER)
    );

    expect(block).toContain("enablePasswordAuth: true,");
    expect(block).toContain('defaultAuthMethod: "otp",');
    expect(block).toContain(
      "passwordPolicy: { minLength: 12, requireNumber: false, requireUppercase: true, requireLowercase: false, requireSymbol: true },"
    );
  });

  it("coerces an unrecognised method to otp, not to the newer flow", () => {
    // A malformed config should not silently select the path whose endpoints
    // are still proposals.
    const normalized = normalizeAuthConfig(
      config({ defaultAuthMethod: "nonsense" as MemberAuthConfig["defaultAuthMethod"] })
    );

    expect(normalized.defaultAuthMethod).toBe("otp");
  });

  it("keeps a valid method untouched", () => {
    expect(normalizeAuthConfig(config({ defaultAuthMethod: "password" })).defaultAuthMethod).toBe(
      "password"
    );
    expect(normalizeAuthConfig(config({ defaultAuthMethod: "otp" })).defaultAuthMethod).toBe("otp");
  });

  it("coerces the boolean rather than passing a truthy value through", () => {
    const normalized = normalizeAuthConfig(config({ enablePasswordAuth: 1 as unknown as boolean }));

    expect(normalized.enablePasswordAuth).toBe(true);
  });

  it("has no Strong Password control: the rules are the site's (05-member-auth.md 13)", () => {
    const controls = code.slice(code.indexOf("addPropertyControls("));
    expect(controls).not.toContain("requirePasswordStrength");
    expect(code).toContain('const AUTH_CONFIG_PATH = "/api/member/auth-config";');
    expect(code).toContain("if (body && body.passwordPolicy) setPolicy(readPasswordPolicy(body.passwordPolicy));");
    expect(code).toContain("passwordProblems(password, email, policy)");
  });

  it("still changes nothing outside the config block", () => {
    const base = generateMemberAuthCode(config()).code;
    const changed = generateMemberAuthCode(config({ enablePasswordAuth: false })).code;

    const strip = (text: string) =>
      text.slice(0, text.indexOf(CONFIG_START_MARKER)) + text.slice(text.indexOf(CONFIG_END_MARKER));

    expect(strip(changed)).toBe(strip(base));
  });

  it("the defaults ship the password path on", () => {
    // FP-02's market reason is that the absence loses the B2B buyer, so a
    // creator who deploys without touching a control gets it.
    expect(DEFAULT_MEMBER_AUTH_CONFIG.enablePasswordAuth).toBe(true);
    expect(DEFAULT_MEMBER_AUTH_CONFIG.defaultAuthMethod).toBe("password");
  });
});

describe("FP-02: the component still fits the budget it has to fit", () => {
  it("stays under the 40kB gzipped per-component limit", () => {
    // PRD section 14.2 P3. The password flow, the meter, and the common-password
    // list all ship to the creator's site.
    const gzipped = gzipSync(Buffer.from(generateMemberAuthCode(config()).code, "utf-8")).length;

    expect(gzipped).toBeLessThan(40 * 1024);
  });
});

describe("email confirmation after password sign up", () => {
  /** The body of one `useCallback` or function, from its name to the next blank-line-separated definition. */
  const block = (start: string, length = 2400) => code.slice(code.indexOf(start), code.indexOf(start) + length);

  it("opens the code step after register instead of signing the member in", () => {
    const register = block("const register = useCallback");
    expect(register).toContain('data["verificationRequired"] === true');
    expect(register).toContain('purpose: "verify"');
    // The confirmation branch returns before the signed-in path runs.
    expect(register.indexOf("return;")).toBeLessThan(register.indexOf('setState({ phase: "signed_in" })'));
  });

  it("confirms through the verify-email route, which signs nobody in", () => {
    expect(code).toContain('const VERIFY_EMAIL_PATH = "/api/member/verify-email";');
    const verify = block("const verifyCode = useCallback");
    expect(verify).toContain("confirming ? VERIFY_EMAIL_PATH : VERIFY_OTP_PATH");
    expect(verify).toContain("emailConfirmed(pendingEmail)");
  });

  it("lands on the sign in form with a success message, never on a session", () => {
    const confirmed = block("const emailConfirmed = useCallback");
    expect(confirmed).toContain('setView("password_signin")');
    expect(confirmed).toContain('t("verifiedNotice")');
    expect(confirmed).not.toContain("notifySessionUpdated");
    expect(confirmed).not.toContain("redirectAfterAuth");
  });

  it("goes to the configured sign in page when sign up is its own page", () => {
    const confirmed = block("const emailConfirmed = useCallback");
    expect(confirmed).toContain('dedicated && screen !== "login" && linkablePath(loginPath, false)');
    expect(confirmed).toContain("goTo(loginPath)");
    // The address rides in sessionStorage, not the URL.
    expect(confirmed).toContain("sessionStorage.setItem(VERIFIED_KEY, address)");
  });

  it("opens the code step when a sign in is refused for an unconfirmed address", () => {
    const submit = block("const submitCredentials = useCallback", 4000);
    expect(submit).toContain('payload.reason === "email_not_verified"');
    expect(submit).toContain('purpose: "verify"');
  });

  it("resends a confirmation code through its own route", () => {
    expect(code).toContain('purpose === "verify" ? RESEND_VERIFICATION_PATH : SEND_OTP_PATH');
    expect(code).toContain('sendCode(state.purpose ?? "signin", state.email)');
  });
});

describe("no redirect loop with the Route Shield", () => {
  it("does not send a signed-in member back to a page the shield just denied them", () => {
    expect(code).toContain("if (!recentlyDenied(afterLoginTarget())) leaveForAfterLogin();");
  });

  it("keeps the shield's hint in step with every sign in and sign out", () => {
    const notify = code.slice(code.indexOf("function notifySessionUpdated"), code.indexOf("function recentlyDenied"));
    expect(notify).toContain('localStorage.setItem(HINT_KEY, "1")');
    expect(notify).toContain("localStorage.removeItem(HINT_KEY)");
    expect(notify).toContain("sessionStorage.removeItem(SESSION_CACHE_KEY)");
  });
});

describe("modal triggers (05-member-auth.md)", () => {
  it("keeps the trigger settings safe to emit", () => {
    const normal = normalizeAuthConfig(
      config({ modalTrigger: "nope" as never, modalTriggerId: '#sign in"; }', modalDelay: 999, modalScrollPercent: -5 })
    );
    expect(normal.modalTrigger).toBe("click");
    expect(normal.modalTriggerId).toBe("signin");
    expect(normal.modalDelay).toBe(60);
    expect(normal.modalScrollPercent).toBe(0);
    expect(normalizeAuthConfig(config({ modalTrigger: "scroll" })).modalTrigger).toBe("scroll");
  });

  it("opens from a link to #id or a layer named id, before the link can navigate", () => {
    expect(code).toContain('node.getAttribute("data-framer-name") === id');
    expect(code).toContain('href === "#" + id || href.endsWith("#" + id)');
    expect(code).toContain('document.addEventListener("click", onClick, true);');
    expect(code).toContain("event.preventDefault();");
  });

  it("never opens by itself for a signed-in member, and closes on backdrop, Escape, and its button", () => {
    expect(code).toContain('return window.localStorage.getItem(HINT_KEY) === "1";');
    expect(code).toContain("if (event.target === event.currentTarget) closeModal();");
    expect(code).toMatch(/event\.key === "Escape"\)\s*\{\s*event\.stopPropagation\(\);\s*closeModal\(\);/);
    expect(code).toContain('className="memberframe-auth-close" aria-label="Close" onClick={closeModal}');
  });

  it("is always shown on the canvas, and draws only an empty anchor on a page until it opens", () => {
    expect(code).toContain("const showCard = !isModal || onCanvas || modalOpen;");
    expect(code).toContain("if (!isModal || onCanvas) return root;");
    expect(code).toContain('<span ref={anchorRef} className="memberframe-auth-anchor" aria-hidden={true} />');
    expect(code).not.toContain("if (!showCard) return null;");
  });
});

describe("a popup kept in a shared menu (05-member-auth.md 11.6)", () => {
  it("renders the open popup into the page's body, out of the menu's box", () => {
    expect(source).toContain('import { createPortal } from "react-dom";');
    expect(code).toContain('showCard && typeof document !== "undefined" ? createPortal(root, document.body) : null');
  });

  it("opens one popup per trigger, from a copy that is showing", () => {
    expect(code).toContain('const MODAL_REGISTRY_KEY = "__memberframeModals";');
    expect(code).toContain("if (!isShowing(anchorRef.current)) return false;");
    expect(code).toContain("if (!claimModal(modalKey)) return false;");
    // Every way of opening goes through openModal: click, hash, load, scroll.
    expect(code.match(/setModalOpen\(true\)/g)?.length).toBe(1);
    expect(code).toMatch(/event\.stopPropagation\(\);\s*openModal\(\);/);
    expect(code).toContain('if (window.location.hash === "#" + id) openModal();');
    expect(code).toContain("if (!openModal()) return;");
  });

  it("frees the trigger on close and when the copy goes away", () => {
    expect(code).toMatch(/const closeModal = useCallback\(\(\) => \{\s*if \(heldKey\.current\) \{\s*releaseModal\(heldKey\.current\);/);
    expect(code).toContain("if (heldKey.current) releaseModal(heldKey.current);");
  });

  it("can draw a chip on the canvas in place of the card", () => {
    expect(code).toContain("if (isModal && onCanvas && !modalCanvasPreview) {");
    expect(normalizeAuthConfig(config()).modalCanvasPreview).toBe(true);
    expect(normalizeAuthConfig(config({ modalCanvasPreview: false })).modalCanvasPreview).toBe(false);
    expect(normalizeAuthConfig(config({ modalCanvasPreview: undefined as never })).modalCanvasPreview).toBe(true);
  });
});

describe("social sign in under the email form (2026-10-20)", () => {
  it("renders the form, then the divider, then the providers", () => {
    const form = code.indexOf('<div className="memberframe-auth-form">{emailBody}</div>');
    const divider = code.indexOf('<div className="memberframe-auth-divider">');
    const providers = code.indexOf('<div className="memberframe-auth-providers">');
    expect(form).toBeGreaterThan(0);
    expect(divider).toBeGreaterThan(form);
    expect(providers).toBeGreaterThan(divider);
  });

  it("hides the providers while a code is being entered", () => {
    expect(code).toContain("providers.length > 0 && !awaitingCode ? (");
  });
});

describe("after sign in, the site's setting now, not the one the file was written with (2026-10-20)", () => {
  it("takes the destination from every sign in answer, the baked path only as a fallback", () => {
    expect(code).toContain("noteAfterLoginPath(data);");
    expect(code).toContain('return (siteAfterLoginPath ?? CONFIG.afterLoginPath) || "/dashboard";');
    expect(code).toContain("const path = checkoutIntentPath() ?? returnPath() ?? afterLoginTarget();");
  });
});

describe("reset asks for the new password twice (2026-10-22)", () => {
  it("has a confirm field that shares show and hide, and blocks a mismatch", () => {
    expect(code).toContain('{t("confirmPasswordLabel")}');
    expect(code).toContain('type={showPassword ? "text" : "password"}\n            autoComplete="new-password"\n            value={confirmPassword}');
    expect(code).toContain("if (confirmPassword !== password) return;");
    expect(code).toContain('confirmPasswordLabel: ["Confirm password label", "Confirm new password"],');
  });

  it("clears the second entry wherever the first is cleared", () => {
    expect(code.split('setPassword("");').length).toBe(code.split('setConfirmPassword("");').length);
  });
});

describe("a signed-in member on a sign-in page (2026-10-22)", () => {
  it("goes straight to the site's After sign in page, never a remembered page", () => {
    expect(code).toContain("if (!recentlyDenied(afterLoginTarget())) leaveForAfterLogin();");
    const leave = code.slice(code.indexOf("function leaveForAfterLogin(): void {"), code.indexOf("function redirectAfterAuth(): void {"));
    expect(leave).toContain("const path = afterLoginTarget();");
    expect(leave).not.toContain("returnPath()");
  });

  it("stays on a reset link to set a password", () => {
    expect(code).toContain("if (onCanvas || handoff || readResetToken() !== null) return;");
  });
});
