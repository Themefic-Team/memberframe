/**
 * What the generator bakes into a deployed component.
 *
 * This is the chain that makes a membership work at all, and until now nothing
 * checked it end to end. A canvas component runs on a creator's published site
 * and cannot import anything, so every fact it needs about the site has to be
 * written into its source at deploy time. Four facts, and each has a distinct
 * failure:
 *
 *   `siteKey`       omitted, and every request is a 400 the creator reads as a
 *                   server outage.
 *   `apiBaseUrl`    pointed at loopback, and the component works in the panel
 *                   and silently fails on the published site.
 *   `afterLoginPath` wrong, and a member signs in and goes nowhere.
 *   `loginPath`     wrong, and a signed-out visitor is sent to a 404.
 *
 * Three of the four are invisible on the canvas and only appear once a real
 * visitor hits a real published page, which is exactly why they are worth
 * pinning here.
 */

import { describe, expect, it } from "vitest";
import {
  DISCONNECTED_DEPLOY_CONTEXT,
  generateMemberAuthCode,
  generateMemberDashboardCode,
  type DeployContext,
} from "../src/services/canvasComponentCodeGenerator";
import { DEFAULT_API_BASE_URL, deployBaseUrl, isLoopbackUrl } from "../src/config/backend";
import {
  DEFAULT_MEMBER_AUTH_CONFIG,
  DEFAULT_MEMBER_DASHBOARD_CONFIG,
} from "../src/types/canvas";

const CONNECTED: DeployContext = {
  apiBaseUrl: "https://api.example.test",
  siteKey: "mf_site_0123456789abcdef0123456789abcdef",
  afterLoginPath: "/dashboard",
  loginPath: "/members/sign-in",
  afterLogoutPath: "/goodbye",
};

/** Read one emitted `key: value,` line out of the generated config block. */
function configValue(code: string, key: string): string | null {
  const match = new RegExp(`^\\s*${key}:\\s*(.+),$`, "m").exec(code);
  return match?.[1] ?? null;
}

describe("isLoopbackUrl", () => {
  it("recognises the addresses only the developer's machine can reach", () => {
    expect(isLoopbackUrl("http://127.0.0.1:4000")).toBe(true);
    expect(isLoopbackUrl("http://localhost:4000")).toBe(true);
    expect(isLoopbackUrl("https://localhost")).toBe(true);
  });

  it("leaves a real host alone", () => {
    expect(isLoopbackUrl("https://api.memberframe.framefic.com")).toBe(false);
    expect(isLoopbackUrl("https://tunnel.ngrok.app")).toBe(false);
  });

  it("is false rather than throwing for something that is not a URL", () => {
    expect(isLoopbackUrl("")).toBe(false);
    expect(isLoopbackUrl("not a url")).toBe(false);
  });
});

describe("deployBaseUrl", () => {
  it("uses the configured API base URL dynamically", () => {
    expect(deployBaseUrl("http://127.0.0.1:4001")).toBe("http://127.0.0.1:4001");
    expect(deployBaseUrl("http://localhost:4001")).toBe("http://localhost:4001");
  });

  it("passes a tunnel or a production host through", () => {
    // Developing against a published site means a tunnel with a stable HTTPS hostname
    expect(deployBaseUrl("https://alpha.ngrok.app")).toBe("https://alpha.ngrok.app");
  });
});

describe("the disconnected context", () => {
  it("carries an empty site key", () => {
    expect(DISCONNECTED_DEPLOY_CONTEXT.siteKey).toBe("");
  });

  it("carries the configured or default apiBaseUrl", () => {
    expect(DISCONNECTED_DEPLOY_CONTEXT.apiBaseUrl).toBe(DEFAULT_API_BASE_URL);
  });
});

describe("generateMemberAuthCode", () => {
  it("bakes the site key and the post-login path", () => {
    const { code } = generateMemberAuthCode(DEFAULT_MEMBER_AUTH_CONFIG, undefined, CONNECTED);

    expect(configValue(code, "siteKey")).toBe(`"${CONNECTED.siteKey}"`);
    expect(configValue(code, "afterLoginPath")).toBe('"/dashboard"');
    expect(configValue(code, "apiBaseUrl")).toBe('"https://api.example.test"');
  });

  it("sends the key as a header rather than only storing it", () => {
    // The field being present in the config block proves nothing on its own:
    // it has to reach a request. This asserts the header name appears in the
    // emitted source, which is what `resolveSite` reads.
    const { code } = generateMemberAuthCode(DEFAULT_MEMBER_AUTH_CONFIG, undefined, CONNECTED);
    expect(code).toContain("X-MemberFrame-Site");
  });

  it("emits an empty key when disconnected, rather than omitting the field", () => {
    // An omitted field would be `undefined` at runtime and the component's
    // `CONFIG.siteKey !== ""` guard would not catch it.
    const { code } = generateMemberAuthCode(DEFAULT_MEMBER_AUTH_CONFIG);
    expect(configValue(code, "siteKey")).toBe('""');
  });
});

describe("generateMemberDashboardCode", () => {
  it("bakes the connection and both navigation paths", () => {
    const { code } = generateMemberDashboardCode(
      DEFAULT_MEMBER_DASHBOARD_CONFIG,
      undefined,
      CONNECTED
    );

    expect(configValue(code, "siteKey")).toBe(`"${CONNECTED.siteKey}"`);
    expect(configValue(code, "loginPath")).toBe('"/members/sign-in"');
    expect(configValue(code, "afterLogoutPath")).toBe('"/goodbye"');
  });

  it("keeps the config block exactly once, so a second deploy is idempotent", () => {
    const first = generateMemberDashboardCode(
      DEFAULT_MEMBER_DASHBOARD_CONFIG,
      undefined,
      CONNECTED
    );

    // Regenerating from the output of the first pass must produce the same
    // file. If the markers were consumed or duplicated, a creator clicking
    // "Add to canvas" twice would deploy a broken component the second time.
    const second = generateMemberDashboardCode(
      DEFAULT_MEMBER_DASHBOARD_CONFIG,
      first.code,
      CONNECTED
    );

    expect(second.code).toBe(first.code);
  });

  it("refuses an unsafe accent colour rather than writing it into the project", () => {
    // `ControlType.Color` hands back a creator-controlled string that is
    // interpolated into a `<style>` block. A value carrying `}` could close
    // the rule and open another, so it is sanitized here as well as at
    // runtime: an unsafe value should never reach the creator's project file.
    const { code, config } = generateMemberDashboardCode(
      { ...DEFAULT_MEMBER_DASHBOARD_CONFIG, accentColor: "red; } body { display: none; } a {" },
      undefined,
      CONNECTED
    );

    expect(config.accentColor).toBe(DEFAULT_MEMBER_DASHBOARD_CONFIG.accentColor);
    expect(code).not.toContain("display: none");
  });

  it("clamps the corner radius", () => {
    const { config } = generateMemberDashboardCode(
      { ...DEFAULT_MEMBER_DASHBOARD_CONFIG, borderRadius: 9999 },
      undefined,
      CONNECTED
    );

    expect(config.borderRadius).toBe(32);
  });
});
