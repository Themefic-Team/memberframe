/**
 * Marketplace audit C1: the creator token never goes into shared plugin data.
 *
 * Plugin data syncs to every collaborator and travels with a duplicated
 * project. The token lives in this browser's localStorage, keyed by the open
 * project, and a token an older version left in plugin data is deleted, never
 * adopted.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const pluginData = new Map<string, string>();
const setPluginData = vi.fn(async (key: string, value: string | null) => {
  if (value === null) pluginData.delete(key);
  else pluginData.set(key, value);
});

vi.mock("framer-plugin", () => ({
  framer: {
    getPluginData: async (key: string) => pluginData.get(key) ?? null,
    setPluginData,
    isAllowedTo: () => true,
    subscribeToIsAllowedTo: () => () => undefined,
  },
}));

const store = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  },
};

const { LOCAL_TOKEN_PREFIX, clearConnection, currentCreatorToken, loadStoredConnection, saveConnection } = await import(
  "../src/services/connectionStore"
);

const PROJECT = "project-a";
const TOKEN = "creator-token-0123456789abcdefghijklmnopqrstu";
const connection = {
  siteId: "site-1",
  siteKey: "pk_site_1",
  siteName: "Site",
  framerProjectId: PROJECT,
  creatorEmail: "creator@example.com",
  creatorName: "Creator",
  allowedOrigins: [],
};

beforeEach(async () => {
  await clearConnection();
  pluginData.clear();
  store.clear();
  setPluginData.mockClear();
});

describe("creator token storage (audit C1)", () => {
  it("saves the token in this browser only, never through setPluginData", async () => {
    await saveConnection(connection, TOKEN);
    for (const [, value] of setPluginData.mock.calls) expect(String(value)).not.toContain(TOKEN);
    expect([...pluginData.values()].join(" ")).not.toContain(TOKEN);
    expect(store.get(LOCAL_TOKEN_PREFIX + PROJECT)).toBe(TOKEN);
  });

  it("reloads the connection for the same project in the same browser", async () => {
    await saveConnection(connection, TOKEN);
    const loaded = await loadStoredConnection(PROJECT);
    expect(loaded?.token).toBe(TOKEN);
    expect(loaded?.connection.siteId).toBe("site-1");
  });

  it("a duplicated project, which carries the connection, finds no token", async () => {
    await saveConnection(connection, TOKEN);
    expect(await loadStoredConnection("project-copy")).toBeNull();
  });

  it("another browser (empty localStorage) shows signed out", async () => {
    await saveConnection(connection, TOKEN);
    store.clear();
    expect(await loadStoredConnection(PROJECT)).toBeNull();
  });

  it("a token an older version left in plugin data is deleted, not adopted", async () => {
    pluginData.set("memberframe.connection", JSON.stringify(connection));
    pluginData.set("memberframe.creatorToken", "legacy-token");
    expect(await loadStoredConnection(PROJECT)).toBeNull();
    expect(currentCreatorToken()).toBeNull();
    expect(pluginData.has("memberframe.creatorToken")).toBe(false);
    expect([...store.values()]).not.toContain("legacy-token");
  });

  it("disconnecting removes the token from this browser", async () => {
    await saveConnection(connection, TOKEN);
    await clearConnection();
    expect(store.has(LOCAL_TOKEN_PREFIX + PROJECT)).toBe(false);
    expect(currentCreatorToken()).toBeNull();
  });
});
