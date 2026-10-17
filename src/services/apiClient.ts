/**
 * The backend API client. PRD task 2.1, PRD sections 10.1 and 10.6.
 *
 * PRD section 10.1 draws the ownership line: the backend owns persistence, this
 * repository owns "request shapes, error handling, retry, degraded UI". This
 * file is where that ownership lives, so that twenty call sites cannot each
 * decide what a 429 means.
 *
 * ## It returns a result, it does not throw
 *
 * PRD section 10.6 does not say "handle errors". It names five cases and
 * prescribes a different behaviour for each. A thrown exception collapses all
 * five into one `catch`, and nothing then tells anyone that the 403 branch was
 * never written. A discriminated union makes the obligation structural: an
 * exhaustive `switch` that misses a case fails `tsc --noEmit`.
 *
 * ## The backend does not exist
 *
 * Ledger blocker B1. Every function here is written against the contract in PRD
 * section 10 and has never spoken to a server. The tests inject `fetch`, which
 * proves this module maps a 403 to `forbidden`, and proves nothing about whether
 * the backend returns 403 where the contract says it will.
 *
 * ## Creator authentication is not built, and no task builds it
 *
 * Conflict C10, written up in `docs/development-docs/00-api-client.md` section
 * 3.4. The token is injected, Week 2 injects `null`, and every `/api/site/*`
 * call therefore resolves `unauthorized`. Deciding where a creator bearer token
 * is stored is a security decision, and it does not belong in an infrastructure
 * file owned by a task that was not given it.
 */

import { PANEL_API_BASE_URL } from "../config/backend";

/**
 * Every outcome of every call, mapped one for one onto PRD section 10.6.
 *
 * The fifth arm absorbs more than its row: a timeout, a malformed body, a CORS
 * refusal, and any status the contract does not name all land in `unavailable`.
 * That is the fail-closed reading. To a caller, "the body was not JSON" and
 * "the server is down" mean the same thing, which is that state could not be
 * established, so show the degraded UI. Splitting them would invite someone to
 * treat one of them as success.
 */
export type ApiResult<T> =
  | { kind: "ok"; data: T }
  | { kind: "unauthorized" }
  | { kind: "forbidden" }
  | { kind: "rate_limited"; retryAfterSeconds: number | null }
  | {
      kind: "unavailable";
      status: number | null;
      detail: string;
      /** The server's machine-readable reason, when it sent one. Never shown as is. */
      reason?: string;
      /** A message the server wrote for the creator, such as a gateway rejecting a key. */
      message?: string;
    };

/** Every non-ok arm, for a caller that only wants to render a failure. */
export type ApiFailure = Exclude<ApiResult<never>, { kind: "ok" }>;

export interface ApiClientDeps {
  /**
   * The creator session token, or null when there is none.
   *
   * F02 says the creator is "verified via `framer.getCurrentUser()` and
   * `framer.getProjectInfo()`, exchanged for a creator session token". No task
   * in the plan builds that exchange, so this returns null for now and the
   * server decides, which is the correct place for the decision.
   */
  getCreatorToken: () => string | null;
  /** Injected for tests. Production passes nothing and gets the global. */
  fetchImpl?: typeof fetch;
  /** Milliseconds. See `DEFAULT_TIMEOUT_MS`. */
  timeoutMs?: number;
  baseUrl?: string;
}

/**
 * Deadline on every request.
 *
 * PRD P1 requires the panel interactive within 1.5 seconds of opening, and a
 * hung connection with no timeout is indistinguishable from a working one that
 * is merely slow: the spinner never resolves and the creator cannot tell
 * whether waiting will help. A timeout becomes `unavailable`, which has a
 * defined UI.
 */
export const DEFAULT_TIMEOUT_MS = 8000;

export type QueryValue = string | number | boolean | undefined | null;

/**
 * Build a query string, dropping absent values.
 *
 * A caller composing an optional filter should not have to assemble this
 * itself. That is how `?search=undefined` reaches a server.
 */
export function buildQuery(query: Record<string, QueryValue> | undefined): string {
  if (!query) return "";

  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }

  const serialized = params.toString();
  return serialized === "" ? "" : `?${serialized}`;
}

/**
 * `Retry-After` in seconds, or null.
 *
 * The header may be a number of seconds or an HTTP date. Both are parsed, and
 * anything else is null rather than a guess, because a wrong number here
 * produces a countdown that tells the creator a falsehood.
 */
export function parseRetryAfter(header: string | null, nowMs: number = Date.now()): number | null {
  if (!header) return null;

  const trimmed = header.trim();
  if (trimmed === "") return null;

  if (/^\d+$/.test(trimmed)) {
    const seconds = Number.parseInt(trimmed, 10);
    return Number.isFinite(seconds) ? seconds : null;
  }

  // Only the date form is left, and an HTTP date always carries a weekday, a
  // month name, and a zone, so it always contains letters. Requiring one before
  // calling `Date.parse` matters: `Date.parse("-5")` succeeds, lands in the
  // past, and clamps to 0, which would show the creator "try again in 0
  // seconds" for a header that meant nothing at all.
  if (!/[a-zA-Z]/.test(trimmed)) return null;

  const asDate = Date.parse(trimmed);
  if (Number.isNaN(asDate)) return null;

  const seconds = Math.ceil((asDate - nowMs) / 1000);
  return seconds > 0 ? seconds : 0;
}

export class ApiClient {
  private readonly deps: Required<Pick<ApiClientDeps, "getCreatorToken">> & ApiClientDeps;

  constructor(deps: ApiClientDeps) {
    this.deps = deps;
  }

  get<T>(path: string, query?: Record<string, QueryValue>): Promise<ApiResult<T>> {
    return this.request<T>("GET", `${path}${buildQuery(query)}`);
  }

  post<T>(path: string, body?: unknown): Promise<ApiResult<T>> {
    return this.request<T>("POST", path, body);
  }

  /**
   * PUT, for the settings document.
   *
   * Distinct from PATCH because the body is the whole addressable thing rather
   * than a field edit, which is how `PUT /api/site/settings` reads even though
   * the server merges: the client sends a settings document, complete or
   * partial, and gets the stored one back.
   */
  put<T>(path: string, body?: unknown): Promise<ApiResult<T>> {
    return this.request<T>("PUT", path, body);
  }

  patch<T>(path: string, body?: unknown): Promise<ApiResult<T>> {
    return this.request<T>("PATCH", path, body);
  }

  delete<T>(path: string, query?: Record<string, QueryValue>): Promise<ApiResult<T>> {
    return this.request<T>("DELETE", `${path}${buildQuery(query)}`);
  }

  /**
   * POST a file as the raw request body, FP-12. The metadata rides in the
   * query string so the body can be the file alone, streamed to storage by the
   * server. A file takes longer than a JSON call, so the deadline is minutes.
   */
  upload<T>(path: string, query: Record<string, QueryValue>, file: Blob, timeoutMs = 10 * 60 * 1000): Promise<ApiResult<T>> {
    return this.request<T>("POST", `${path}${buildQuery(query)}`, undefined, {
      raw: file,
      contentType: file.type || "application/octet-stream",
      timeoutMs,
    });
  }

  private async request<T>(
    method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
    path: string,
    body?: unknown,
    raw?: { raw: Blob; contentType: string; timeoutMs: number }
  ): Promise<ApiResult<T>> {
    // Empty under `vite dev` with a local backend, which makes the request
    // same-origin for the dev server to forward. See `config/devProxy.ts`.
    const rawBase = this.deps.baseUrl ?? PANEL_API_BASE_URL;
    const base = rawBase.replace(/\/api\/?$/, "").replace(/\/+$/, "");
    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    const doFetch = this.deps.fetchImpl ?? globalThis.fetch;
    const timeoutMs = raw?.timeoutMs ?? this.deps.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    if (typeof doFetch !== "function") {
      return { kind: "unavailable", status: null, detail: "No fetch implementation available." };
    }

    const headers: Record<string, string> = { Accept: "application/json" };

    const token = this.deps.getCreatorToken();
    if (token) {
      // Header, never a query parameter. A token in a URL lands in server logs,
      // in browser history, and in any Referer the page later sends.
      headers.Authorization = `Bearer ${token}`;
    }

    if (raw) {
      headers["Content-Type"] = raw.contentType;
    } else if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;

    try {
      response = await doFetch(`${base}${cleanPath}`, {
        method,
        headers,
        body: raw ? raw.raw : body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
        // The creator session travels as a bearer token, not a cookie, so there
        // is no reason to attach the browser's credentials to a cross-origin
        // request from the panel.
        credentials: "omit",
      });
    } catch (error) {
      const aborted = error instanceof Error && error.name === "AbortError";

      return {
        kind: "unavailable",
        status: null,
        detail: aborted ? `Request timed out after ${timeoutMs}ms.` : describeError(error),
      };
    } finally {
      clearTimeout(timer);
    }

    if (response.status === 401) return { kind: "unauthorized" };
    if (response.status === 403) return { kind: "forbidden" };

    if (response.status === 429) {
      // No retry, here or anywhere. PRD section 10.6 says no retry storm, and a
      // retry is the caller's decision because only the caller knows whether
      // the operation is idempotent. POST /api/site/tiers is not.
      return {
        kind: "rate_limited",
        retryAfterSeconds: parseRetryAfter(response.headers.get("Retry-After")),
      };
    }

    if (!response.ok) {
      // The error body, when there is one, carries a reason and sometimes a
      // message meant for the creator. Read defensively: an error page from a
      // proxy is HTML, and that must not turn into a second failure.
      const errorBody = (await response.json().catch(() => null)) as
        | { reason?: unknown; message?: unknown }
        | null;
      return {
        kind: "unavailable",
        status: response.status,
        detail: `Server responded ${response.status}.`,
        ...(typeof errorBody?.reason === "string" ? { reason: errorBody.reason } : {}),
        ...(typeof errorBody?.message === "string" ? { message: errorBody.message } : {}),
      };
    }

    // 204 and an empty body are legitimate. PRD section 10.2's
    // POST /api/user/site-info returns 204 No Content by contract.
    if (response.status === 204) {
      return { kind: "ok", data: undefined as T };
    }

    try {
      const data = (await response.json()) as T;
      return { kind: "ok", data };
    } catch (error) {
      // A 200 carrying something that is not JSON is not a success. Treating it
      // as one would hand a caller `undefined` where it expects a member list.
      return {
        kind: "unavailable",
        status: response.status,
        detail: `Response was not valid JSON: ${describeError(error)}`,
      };
    }
  }
}

function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Unknown network failure.";
}

/**
 * Plain-language copy for a failure, for a banner or an inline message.
 *
 * PRD section 7.6 rule 4 forbids surfacing a raw value to a user, and `kind` is
 * exactly that. Every path from a failure to the screen goes through here.
 */
export function failureMessage(failure: ApiFailure): { title: string; message: string } {
  switch (failure.kind) {
    case "unauthorized":
      return {
        title: "Not connected",
        message: "MemberFrame is not signed in to your site yet.",
      };
    case "forbidden":
      return {
        title: "Not allowed",
        message: "This account does not have access to that.",
      };
    case "rate_limited":
      return {
        title: "Too many requests",
        message:
          failure.retryAfterSeconds === null
            ? "Wait a moment and try again."
            : `Try again in ${failure.retryAfterSeconds} seconds.`,
      };
    case "unavailable":
      return {
        title: "Cannot reach MemberFrame",
        message: "The server did not respond. Check your connection and try again.",
      };
  }
}

/**
 * The creator session token, or null before the panel is connected.
 *
 * Held here rather than read from the connection store, and the direction of
 * that dependency is the point: `services/connectionStore.ts` imports the
 * `framer` singleton, and this module is imported by tests. A test that
 * transitively loaded `framer` would be posting messages to a parent window
 * that does not exist, which is the rule in `00-test-harness.md` section 8.
 *
 * So the store pushes the token in, and this module never reaches out.
 */
let creatorToken: string | null = null;

/**
 * Set or clear the token for every subsequent request.
 *
 * Called by `connectionStore` after loading stored plugin data, after a
 * successful verify, and with null on disconnect or on a 401.
 */
export function setCreatorToken(token: string | null): void {
  creatorToken = token;
}

/** Exported for tests and for the Connect tab's own status line. */
export function hasCreatorToken(): boolean {
  return creatorToken !== null;
}

/**
 * The client the panel uses.
 *
 * Conflict C10 is now closed: the token is real, issued by
 * `POST /api/connect/verify`, and every `/api/site/*` call carries it. Before
 * a creator connects it is null and those calls resolve `unauthorized`, which
 * is still the correct answer and still what each consuming surface renders.
 */
export const apiClient = new ApiClient({
  getCreatorToken: () => creatorToken,
});
