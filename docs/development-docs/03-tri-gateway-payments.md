# Feature: Tri-Gateway Smart Payment Connect

> **Superseded on 2026-10-16** by [17-payments-and-billing.md](17-payments-and-billing.md). Gateway keys moved from Settings to Manage, Payments, with an encrypted store, test and live modes, and all three gateways. Kept for the history of the Phase 1 decisions.

Technical development specification, user flow, architectural wiring, and testing checklist for the gateway key vault and Stripe checkout.

**PRD reference**: [F03](../memberframe-complete-prd.md) section 8
**Status**: in progress
**Tasks**: 2.4, 2.6 (see [`../IMPLEMENTATION-STATUS.md`](../IMPLEMENTATION-STATUS.md))

Phase 1 covers Stripe only. Lemon Squeezy and Razorpay routing arrive at tasks 3.1 to 3.3, and this doc
is written so those tasks extend a table rather than restructure a file.

---

## 1. Overview and Problem Solved

- **Feature Name**: Tri-Gateway Smart Payment Connect
- **Target Audience**: Framer Creator to configure, Site Visitor at checkout
- **Value Proposition**: Thenty and Outseta are Stripe-only, which excludes buyers in India, Southeast
  Asia, and parts of Latin America. A creator here pastes keys for up to three gateways and the routing
  happens without them building anything.
- **Priority Tier**: P0: Core MVP

---

## 2. User Flows

### 2.1. In-Plugin Configuration Flow (Framer Designer)

1. Creator opens Settings and expands the gateway key vault.
2. Creator pastes a key. The field detects which gateway it belongs to from its prefix and shows a
   "Test mode" badge when the key is a test key.
3. A key that fails its shape check shows an inline error under the field, never a banner.
4. Creator clicks "Save settings", the tab's one primary CTA. Keys go to the backend, which validates and
   encrypts them. The field clears and a masked suffix takes its place.

### 2.2. Visitor and Member Runtime Flow

1. Visitor clicks subscribe on a pricing surface.
2. `createCheckoutSession` posts the tier, the interval, and the site to the backend.
3. The backend decides the gateway, server side, and returns a session URL.
4. The visitor is sent to that URL and pays.

Phase 1 implements steps 2 and 4 in this repository. Step 3 is the backend's, and the geolocation routing
in F03's visitor flow is explicitly server side.

---

## 3. Architecture and File Inventory

### 3.1. Files

| Path | Task | Role |
| :--- | :--- | :--- |
| `src/components/tabs/SettingsTab.tsx` | 2.4 | The tab, its sections, and the Save CTA |
| `src/components/settings/GatewayVault.tsx` | 2.4 | The three gateway sections and their fields |
| `src/components/settings/gatewayKeys.ts` | 2.4 | Pure prefix detection, masking, and validation |
| `src/services/siteService.ts` | 2.4 | `POST /api/site/config` and the validate call |
| `src/services/checkoutService.ts` | 2.6 | `POST /api/checkout/create-session` |
| `src/types/site.ts` | 2.4 | `SiteGatewayConfig`, `GatewayId`, `CurrencyCode` |
| `src/styles/settings.css` | 2.4 | Vault sections, key field, masked value, verified state |

### 3.2. A Secret Key Never Rests In This Repository

This is the part of F03 worth being careful about, because the obvious implementation is a security defect
and it would pass every gate.

The panel already uses `localStorage` for the active tab and the theme preference, because
`framer.setPluginData` is not permitted until task 5.6. The temptation is to persist the vault the same
way, so the creator's keys survive a panel reopen. That would put a live Stripe secret key in a
browser-origin store, readable by anything running in that origin, forever.

So, as a rule with no exception in this feature:

- A secret value lives in React state for exactly as long as the creator's unsaved edit lives.
- On a successful save the field is cleared and replaced by the masked suffix the server returns.
- Nothing from the vault is written to `localStorage`, `sessionStorage`, or plugin data.
- No secret is logged, and the masking helper is the only thing that ever renders one.

F03's own acceptance criterion is "a secret key is never present in any client-side response payload",
which is the backend's half. This is the client's half, and the PRD does not state it, so it is stated
here. A test asserts the absence of any storage API in the settings subtree.

### 3.3. Prefix Detection Is A Convenience, Not A Validation

F03 specifies prefix detection: `pk_live_` or `pk_test_` is Stripe, `rzp_live_` or `rzp_test_` is
Razorpay, a store ID plus an API key is Lemon Squeezy.

`detectGateway` implements exactly that and nothing more. It tells the creator which field they have
probably pasted into the wrong box, and it drives the "Test mode" badge. It does **not** decide whether a
key works: only `POST /api/site/gateway/validate` does, which is what F03's step 3 says.

The distinction matters because a client-side regex that claims to validate a key will be wrong for some
real key format eventually, and the creator will be told their working key is invalid. So the shape check
is deliberately loose: non-empty, no whitespace, a plausible minimum length, and a prefix that does not
contradict the field it is in. Anything stricter is the server's call.

Stripe's secret key prefix is worth a note. F03 lists `pk_live_` and `pk_test_` for Stripe, which are
**publishable** key prefixes. Stripe's secret keys begin `sk_` or `rk_`. Conflict C13 in section 5.1.

### 3.4. Test Keys Are Labelled, Loudly

F03 requires that "test keys route to gateway test mode and are clearly labelled in the UI". A creator who
ships a site with test keys takes no money and may not notice for a week.

So a test key shows a `.badge-warning` reading "Test mode" next to the field, and the vault section header
carries the same badge when any key in it is a test key. Warning tone rather than neutral, because this is
a state the creator should want to leave.

### 3.5. There Is No Fee Anywhere

F03's last acceptance criterion: "Zero platform fee is applied on every gateway. No fee line item exists
in the codebase."

That is an unusual criterion in that it is about absence, which makes it testable in an unusual way.
`test/checkoutService.test.ts` scans the service sources for fee-shaped identifiers (`applicationFee`,
`platformFee`, `feePercent`, `transfer_data`, `application_fee_amount`) and fails if any appears. It is a
grep dressed as a test, and it is the only mechanism that will notice when someone adds one in Phase 3.

---

## 4. Framer Property Controls Specification

Not applicable. Neither task deploys a canvas component. The pricing surfaces that call
`createCheckoutSession` are `<MemberGate>`'s upgrade CTA, which is text in Phase 1, and components
authored in later phases.

---

## 5. Data Contracts and Core User Schema

### 5.1. Conflicts Found While Building This Feature

| # | Conflict | Sources | Resolved as | Needs confirmation |
| :-- | :--- | :--- | :--- | :--- |
| C13 | F03's key prefix detection lists `pk_live_` and `pk_test_` as the Stripe markers. Those are Stripe **publishable** key prefixes. A Stripe secret key begins `sk_` or `rk_`, and the vault asks for both a publishable and a secret key | PRD section 8 F03 vs Stripe's documented key formats | `detectGateway` accepts `pk_`, `sk_`, and `rk_` for Stripe and reports which of the two fields a key belongs in, so pasting a secret into the publishable field is caught. The PRD's list is treated as incomplete rather than wrong | No, but the PRD line is worth correcting so the next reader is not misled |
| C14 | `SiteGatewayConfig` has `stripeSecretKeyEncrypted`, `lemonSqueezyApiKeyEncrypted`, and `razorpayKeySecretEncrypted` as optional strings on the same interface the client uses. F03 also says secrets are "never returned to the client, only a masked suffix" | PRD section 8 F03 data contract vs its own acceptance criterion | The client type splits in two. `SiteGatewayConfig` is the write shape and carries plaintext secrets only in the moment of saving. `SiteGatewayStatus` is the read shape and carries masked suffixes and verified flags, with no secret field at all, so there is no client type with a slot for a returned secret | No. The acceptance criterion outranks the illustrative interface |

### 5.2. The Two Shapes

```typescript
/** What the creator is editing. Secrets present, never persisted locally. */
export interface GatewayVaultDraft {
  stripePublishableKey: string;
  stripeSecretKey: string;
  lemonSqueezyStoreId: string;
  lemonSqueezyApiKey: string;
  razorpayKeyId: string;
  razorpayKeySecret: string;
  defaultCurrency: CurrencyCode;
  autoDetectGeolocation: boolean;
}

/** What the server returns. No field can hold a secret. */
export interface SiteGatewayStatus {
  stripe: GatewayKeyStatus;
  lemonsqueezy: GatewayKeyStatus;
  razorpay: GatewayKeyStatus;
  defaultCurrency: CurrencyCode;
  autoDetectGeolocation: boolean;
}

export interface GatewayKeyStatus {
  configured: boolean;
  verified: boolean;
  /** Last four characters only, for example "4242". Never the key. */
  maskedSuffix: string | null;
  mode: "live" | "test" | null;
}
```

### 5.3. Checkout

```typescript
export interface CheckoutRequest {
  tier: TierKey;
  interval: "monthly" | "annual" | "lifetime";
  siteId: string;
  /** ISO 3166-1 alpha-2, when the caller knows it. The server decides regardless. */
  geo?: string;
}

export interface CheckoutSession {
  url: string;
  gateway: GatewayId;
  sessionId: string;
}
```

`interval` includes `lifetime` because PRD section 12.2 lists a lifetime pass and `SiteTierRecord` carries
`lifetimePriceMinor`. F03's request shape names only `{ tier, interval, siteId, geo }` without enumerating
the interval, so this is a reading rather than an addition.

### 5.4. The Returned URL Is Not Trusted

`createCheckoutSession` returns a URL that the caller navigates to. A compromised or buggy backend
returning `javascript:` there would execute in the page.

So the service rejects any session URL that is not `https:`, resolving `unavailable` instead, with the
same reasoning as the redirect sanitizer in task 1.4. The tests cover `javascript:`, `data:`, and plain
`http:`. A payment page over `http:` is refused as well, which is not paranoia: it would be a downgrade on
a checkout flow.

---

## 6. Verification and Testing Checklist

### 6.1. F03 Acceptance Criteria

| PRD criterion | Status | Evidence |
| :--- | :--- | :--- |
| A secret key is never present in any client-side response payload | Agent, partly | The read type has no field that could hold one, so the client cannot store what it is sent. Whether the server sends one is the server's half, and the backend does not exist |
| An invalid key shows an inline field error under the field, not a banner | Agent, partly | `FieldRow` renders the error inline and the validator returns per-field messages. A test asserts no vault path raises a banner for a field error. The render needs a human |
| Test keys route to gateway test mode and are clearly labelled | Agent, partly | `isTestKey` and the "Test mode" badge are tested. Routing to test mode is the gateway's behaviour, given the key |
| With `autoDetectGeolocation` off, all buyers get the `defaultCurrency` gateway | Not reachable | Server-side routing, task 3.3 |
| An Indian IP receives a Razorpay session when a Razorpay key is configured | Not reachable | Server-side routing, tasks 3.2 and 3.3 |
| If the routed gateway has no key, routing falls back to Stripe with a logged warning | Not reachable | Server-side routing, task 3.3 |
| Zero platform fee is applied on every gateway. No fee line item exists in the codebase | Agent, done | `test/checkoutService.test.ts` scans the service sources for fee-shaped identifiers |

Three of the seven criteria are server-side behaviours that this repository cannot implement or observe.
They are marked "not reachable" rather than failed, and they belong to tasks 3.2 and 3.3.

### 6.2. Standing Checklist

- [x] Zero inline CSS compliance verified (`npm run lint:css`).
- [x] `tsc --noEmit` and `npm run build` pass.
- [x] No storage API appears anywhere in the settings subtree, asserted by test.
- [x] No fee identifier appears anywhere in the services, asserted by test.
- [x] A non-https checkout URL is refused, asserted by test.
- [x] Exactly one `.primary-cta` in the Settings tab, and it is "Save settings".
- [ ] Light and dark colour contrast verified.
- [ ] A real key validated against a real gateway. Blockers B1 and the gateway accounts.

---

## 7. Verified By Whom

| Check | Verified by | Date | Evidence |
| :--- | :--- | :--- | :--- |
| A real Stripe test key validates and shows verified | | | |
| A real Stripe checkout session completes in sandbox | | | |
| An invalid key shows its error inline, under the field | | | |
| The "Test mode" badge is noticeable enough to act on | | | |
| No secret appears in devtools storage after a save | | | |
| Light and dark contrast at WCAG AA | | | |
| Automated gates | agent | 2026-10-12 | command output in the commit message |

The fifth row is the one to actually perform. The agent can prove no storage call exists in the source; it
cannot prove the browser holds nothing after a real save.

---

## 8. Build Decisions

1. **No secret is ever persisted client side.** Section 3.2. Not `localStorage`, not plugin data, not a
   module variable that outlives the edit. The PRD does not say this; it follows from S1 and it is the one
   decision in this feature that could quietly become a breach.
2. **The read type has no field that can hold a secret.** Section 5.2. A type that cannot represent the
   mistake is better than a convention against making it.
3. **Prefix detection guides, it does not validate.** Section 3.3. A client-side regex that rejects a
   working key is worse than one that accepts a broken one, because the server catches the second.
4. **The PRD's Stripe prefix list is treated as incomplete.** Section 5.1 C13. `sk_` and `rk_` are
   accepted, and a secret pasted into the publishable field is caught by field, not by validity.
5. **Test mode is a warning, not a note.** Section 3.4. It is a state the creator should want to leave.
6. **A checkout URL must be https.** Section 5.4. The service refuses `javascript:`, `data:`, and `http:`.
7. **The absence of fees is asserted by a test that scans source.** Section 3.5. An acceptance criterion
   about absence needs a check that fires when someone adds the thing.
