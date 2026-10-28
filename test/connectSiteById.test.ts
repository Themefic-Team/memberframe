/**
 * The panel finds this project's site by the site id in its plugin data, and
 * sends nothing about the Framer project (Marketplace review, 2026-10-28).
 */

import { describe, expect, it, vi } from "vitest";
import { attachProject, siteById, toConnection, type ConnectSessionSite } from "../src/services/connectService";
import type { ApiClient } from "../src/services/apiClient";

const site = (siteId: string): ConnectSessionSite =>
  ({ siteId, siteKey: `key-${siteId}`, siteName: null, allowedOrigins: [], memberCount: 0, settings: {}, settingsVersion: 1 }) as unknown as ConnectSessionSite;

describe("siteById", () => {
  it("picks the stored site, never the first one", () => {
    expect(siteById([site("a"), site("b")], "b")?.siteId).toBe("b");
  });

  it("finds nothing without an id, or for an id that is gone", () => {
    expect(siteById([site("a")], undefined)).toBeNull();
    expect(siteById([site("a")], "gone")).toBeNull();
  });
});

describe("attachProject", () => {
  it("posts the site id alone", async () => {
    const post = vi.fn(async () => ({ kind: "ok", data: {} }));
    await attachProject({ siteId: "site-1" }, { post } as unknown as ApiClient);
    expect(post).toHaveBeenCalledWith("/api/connect/attach-project", { siteId: "site-1" });
  });
});

describe("toConnection", () => {
  it("keeps the open project's own id, and an empty name for a nameless site", () => {
    const connection = toConnection(site("a"), { email: "me@example.com", name: "Me" }, "project-a");
    expect(connection.framerProjectId).toBe("project-a");
    expect(connection.siteName).toBe("");
  });
});
