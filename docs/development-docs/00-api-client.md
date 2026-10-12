# Feature: Backend API Client

Technical development specification for the single HTTP boundary between this repository and the backend.

**PRD reference**: sections 10.1, 10.6, no F number
**Status**: in progress
**Tasks**: 2.1 (see [`../IMPLEMENTATION-STATUS.md`](../IMPLEMENTATION-STATUS.md))

Numbered `00-` because it is infrastructure rather than a feature, the same convention as
[`00-plugin-shell.md`](00-plugin-shell.md) and [`00-test-harness.md`](00-test-harness.md). Its ledger row
lists its Feature as "All", and a doc per feature would mean documenting it five times.

---

## 1. Overview and Problem Solved

- **Feature Name**: Backend API Client
- **Target Audience**: every other module in this repository
- **Value Proposition**: PRD section 10.1 draws the line: the backend owns persistence, this repository
  owns "request shapes, error handling, retry, degraded UI". This file is where that ownership lives. One
  place decides what a 429 means, so twenty call sites cannot each decide differently.
- **Priority Tier**: P0: Core MVP

---

## 2. User Flows

### 2.1. In-Plugin Configuration Flow (Framer Designer)

None. The creator never sees this module. They see its consequences: a banner with a retry action when the
server is unreachable, an inline field error when a key is rejected, and a panel that stays usable either
way.

### 2.2. Visitor and Member Runtime Flow

None either, and deliberately. Canvas components cannot import from this repository, so each one carries
its own fetch. `MemberGate.tsx` already does. This client serves the plugin panel only.

That duplication is a real cost and it is the lesser of two. The alternative is bundling a shared client
into every deployed component, which puts this file's bytes on the creator's published page for every
component they insert, against a 40kB per-component budget (PRD P3).

---

## 3. Architecture and File Inventory

- **Plugin UI Components**: none. Consumed by `components/manage/*`, `components/tabs/SettingsTab.tsx`
- **Services**: [`src/services/apiClient.ts`](../../src/services/apiClient.ts),
  [`src/services/checkoutService.ts`](../../src/services/checkoutService.ts)
- **Config**: [`src/config/backend.ts`](../../src/config/backend.ts), which already held the base URL from
  task 1.4
- **Backend API Endpoints**: all of PRD sections 10.2, 10.3, and 10.4 that the panel calls
- **Styling**: none

### 3.1. It Returns A Result, It Does Not Throw

```typescript
export type ApiResult<T> =
  | { kind: "ok"; data: T }
  | { kind: "unauthorized" }
  | { kind: "forbidden" }
  | { kind: "rate_limited"; retryAfterSeconds: number | null }
  | { kind: "unavailable"; status: number | null; detail: string };
```

PRD section 10.6 does not say "handle errors". It names five cases and prescribes a different behaviour for
each, in both the panel and the canvas. A thrown exception collapses all five into one `catch`, and nothing
then tells a developer that the 403 branch was never written.

A discriminated union makes the obligation structural. A `switch` over `kind` that omits a case fails
`tsc --noEmit` the moment the result is consumed exhaustively, which is the only mechanism available that
survives someone forgetting.

The five arms map to section 10.6 one for one, except that the fifth absorbs more than its row:

| Section 10.6 case | `kind` | Also lands here |
| :--- | :--- | :--- |
| `200` | `ok` | |
| `401` | `unauthorized` | |
| `403` | `forbidden` | |
| `429` | `rate_limited` | |
| `5xx` or network failure | `unavailable` | A timeout, a malformed JSON body, a CORS refusal, and every status the contract does not name |

Collapsing those into `unavailable` is the fail-closed reading. "The body was not JSON" and "the server is
down" are the same thing to a caller: entitlement or data could not be established, so show the degraded
state. Splitting them would invite a call site to treat one as recoverable.

### 3.2. No Retries, Anywhere

Section 10.6 says "no retry storm" for the 429 row. This client goes further and retries nothing at all.

A retry is a product decision with a blast radius: three gates on a page times three attempts is nine
requests against a rate limit the backend sets per IP. Where a retry is genuinely wanted, the caller owns
it, because only the caller knows whether the operation is idempotent. `POST /api/site/tiers` is not.

What the client does provide is `retryAfterSeconds`, parsed from the `Retry-After` header when present, so
the UI can say "Try again in 30 seconds" rather than "Too many requests".

### 3.3. Every Request Has A Deadline

`AbortController` with an 8 second default. PRD P1 requires the panel interactive within 1.5 seconds of
open, and a hung connection with no timeout is indistinguishable from a working one that is slow: the
spinner never resolves and the creator cannot tell whether to wait. A timeout becomes `unavailable`, which
has a defined UI.

### 3.4. Creator Authentication Is Not Built, And No Task Builds It

This is the gap that shaped the module's shape, recorded as conflict C10 in section 5.1.

F02 says the creator is "verified via `framer.getCurrentUser()` and `framer.getProjectInfo()`, exchanged
for a creator session token". Every endpoint in PRD section 10.3 needs that token. **No task in the
72-task plan builds the exchange.** Creator identity first appears implicitly at tasks 4.4 and 4.7, in
Phase 2, which is after the Manage tab and the gateway vault that need it in Phase 1.

So the client takes the token as an injected dependency:

```typescript
export interface ApiClientDeps {
  getCreatorToken: () => string | null;
  fetchImpl?: typeof fetch;
  now?: () => number;
}
```

Week 2 wires a provider that returns `null`. Every `/api/site/*` call therefore resolves `unauthorized`,
every consuming surface renders its signed-out state, and nothing silently half works.

The alternative was to invent the storage. That is the part worth refusing: `framer.setPluginData` is not
permitted until task 5.6, which is why the panel keeps its tab and theme in `localStorage`, and a creator
bearer token in `localStorage` is a different proposition from a remembered tab. Deciding that here, in a
task that does not own it, would bury a security decision in an infrastructure file.

### 3.5. The Token Is Never A Query Parameter

It goes in `Authorization: Bearer`. The safety rules in this repository forbid personal or sensitive data
in a URL, and PRD section 10.2's `GET /api/subscription-status?siteId=&userId=&email=` already puts an
email in a query string, which is the backend's contract to answer for. This client will not add to it.

---

## 4. Framer Property Controls Specification

Not applicable. This module deploys nothing to the canvas.

---

## 5. Data Contracts and Core User Schema

### 5.1. Conflicts Found While Building This Module

| # | Conflict | Sources | Resolved as | Needs confirmation |
| :-- | :--- | :--- | :--- | :--- |
| C10 | F02 requires a creator session token for every `/api/site/*` call. No task in the plan builds the token exchange, and creator identity first appears in Phase 2 at tasks 4.4 and 4.7 | PRD section 8 F02 and section 10.3 vs section 15.4 and 15.5 | The client injects `getCreatorToken`, Week 2 supplies `null`, and every affected surface renders its signed-out state. The exchange, and where the token is stored, belong to a task that does not exist yet | **Yes. A task needs adding to Phase 1, or the Manage tab and gateway vault need moving to Phase 2.** This is a schedule defect, not a code defect |
| C11 | PRD section 10.2's `POST /api/auth/send-otp` takes `framerUserId`, `framerSiteName`, and `framerSiteUrl`, which only the plugin can supply, and section 10.2 is headed "serve the plugin panel". Section 10.4, the member runtime endpoints, has no OTP endpoint at all, yet F05 is member sign-in by OTP | PRD section 10.2 vs 10.4 vs section 8 F05 | `<MemberAuth>` calls `POST /api/member/send-otp` and `POST /api/member/verify-otp`, which are **additions to the contract, not quotations from it**. Reusing the section 10.2 pair would make a site visitor send a `framerUserId` they cannot have | **Yes, before the backend routes are written.** Written up in [`05-member-auth.md`](05-member-auth.md) section 5.1 |

### 5.2. Request Helpers

```typescript
function get<T>(path: string, query?: Record<string, string | number | undefined>): Promise<ApiResult<T>>
function post<T>(path: string, body: unknown): Promise<ApiResult<T>>
function patch<T>(path: string, body: unknown): Promise<ApiResult<T>>
```

`query` takes `undefined` values and drops them, so a caller composing an optional filter does not have to
build the string itself. That is where a `search=undefined` reaches a server otherwise.

### 5.3. The Response Is Not Trusted To Be The Response

`response.json()` is typed `Promise<unknown>` here and cast at the boundary, never validated. That is a
deliberate limit and worth naming: this client guarantees the **transport** contract, not the **shape**
contract. A backend that returns `{ members: [] }` where the caller expects an array will typecheck and
then fail at the first property access.

Runtime schema validation is a dependency decision, like `jsdom` was, so it is not smuggled in here.
Blocker B8 records it. In the meantime every consumer treats a successful response defensively, and the
tests assert that a malformed body resolves `unavailable` rather than `ok` with rubbish inside it.

---

## 6. Verification and Testing Checklist

- [x] All five PRD section 10.6 cases produce their own `kind`, asserted per case.
- [x] A malformed JSON body resolves `unavailable`, not `ok`.
- [x] A network rejection resolves `unavailable`.
- [x] A timeout aborts and resolves `unavailable`.
- [x] `Retry-After` is parsed when present and `null` when absent or unparseable.
- [x] No retry is issued for any status, asserted by counting calls to the injected `fetch`.
- [x] The creator token is sent as a bearer header and never as a query parameter.
- [x] An absent token still sends the request, so the server decides, not the client.
- [x] `undefined` query values are dropped rather than serialized.
- [x] `tsc --noEmit` and `npm run build` pass.
- [ ] Any request reaching a real server. The backend does not exist, blocker B1.

---

## 7. Verified By Whom

| Check | Verified by | Date | Evidence |
| :--- | :--- | :--- | :--- |
| A real response from a real backend | | | |
| CORS allows the plugin origin | | | |
| `Retry-After` is actually sent by the server on 429 | | | |
| Automated gates | agent | 2026-10-12 | command output in the commit message |

**None of the five cases has been observed against a server.** They are tested against an injected `fetch`,
which proves this module maps a 403 to `forbidden`, and proves nothing about whether the backend returns
403 where the contract says it will.

---

## 8. Build Decisions

1. **A result union, not exceptions.** Section 3.1. Five prescribed behaviours need five types.
2. **Everything unrecognised fails closed into `unavailable`.** A malformed body is not a special case
   worth its own arm; it is "could not establish state", same as a dead server.
3. **No retries.** Section 3.2. Idempotency is the caller's knowledge, not the client's.
4. **An 8 second deadline on every request.** A hung request and a slow one look identical to a creator.
5. **The token is injected and currently `null`.** Section 3.4. The storage question belongs to the task
   that owns it, and that task does not exist yet, which is the finding.
6. **No runtime schema validation, stated rather than implied.** Section 5.3. The transport contract is
   guaranteed; the shape contract is not.
