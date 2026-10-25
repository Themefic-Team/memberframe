/**
 * The canvas guard's half of Protected Download (32-canvas-downloads.md):
 * what an instance's controls say, the rule they make, and what is sent to
 * the server. The guard then writes the Asset ID back and clears File and
 * Password, so neither reaches the published page.
 */

import { describe, expect, it, vi } from "vitest";
import {
  downloadFingerprint,
  fileUrlOf,
  nameFromUrl,
  parseDownloadRules,
  planDownload,
  readDownloadControls,
  ruleOf,
  securePlan,
  SAVED_PASSWORD,
  shortHash,
  type DownloadState,
} from "../src/services/downloadVault";
import type { ApiClient } from "../src/services/apiClient";

const FILE = "https://framerusercontent.com/assets/AbCdEf123.zip";
const NEW_FILE = "https://framerusercontent.com/assets/ZyXw987.zip";

const state = (over: Partial<DownloadState> = {}): DownloadState => ({
  fileUrl: "",
  fileName: "",
  access: "members",
  whoCanDownload: "signed_in",
  chosenTiers: [],
  password: "",
  assetId: "",
  ...over,
});

describe("reading the sidebar", () => {
  it("takes the file's address however Framer hands it over", () => {
    expect(fileUrlOf(FILE)).toBe(FILE);
    expect(fileUrlOf({ url: FILE, id: "x" })).toBe(FILE);
    expect(fileUrlOf(null)).toBe("");
    expect(fileUrlOf(42)).toBe("");
  });

  it("reads every control, keeping a password's spaces", () => {
    expect(
      readDownloadControls({
        file: { url: FILE },
        fileName: " kit.zip ",
        access: "password",
        whoCanDownload: "chosen",
        chosenTiers: ["tier_gold", "", 3],
        password: " open sesame ",
        assetId: "ast_x",
      })
    ).toEqual({
      fileUrl: FILE,
      fileName: "kit.zip",
      access: "password",
      whoCanDownload: "chosen",
      chosenTiers: ["tier_gold"],
      password: " open sesame ",
      assetId: "ast_x",
    });
    expect(readDownloadControls(undefined).access).toBe("members");
  });

  it("makes the same rule strings as page and section locks", () => {
    expect(ruleOf(state())).toBe("signed_in");
    expect(ruleOf(state({ whoCanDownload: "any_paid" }))).toBe("any_paid");
    expect(ruleOf(state({ whoCanDownload: "tier_gold" }))).toBe("tier_gold");
    expect(ruleOf(state({ whoCanDownload: "chosen", chosenTiers: ["tier_silver", "tier_gold"] }))).toBe("only:tier_silver,tier_gold");
    expect(ruleOf(state({ whoCanDownload: "chosen" }))).toBeNull();
    expect(ruleOf(state({ access: "password", whoCanDownload: "tier_gold" }))).toBe("password");
  });

  it("names a file from its address when File Name is empty", () => {
    expect(nameFromUrl(FILE)).toBe("AbCdEf123.zip");
    expect(nameFromUrl("not a url")).toBe("download");
  });
});

describe("what to send", () => {
  it("does nothing for an empty component", () => {
    expect(planDownload(state(), {})).toEqual({ kind: "none" });
  });

  it("creates a linked file for a new upload, with the rule and the password", () => {
    const plan = planDownload(state({ fileUrl: FILE, fileName: "kit.zip", access: "password", password: "open-sesame" }), {});
    expect(plan).toMatchObject({
      kind: "create",
      input: { name: "kit.zip", url: FILE, fileName: "kit.zip", requiredTier: "password", password: "open-sesame" },
    });
    // The fingerprint keeps a hash of the address, never the address.
    expect(plan.kind === "create" ? plan.fingerprint : "").not.toContain("framerusercontent");
  });

  it("reads the saved-password mark as no new password, so it is never sent", () => {
    expect(SAVED_PASSWORD).toBe("•".repeat(8));
    expect(readDownloadControls({ access: "password", password: SAVED_PASSWORD, assetId: "ast_1" }).password).toBe("");
    const synced = { ast_1: downloadFingerprint("password", "", FILE) };
    expect(planDownload(readDownloadControls({ access: "password", password: SAVED_PASSWORD, assetId: "ast_1" }), synced)).toEqual({ kind: "none" });
  });

  it("takes any password, short or long, up to 200 characters (2026-10-22)", () => {
    expect(planDownload(state({ fileUrl: FILE, access: "password", password: "7" }), {}).kind).toBe("create");
    expect(planDownload(state({ fileUrl: FILE, access: "password", password: "Syd" }), {}).kind).toBe("create");
    expect(planDownload(state({ fileUrl: FILE, access: "password", password: "x".repeat(201) }), {})).toEqual({
      kind: "blocked",
      message: "The download's password can be up to 200 characters.",
    });
  });

  it("waits, with a reason, rather than secure a file nobody or anybody could open", () => {
    expect(planDownload(state({ fileUrl: FILE, whoCanDownload: "chosen" }), {}).kind).toBe("blocked");
    expect(planDownload(state({ fileUrl: FILE, access: "password" }), {}).kind).toBe("blocked");
  });

  it("sends a replaced file, a changed rule, or a new password, and nothing when nothing changed", () => {
    const synced = { ast_1: downloadFingerprint("signed_in", "", FILE) };
    expect(planDownload(state({ assetId: "ast_1" }), synced)).toEqual({ kind: "none" });
    expect(planDownload(state({ assetId: "ast_1", fileUrl: NEW_FILE }), synced)).toMatchObject({ kind: "update", patch: { url: NEW_FILE } });
    expect(planDownload(state({ assetId: "ast_1", whoCanDownload: "any_paid" }), synced)).toMatchObject({ kind: "update", patch: { requiredTier: "any_paid" } });
    // Switching to Password needs a password first.
    expect(planDownload(state({ assetId: "ast_1", access: "password" }), synced).kind).toBe("blocked");
    expect(planDownload(state({ assetId: "ast_1", access: "password", password: "secret1" }), synced)).toMatchObject({
      kind: "update",
      patch: { requiredTier: "password", password: "secret1" },
    });
  });

  it("does not send a saved file again when Framer left it in the sidebar (2026-10-22)", () => {
    // Framer ignored the plugin clearing File: the same file stays there.
    const synced = { ast_1: downloadFingerprint("signed_in", "", FILE) };
    expect(planDownload(state({ assetId: "ast_1", fileUrl: FILE }), synced)).toEqual({ kind: "none" });
    // A rule change still goes up, without the file.
    const plan = planDownload(state({ assetId: "ast_1", fileUrl: FILE, whoCanDownload: "any_paid" }), synced);
    expect(plan).toMatchObject({ kind: "update", patch: { requiredTier: "any_paid" } });
    expect(plan.kind === "update" ? plan.patch.url : "x").toBeUndefined();
  });

  it("keeps a password file's password when only the name changes", () => {
    const synced = { ast_1: downloadFingerprint("password", "", FILE) };
    const plan = planDownload(state({ assetId: "ast_1", access: "password", fileName: "deck.pdf" }), synced);
    expect(plan).toMatchObject({ kind: "update", patch: { fileName: "deck.pdf", requiredTier: "password" } });
    expect(plan.kind === "update" ? plan.patch.password : "x").toBeUndefined();
  });

  it("never loosens an older file it did not set up: it remembers it and sends nothing", () => {
    // An Asset ID pasted before canvas uploads, the sidebar still on its default.
    expect(planDownload(state({ assetId: "ast_old" }), {})).toMatchObject({ kind: "adopt", assetId: "ast_old" });
  });

  it("reads the registry defensively", () => {
    expect(parseDownloadRules('{"ast_1":"signed_in||abc","bad":3}')).toEqual({ ast_1: "signed_in||abc" });
    expect(parseDownloadRules("not json")).toEqual({});
    expect(parseDownloadRules(null)).toEqual({});
  });
});

describe("the component's view of a saved file", () => {
  it("fingerprints an address exactly as the plugin does", async () => {
    const { readFileSync } = await import("node:fs");
    const ts = (await import("typescript")).default;
    const source = readFileSync("src/canvas-components/ProtectedDownload.tsx", "utf-8");
    const start = source.indexOf("function mfFileHash(");
    const fn = source.slice(start, source.indexOf("\n}\n", start) + 2);
    const js = ts.transpileModule(fn, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None } }).outputText;
    // eslint-disable-next-line no-new-func
    const mfFileHash = new Function(`${js}\nreturn mfFileHash;`)() as (value: string) => string;
    for (const value of [FILE, NEW_FILE, "", "https://x.test/ä é.zip"]) expect(mfFileHash(value)).toBe(shortHash(value));
    // And says "clear the field" for the saved file, "open MemberFrame" for a new one.
    expect(source).toContain('const savedButShown = unsecured && fileSecured !== "" && mfFileHash(file.trim()) === fileSecured;');
    expect(source).toContain('note: t(savedButShown ? "clearFile" : "unsecured")');
  });
});

describe("carrying it out", () => {
  const asset = (id: string) => ({ kind: "ok" as const, data: { asset: { id } } });

  it("creates, and reports the new Asset ID", async () => {
    const post = vi.fn(async () => asset("ast_new"));
    const client = { post } as unknown as ApiClient;
    const current = state({ fileUrl: FILE });
    const outcome = await securePlan("site_1", planDownload(current, {}), current, client);
    expect(outcome).toMatchObject({ kind: "secured", assetId: "ast_new" });
    expect(post).toHaveBeenCalledWith("/api/site/assets", expect.objectContaining({ siteId: "site_1", url: FILE, requiredTier: "signed_in" }));
  });

  it("creates the file again when the server no longer has it", async () => {
    const patch = vi.fn(async () => ({ kind: "unavailable" as const, status: 404, detail: "" }));
    const post = vi.fn(async () => asset("ast_again"));
    const client = { post, patch } as unknown as ApiClient;
    const current = state({ assetId: "ast_gone", fileUrl: NEW_FILE });
    const plan = planDownload(current, { ast_gone: downloadFingerprint("signed_in", "", FILE) });
    expect(await securePlan("site_1", plan, current, client)).toMatchObject({ kind: "secured", assetId: "ast_again" });
  });

  it("reports a failure and changes nothing", async () => {
    const post = vi.fn(async () => ({ kind: "unavailable" as const, status: 400, detail: "", reason: "unknown_tier" }));
    const current = state({ fileUrl: FILE, whoCanDownload: "tier_gone" });
    const outcome = await securePlan("site_1", planDownload(current, {}), current, { post } as unknown as ApiClient);
    expect(outcome.kind).toBe("failed");
  });
});
