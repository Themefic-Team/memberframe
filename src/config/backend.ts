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
import { PRODUCTION_API_BASE_URL, isLoopbackUrl } from "./productionApi";

export { PRODUCTION_API_BASE_URL, isLoopbackUrl };

/**
 * The backend the plugin talks to.
 *
 * A production build always uses `PRODUCTION_API_BASE_URL`, and Vite folds the
 * dev branch away, so no `.env` value, loopback fallback, or runtime switch can
 * reach the shipped bundle (Marketplace review problems 2 and 8). Only `vite
 * dev` and the test run read `VITE_API_BASE_URL` / `VITE_APP_BASE_URL`.
 */
export const API_BASE_URL: string = import.meta.env.PROD
  ? PRODUCTION_API_BASE_URL
  : import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_APP_BASE_URL || "http://127.0.0.1:4001";

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
 * The base URL to bake into a generated component.
 *
 * `configured` when it is reachable from the open internet, and
 * `PRODUCTION_API_BASE_URL` when it is a loopback address. Refusing to emit a
 * loopback URL is a guard rather than a preference: a component baked with the
 * developer's `127.0.0.1` works in the panel and fails silently on every
 * published site, with a network error no creator could interpret. Developing
 * against a published site needs a tunnel with a stable HTTPS hostname, which
 * passes through (backend PRD section 9.1).
 *
 * A production build returns the constant before the check, so the loopback
 * hostnames in `isLoopbackUrl` never reach the bundle.
 */
export function deployBaseUrl(configured: string = API_BASE_URL): string {
  if (import.meta.env.PROD) return PRODUCTION_API_BASE_URL;
  return configured && !isLoopbackUrl(configured) ? configured : PRODUCTION_API_BASE_URL;
}
