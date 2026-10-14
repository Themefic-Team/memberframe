/**
 * The local development API proxy decision. `src/config/devProxy.ts`.
 *
 * Two things must agree: whether `vite.config.ts` forwards `/api`, and whether
 * the panel calls its own origin. If they disagree in one direction the panel
 * calls a loopback port the browser will not let it reach, and in the other it
 * calls a dev server that forwards nothing and answers 404 to every request.
 */

import { describe, expect, it, vi } from "vitest";
import { devProxyTarget, panelApiBaseUrl } from "../src/config/devProxy";
import { ApiClient } from "../src/services/apiClient";

describe("devProxyTarget", () => {
  it("forwards to a plain HTTP loopback backend", () => {
    expect(devProxyTarget("http://127.0.0.1:4000")).toBe("http://127.0.0.1:4000");
    expect(devProxyTarget("http://localhost:4000")).toBe("http://localhost:4000");
    expect(devProxyTarget("http://[::1]:4000")).toBe("http://[::1]:4000");
  });

  it("returns the origin only, so a base ending in /api is not forwarded twice", () => {
    expect(devProxyTarget("http://127.0.0.1:4000/api/")).toBe("http://127.0.0.1:4000");
  });

  it("does not proxy a host the panel can reach directly", () => {
    expect(devProxyTarget("https://api.memberframe.framefic.com")).toBeNull();
    expect(devProxyTarget("https://127.0.0.1:4000")).toBeNull();
    expect(devProxyTarget("http://192.168.1.20:4000")).toBeNull();
  });

  it("does not proxy when nothing usable is configured", () => {
    expect(devProxyTarget(undefined)).toBeNull();
    expect(devProxyTarget("")).toBeNull();
    expect(devProxyTarget("not a url")).toBeNull();
  });
});

describe("panelApiBaseUrl", () => {
  it("is same-origin while the dev server is forwarding", () => {
    expect(panelApiBaseUrl("http://127.0.0.1:4000", true)).toBe("");
  });

  it("is the configured host otherwise", () => {
    expect(panelApiBaseUrl("https://api.memberframe.framefic.com", false)).toBe(
      "https://api.memberframe.framefic.com"
    );
  });
});

describe("ApiClient with a same-origin base", () => {
  it("requests a root-relative path, which the browser resolves against the panel", async () => {
    let requestedUrl = "";
    const fetchSpy = vi.fn(async (url: string | URL | Request) => {
      requestedUrl = String(url);
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as unknown as typeof fetch;

    const client = new ApiClient({
      getCreatorToken: () => null,
      fetchImpl: fetchSpy,
      baseUrl: panelApiBaseUrl("http://127.0.0.1:4000", true),
    });

    await client.get("/api/site/config", { siteId: "unconfigured" });

    expect(requestedUrl).toBe("/api/site/config?siteId=unconfigured");
  });
});
