/**
 * Deployed components follow the plugin's current site and server. A stale
 * site key (after signing in again) refused every sign up on the live page.
 */

import { describe, expect, it, vi } from "vitest";
import { MEMBERFRAME_FILE_NAMES, patchSiteConfig, syncSiteConfig } from "../src/utils/configPatcher";
import { AUTH_SCREEN_DESCRIPTORS, BOOKMARK_BUTTON_DESCRIPTOR, generateComponentCode, MEMBER_PRICING_DESCRIPTOR } from "../src/services/canvasComponentCodeGenerator";
import { DEFAULT_BOOKMARK_BUTTON_CONFIG, DEFAULT_MEMBER_PRICING_CONFIG } from "../src/types/canvas";

const OLD = { apiBaseUrl: "http://127.0.0.1:4001", siteKey: "mf_site_00ccdc987443f8f29ff2fed11ac05aad", afterLoginPath: "", loginPath: "/login", afterLogoutPath: "/" };
const NEW = { siteKey: "mf_site_6850d4bdfbfc5241fb13d804214111e2", apiBaseUrl: "https://app.framefic.com/memberframe" };

const login = generateComponentCode(AUTH_SCREEN_DESCRIPTORS.member_login, AUTH_SCREEN_DESCRIPTORS.member_login.normalize({} as never), undefined, OLD).code;
const pricing = generateComponentCode(MEMBER_PRICING_DESCRIPTOR, DEFAULT_MEMBER_PRICING_CONFIG, undefined, OLD).code;
const bookmark = generateComponentCode(BOOKMARK_BUTTON_DESCRIPTOR, DEFAULT_BOOKMARK_BUTTON_CONFIG, undefined, OLD).code;

describe("patchSiteConfig", () => {
  it("rewrites the site key and server in a generated file's config, and nothing else", () => {
    for (const code of [login, pricing, bookmark]) {
      const next = patchSiteConfig(code, NEW);
      expect(next).not.toBeNull();
      expect(next).toContain(`siteKey: "${NEW.siteKey}",`);
      expect(next).toContain(`apiBaseUrl: "${NEW.apiBaseUrl}",`);
      expect(next).not.toContain(OLD.siteKey);
      // Only the two lines changed.
      expect(next!.split("\n").filter((line, i) => line !== code.split("\n")[i])).toHaveLength(2);
    }
  });

  it("leaves a file that is already current, or has no config block, alone", () => {
    expect(patchSiteConfig(patchSiteConfig(login, NEW)!, NEW)).toBeNull();
    expect(patchSiteConfig("export default function X() {}", NEW)).toBeNull();
  });
});

describe("syncSiteConfig", () => {
  it("writes only MemberFrame files that are stale", async () => {
    const file = (name: string, content: string) => ({ name, content, setFileContent: vi.fn(async () => undefined) });
    const files = [file("MemberLogin.tsx", login), file("BookmarkButton.tsx", bookmark), file("Other.tsx", login), file("MemberPricing.tsx", patchSiteConfig(pricing, NEW)!)];
    expect(await syncSiteConfig(files, NEW)).toBe(2);
    expect(files[0]!.setFileContent).toHaveBeenCalledOnce();
    expect(files[1]!.setFileContent).toHaveBeenCalledOnce();
    expect(files[2]!.setFileContent).not.toHaveBeenCalled();
    expect(files[3]!.setFileContent).not.toHaveBeenCalled();
    expect(await syncSiteConfig(files, { siteKey: "", apiBaseUrl: NEW.apiBaseUrl })).toBe(0);
    expect(MEMBERFRAME_FILE_NAMES).toContain("BookmarksTray.tsx");
  });
});
