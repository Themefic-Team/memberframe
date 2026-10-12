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

/** PRD section 10.1 names this host and no other. */
export const API_BASE_URL = "https://api.memberframe.framefic.com";

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
