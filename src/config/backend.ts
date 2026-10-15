/**
 * Backend host configuration. PRD section 10.1.
 *
 * "The base URL is configured in `src/config/backend.ts`, never hardcoded at
 * call sites." The code generator for task 1.4 is a call site: it bakes this
 * value into the canvas component it deploys, because that component runs on a
 * published site and cannot import anything from this repo.
 *
 * This file is listed against task 2.1, which owns `services/apiClient.ts` and
 * the five-case error contract. Only the base URL is declared here. The client
 * itself is still task 2.1's, and nothing in this file issues a request.
 *
 * The backend does not exist yet. PRD section 10.1 puts it in a separate
 * repository and ledger blocker B1 tracks it. So every consumer of this value
 * must already handle a request that fails, which PRD section 10.6 requires
 * anyway.
 */

import { panelApiBaseUrl } from "./devProxy";

const getEnvApiBaseUrl = (): string => {
  if (typeof import.meta !== "undefined") {
    return (
      import.meta.env?.VITE_API_BASE_URL ||
      import.meta.env?.VITE_APP_BASE_URL ||
      ""
    );
  }
  if (typeof process !== "undefined" && process.env) {
    return (
      process.env.VITE_API_BASE_URL ||
      process.env.VITE_APP_BASE_URL ||
      process.env.API_BASE_URL ||
      ""
    );
  }
  return "";
};

const resolvedEnvUrl = getEnvApiBaseUrl();

export const DEFAULT_API_BASE_URL = resolvedEnvUrl || "http://127.0.0.1:4001";
export const LOCAL_DEV_API_BASE_URL = resolvedEnvUrl || "http://127.0.0.1:4001";

/**
 * Backend host configuration.
 * Single source of truth driven directly by VITE_API_BASE_URL / VITE_APP_BASE_URL from .env
 */
export const API_BASE_URL = resolvedEnvUrl || DEFAULT_API_BASE_URL;

/**
 * The base URL for requests the panel itself makes.
 *
 * Identical to `API_BASE_URL` everywhere except under `vite dev` with a plain
 * HTTP loopback backend, where it is empty and the request goes to the panel's
 * own origin for the dev server to forward. `vite.config.ts` sets the flag only
 * when it has actually configured that proxy, and `config/devProxy.ts` explains
 * why the direct request cannot work.
 *
 * The `typeof` guard is for the test run, which uses `vitest.config.ts` and so
 * never defines the flag.
 */
export const PANEL_API_BASE_URL = panelApiBaseUrl(
  API_BASE_URL,
  typeof __MF_DEV_API_PROXY__ !== "undefined" && __MF_DEV_API_PROXY__
);

/**
 * Member runtime endpoints, PRD section 10.4. Paths only: a consumer joins them
 * to `API_BASE_URL`, or, for a canvas component, to the base URL the generator
 * injected.
 */
export const MEMBER_ENDPOINTS = {
  session: "/api/member/session",
} as const;

/**
 * How long a verified session may be reused on a published page.
 *
 * PRD P4: "Session verification cached client-side with a short TTL. No request
 * per gated element." Ten gates on one page must make one request, so the
 * canvas component caches at module scope for this long. A failed verification
 * is cached for the same period, which is also what P4's sibling rule in
 * section 10.6 asks for on a 429: no retry storm.
 */
export const SESSION_CACHE_TTL_MS = 60_000;

/**
 * Is this a URL only the developer's own machine can reach?
 *
 * The distinction matters because two different things want a base URL and
 * they are not the same thing:
 *
 *   - The plugin panel runs on the developer's machine, so `127.0.0.1` is
 *     exactly right for it, which is what `VITE_API_BASE_URL` is for.
 *   - A generated canvas component runs on a creator's PUBLISHED site, on
 *     someone else's browser, which cannot reach the developer's loopback
 *     address at all.
 *
 * Baking the panel's dev URL into a deployed component produces a membership
 * that works perfectly in the panel and fails silently everywhere else, with a
 * network error no creator could interpret. Backend PRD section 9.1 covers the
 * supported way to develop against a published site, which is a tunnel with a
 * stable HTTPS hostname.
 */
export function isLoopbackUrl(value: string): boolean {
  try {
    const host = new URL(value).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host === "::1";
  } catch {
    return false;
  }
}

/**
 * The base URL to bake into a generated component.
 *
 * `API_BASE_URL` when it is reachable from the open internet, and the
 * production default when it is not. Refusing to emit a loopback URL is a
 * guard rather than a preference: the alternative is a component that cannot
 * work and does not say why.
 */
export function deployBaseUrl(configured: string = API_BASE_URL): string {
  return configured || DEFAULT_API_BASE_URL;
}
