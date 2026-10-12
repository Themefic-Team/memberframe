/**
 * The backend API client. PRD task 2.1, PRD section 10.6.
 *
 * Layer 1 of the PRD section 16.1 triad: `fetch` is injected, so the whole
 * module tests in a node environment with no network and no DOM.
 *
 * These tests prove the module maps a status onto a `kind`. They prove nothing
 * about whether the backend returns 403 where the contract says it will, because
 * the backend does not exist (blocker B1). That distinction is worth keeping in
 * mind when reading a green run here.
 */

import { describe, expect, it, vi } from "vitest";
import {
  ApiClient,
  DEFAULT_TIMEOUT_MS,
  buildQuery,
  failureMessage,
  parseRetryAfter,
  type ApiFailure,
} from "../src/services/apiClient";

/** A fetch that answers once with a given status and body. */
function stubFetch(
  status: number,
  body: unknown = {},
  headers: Record<string, string> = {}
): typeof fetch {
  return vi.fn(async () =>
    new Response(status === 204 ? null : JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json", ...headers },
    })
  ) as unknown as typeof fetch;
}

function clientWith(fetchImpl: typeof fetch, token: string | null = null): ApiClient {
  return new ApiClient({
    getCreatorToken: () => token,
    fetchImpl,
    baseUrl: "https://api.test.invalid",
  });
}

describe("the five cases from PRD section 10.6", () => {
  it("maps 200 to ok and hands back the parsed body", async () => {
    const result = await clientWith(stubFetch(200, { members: [] })).get<{ members: [] }>("/x");

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.data).toEqual({ members: [] });
  });

  it("maps 401 to unauthorized", async () => {
    expect((await clientWith(stubFetch(401)).get("/x")).kind).toBe("unauthorized");
  });

  it("maps 403 to forbidden", async () => {
    expect((await clientWith(stubFetch(403)).get("/x")).kind).toBe("forbidden");
  });

  it("maps 429 to rate_limited", async () => {
    expect((await clientWith(stubFetch(429)).get("/x")).kind).toBe("rate_limited");
  });

  it("maps every 5xx to unavailable, carrying the status", async () => {
    for (const status of [500, 502, 503, 504]) {
      const result = await clientWith(stubFetch(status)).get("/x");

      expect(result.kind).toBe("unavailable");
      if (result.kind !== "unavailable") continue;
      expect(result.status).toBe(status);
    }
  });

  it("maps a network rejection to unavailable", async () => {
    const failing = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;

    const result = await clientWith(failing).get("/x");

    expect(result.kind).toBe("unavailable");
    if (result.kind !== "unavailable") return;
    expect(result.status).toBeNull();
    expect(result.detail).toContain("Failed to fetch");
  });
});

describe("statuses the contract does not name fail closed", () => {
  it("treats a 4xx the contract does not list as unavailable, not ok", async () => {
    // 400 and 404 are not in the section 10.6 table. Treating either as a
    // success would hand a caller `undefined` where it expects a member list.
    for (const status of [400, 404, 418]) {
      expect((await clientWith(stubFetch(status)).get("/x")).kind).toBe("unavailable");
    }
  });

  it("treats a 200 carrying invalid JSON as unavailable", async () => {
    const notJson = vi.fn(
      async () => new Response("<html>gateway error</html>", { status: 200 })
    ) as unknown as typeof fetch;

    const result = await clientWith(notJson).get("/x");

    expect(result.kind).toBe("unavailable");
    if (result.kind !== "unavailable") return;
    expect(result.detail).toContain("not valid JSON");
  });

  it("accepts a 204 with no body, which the contract uses for site-info", async () => {
    // PRD section 10.2: POST /api/user/site-info returns 204 No Content.
    // Calling response.json() on it throws, so it has to be handled before.
    const result = await clientWith(stubFetch(204)).post("/api/user/site-info", {});

    expect(result.kind).toBe("ok");
  });

  it("treats a 3xx redirect as unavailable rather than following it blindly", async () => {
    expect((await clientWith(stubFetch(302)).get("/x")).kind).toBe("unavailable");
  });
});

describe("it never retries", () => {
  it("issues exactly one request for each of the five cases", async () => {
    // PRD section 10.6 says no retry storm on 429. This client retries nothing
    // at all, because a retry is only safe when the caller knows the call is
    // idempotent, and POST /api/site/tiers is not.
    for (const status of [200, 401, 403, 429, 500]) {
      const spy = stubFetch(status);
      await clientWith(spy).get("/x");

      expect(spy).toHaveBeenCalledTimes(1);
    }
  });

  it("issues exactly one request when the network rejects", async () => {
    const spy = vi.fn(async () => {
      throw new Error("down");
    }) as unknown as typeof fetch;

    await clientWith(spy).post("/x", {});

    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe("the request it builds", () => {
  it("sends the creator token as a bearer header, never in the URL", async () => {
    const spy = stubFetch(200);
    await clientWith(spy, "tok_abc123").get("/api/site/members", { siteId: "s1" });

    const [url, init] = (spy as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    const headers = (init as RequestInit).headers as Record<string, string>;

    expect(headers.Authorization).toBe("Bearer tok_abc123");
    // A token in a URL lands in server access logs, in browser history, and in
    // any Referer the page later sends.
    expect(String(url)).not.toContain("tok_abc123");
  });

  it("omits the Authorization header entirely when there is no token", async () => {
    const spy = stubFetch(200);
    await clientWith(spy, null).get("/x");

    const init = (spy as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit;

    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it("still sends the request with no token, so the server decides", async () => {
    // Refusing to call without a token would mean the client deciding it is
    // unauthorized, which is the server's answer to give. Conflict C10.
    const spy = stubFetch(401);
    const result = await clientWith(spy, null).get("/api/site/members");

    expect(spy).toHaveBeenCalledTimes(1);
    expect(result.kind).toBe("unauthorized");
  });

  it("sets a JSON content type only when there is a body", async () => {
    const withBody = stubFetch(200);
    await clientWith(withBody).post("/x", { a: 1 });

    const bodyInit = (withBody as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0][1] as RequestInit;
    expect((bodyInit.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
    expect(bodyInit.body).toBe(JSON.stringify({ a: 1 }));

    const withoutBody = stubFetch(200);
    await clientWith(withoutBody).get("/x");

    const getInit = (withoutBody as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0][1] as RequestInit;
    expect((getInit.headers as Record<string, string>)["Content-Type"]).toBeUndefined();
    expect(getInit.body).toBeUndefined();
  });

  it("does not attach browser credentials", async () => {
    // The creator session is a bearer token, not a cookie, so there is no
    // reason to send cookies on a cross-origin request from the panel.
    const spy = stubFetch(200);
    await clientWith(spy).get("/x");

    const init = (spy as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit;
    expect(init.credentials).toBe("omit");
  });
});

describe("buildQuery", () => {
  it("drops undefined, null, and empty values", () => {
    // This is where `?search=undefined` reaches a server otherwise.
    expect(buildQuery({ a: "1", b: undefined, c: null, d: "" })).toBe("?a=1");
  });

  it("returns an empty string rather than a bare question mark", () => {
    expect(buildQuery(undefined)).toBe("");
    expect(buildQuery({})).toBe("");
    expect(buildQuery({ a: undefined })).toBe("");
  });

  it("encodes values that would otherwise break the URL", () => {
    expect(buildQuery({ search: "a b&c=d" })).toBe("?search=a+b%26c%3Dd");
  });

  it("serializes numbers and booleans", () => {
    expect(buildQuery({ page: 2, active: true })).toBe("?page=2&active=true");
  });
});

describe("parseRetryAfter", () => {
  it("reads a plain second count", () => {
    expect(parseRetryAfter("30")).toBe(30);
    expect(parseRetryAfter("0")).toBe(0);
  });

  it("reads an HTTP date and converts it to seconds from now", () => {
    const now = Date.parse("2026-01-01T00:00:00Z");
    expect(parseRetryAfter("Thu, 01 Jan 2026 00:00:45 GMT", now)).toBe(45);
  });

  it("clamps a date already in the past to zero rather than going negative", () => {
    const now = Date.parse("2026-01-01T00:01:00Z");
    expect(parseRetryAfter("Thu, 01 Jan 2026 00:00:00 GMT", now)).toBe(0);
  });

  it("returns null for an absent or unparseable header", () => {
    // A wrong number here produces a countdown that tells the creator a
    // falsehood, so a guess is worse than saying nothing.
    expect(parseRetryAfter(null)).toBeNull();
    expect(parseRetryAfter("")).toBeNull();
    expect(parseRetryAfter("soon")).toBeNull();
    expect(parseRetryAfter("-5")).toBeNull();
  });

  it("surfaces the header through a 429 result", async () => {
    const result = await clientWith(stubFetch(429, {}, { "Retry-After": "12" })).get("/x");

    expect(result.kind).toBe("rate_limited");
    if (result.kind !== "rate_limited") return;
    expect(result.retryAfterSeconds).toBe(12);
  });
});

describe("timeouts", () => {
  it("aborts a request that never settles and reports unavailable", async () => {
    // PRD P1 wants the panel interactive in 1.5 seconds. A hung connection with
    // no deadline is indistinguishable from a slow working one: the spinner
    // never resolves and the creator cannot tell whether waiting will help.
    const hanging = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            const error = new Error("aborted");
            error.name = "AbortError";
            reject(error);
          });
        })
    ) as unknown as typeof fetch;

    const client = new ApiClient({
      getCreatorToken: () => null,
      fetchImpl: hanging,
      baseUrl: "https://api.test.invalid",
      timeoutMs: 10,
    });

    const result = await client.get("/x");

    expect(result.kind).toBe("unavailable");
    if (result.kind !== "unavailable") return;
    expect(result.detail).toContain("timed out");
  });

  it("passes an abort signal on every request", async () => {
    const spy = stubFetch(200);
    await clientWith(spy).get("/x");

    const init = (spy as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit;
    expect(init.signal).toBeDefined();
  });

  it("has a default deadline rather than relying on the caller to set one", () => {
    expect(DEFAULT_TIMEOUT_MS).toBeGreaterThan(0);
    expect(DEFAULT_TIMEOUT_MS).toBeLessThanOrEqual(15000);
  });
});

describe("failureMessage", () => {
  const failures: ReadonlyArray<ApiFailure> = [
    { kind: "unauthorized" },
    { kind: "forbidden" },
    { kind: "rate_limited", retryAfterSeconds: null },
    { kind: "rate_limited", retryAfterSeconds: 30 },
    { kind: "unavailable", status: 500, detail: "Server responded 500." },
  ];

  it("never leaks a kind or a status code into user-facing copy", () => {
    // PRD section 7.6 rule 4: never surface a raw enum value to a user.
    for (const failure of failures) {
      const { title, message } = failureMessage(failure);

      expect(title.length).toBeGreaterThan(0);
      expect(message.endsWith(".")).toBe(true);
      expect(message).not.toContain(failure.kind);
      expect(message).not.toContain("500");
      expect(title).not.toContain("_");
    }
  });

  it("names the wait when the server supplied one", () => {
    expect(failureMessage({ kind: "rate_limited", retryAfterSeconds: 30 }).message).toContain("30");
  });

  it("does not invent a wait when the server supplied none", () => {
    const { message } = failureMessage({ kind: "rate_limited", retryAfterSeconds: null });

    expect(message).toMatch(/moment/i);
    expect(message).not.toMatch(/\d/);
  });
});
