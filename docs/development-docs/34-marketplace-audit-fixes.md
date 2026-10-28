# Feature: Framer Marketplace Audit Fixes

Change log and development record for the fixes from [`framer-marketplace-audit.md`](../framer-marketplace-audit.md)
(audit of 27 Oct 2026), applied on 28 Oct 2026 to the plugin (`memberframe/`) and the backend
(`memberframe-backend/`).

**PRD reference**: section 14 (security), section 17 row 8 (C27 reversed)
**Status**: awaiting review
**Tasks**: Marketplace pre-flight, before task 8.8 packaging

---

## 1. Overview and Problem Solved

- **Feature Name**: Marketplace pre-flight fixes
- **Target Audience**: Framer Marketplace reviewers, Framer creators
- **Value Proposition**: The audit found 4 items that would get the plugin rejected and 8 that a
  reviewer would question. This change fixes every item that needs code, and writes the reviewer
  pack for the rest. Existing behaviour is kept everywhere else.
- **Priority Tier**: P0, blocks submission

### 1.1. Change Log

| ID | Status | Repo | What changed | Files |
| :--- | :--- | :--- | :--- | :--- |
| C1 | Fixed | Plugin | The creator token moved from shared plugin data to this browser's `localStorage`, keyed by the open project's id. A token left in plugin data by an older version is deleted on first load and never copied. The connection (non-secret ids) stays in plugin data | `src/services/connectionStore.ts`, `src/hooks/useConnection.ts` |
| C2 | Fixed | Plugin | Stripe.js is loaded from the `@stripe/stripe-js/pure` entry through a dynamic import, only when the payment form opens, with `advancedFraudSignals: false`. A failed load now shows the existing "Payment Unavailable" fallback and is retried on the next open | `src/components/billing/PaymentModal.tsx` |
| C3 | Fixed | Plugin | A consent line with a Privacy link sits directly above the sign up and sign in button, and above the new "Link This Project" button | `src/components/billing/AuthModal.tsx`, `src/components/billing/ProfilePage.tsx`, `src/styles/billing/auth-modal.css`, `src/config/branding.ts` |
| C4 | Written; coupon to create | Docs | Reviewer instructions and the data and permissions justification letter. **The Stripe promotion code must still be created by hand** (section 7) | `docs/framer-review-instructions.md`, `docs/framer-data-justification.md` |
| I1 | Fixed | Plugin | Launch no longer links a project or starts a trial on its own. When this browser is signed in but the project has no site, Profile shows "Link This Project" under the consent line, and only that click sends the Framer user id, project name, and domains | `src/hooks/useConnection.ts`, `src/components/billing/ProfilePage.tsx` |
| I2 | Fixed | Plugin | No `window.open` left in the panel. Sign in is a real link to the account page. The billing portal is fetched on the first click, then offered as an "Open billing portal" link; the URL is dropped after use because portal sessions are short lived. `Banner` gained an optional `href` action | `src/components/billing/AuthModal.tsx`, `src/components/account/LicenseGate.tsx`, `src/components/billing/SubscriptionPage.tsx`, `src/components/ui/Banner.tsx`, `src/styles/billing/subscription.css` |
| I3 | Fixed | Plugin | Secret placeholders are plain labels ("Paste the secret key", "Paste the webhook signing secret") and the hidden webhook secret is dots only. Key detection logic is unchanged | `src/components/settings/gatewayKeys.ts`, `src/components/settings/integrationRegistry.ts`, `src/services/paymentsService.ts`, `src/components/settings/WebhooksPanel.tsx` |
| I4 | Fixed | Plugin | Source maps on in the build; `index.html` links `icon.svg` | `vite.config.ts`, `index.html` |
| I5 | Fixed | Backend | Member and creator sessions no longer store an IP address. A migration clears stored values. The columns stay (always null) and are dropped in a later release, so a rollback still finds them. The in-memory rate limiter and the per-request country lookup still read the IP and never store it, as the audit allows | `src/routes/member.ts`, `src/routes/connect.ts`, `src/routes/site.ts`, `src/services/sessionService.ts`, `src/services/creatorAuthService.ts`, `src/services/creatorHandoffService.ts`, `src/services/memberAccessService.ts`, `prisma/schema.prisma`, `prisma/migrations/20261028000000_clear_session_ip/` |
| I6 | Verified and hardened | Plugin | Line audit of every baked value (section 3.2). One hardening: `encodeLiteral` now also escapes U+2028 and U+2029, which reached the Dashboard's headline unescaped. New test feeds hostile text through every generator | `src/services/canvasComponentCodeGenerator.ts`, `test/generatedCodeEscaping.test.ts` |
| I7 | Justified | Docs | No code change. Stated in the justification letter: password sign in exists only on the hosted page | `docs/framer-data-justification.md` |
| I8 | Justified | Docs | No code change. The signup notice is a row in the justification table. **Add the same line to the privacy page** (section 7) | `docs/framer-data-justification.md` |

Records updated: PRD section 17 row 8 (C27 reversed), `IMPLEMENTATION-STATUS.md` C27 row,
`06-connect-and-pages.md` C27 note, and a fix status table at the top of the audit.

---

## 2. User Flows

### 2.1. In-Plugin Flows That Changed

1. **First sign up or sign in.** Account icon, Sign Up or Sign In. The modal shows the consent line,
   then the button, which is now a link that opens the hosted account page. Everything after that is
   unchanged: the panel polls for the hand-off and connects.
2. **Opening a project already used in this browser.** Unchanged: the token is found for this
   project and the panel connects silently, sending only the project id and the token.
3. **Opening a project for the first time after this update.** The token in plugin data is deleted
   and the creator signs in once more. Expected and intended (C1).
4. **A duplicated or remixed project, or a collaborator's browser.** The token is not there, so the
   panel shows Signed Out. The collaborator signs in with their own account.
5. **Signed in, project not linked** (rare after C1, for example a site removed on the server).
   Profile shows the consent line and **Link This Project**. Nothing is sent until the click.
6. **Payment failed banner and Manage Billing.** First click fetches the portal ("Loading"), second
   click opens it as a link.
7. **Upgrade.** Stripe.js loads only when the payment form opens.

### 2.2. Visitor / Member Runtime Flow

No visible change. Member sessions no longer record the visitor's IP address.

---

## 3. Architecture and File Inventory

### 3.1. Token Storage (C1)

- `readLocalToken(projectId)` and `writeLocalToken(projectId, token | null)` wrap `localStorage`
  under `memberframe:creatorToken:<framerProjectId>`, both in `try/catch`.
- `loadStoredConnection(projectId)` now takes the **open** project's id. Keyed by the open project
  rather than the id inside the stored connection, so a duplicated project, which carries the
  original's connection, never finds the original's token even in the same browser.
- `saveConnection` writes the token locally and the connection to plugin data. `clearConnection` and
  `forgetTokenInMemory` (a 401 only) remove the local token. Blocked storage keeps the token in
  memory for the session and sets `storageAvailable()` false, as before.
- The legacy key `memberframe.creatorToken` is only ever written with `null` now.

### 3.2. Generated Code Line Audit (I6)

| Value kind | How it is emitted | Verdict |
| :--- | :--- | :--- |
| Creator text (titles, labels, messages) | `sanitizeText` (single line, length cap) then `encodeLiteral` (`JSON.stringify` plus U+2028 and U+2029 escaped) | Safe |
| Colours | `isSafeCssColor` whitelist (hex, rgb, hsl only), else the default | Safe; nothing reaches `cssContent`, which is a fixed string |
| Paths and URLs | `encodeLiteral`; `isSafeSitePath` where a path is used for navigation | Safe |
| Enums | Checked against the allowed values, else the default | Safe |
| Numbers and booleans | `clampInt`, `clampNumber`, `!== false`, `=== true`; the only raw `${}` interpolations | Safe |
| Tier names in option lists | `sanitizeText` then `encodeLiteral`; keys must match `^[a-z][a-z0-9_]{1,49}$` | Safe |
| Password policy | `readPasswordPolicy` coerces every field to a number or boolean | Safe |

`stripComments` removes whole comment lines only, and every emitted value is one line that starts
with its key, so `/*` or `//` inside a value is never treated as a comment.

### 3.3. Backend Endpoints

No endpoint added or changed. `attach-project` is the same call; only when the plugin makes it moved.

### 3.4. Styling

Two new rules in the BEAF billing stylesheets (`.ffmf-auth-consent`, link variants of the submit
and secondary buttons). No inline styles, no new tokens.

---

## 4. Framer Property Controls Specification

No property control changed.

---

## 5. Data Contracts and Core User Schema

```typescript
// connectionStore.ts
export const LOCAL_TOKEN_PREFIX = "memberframe:creatorToken:";
export function readLocalToken(projectId: string): string | null;
export function writeLocalToken(projectId: string, token: string | null): boolean;
export function loadStoredConnection(projectId: string): Promise<StoredConnection | null>;

// useConnection.ts, ConnectionValue gains:
linkable: boolean;
linkProject: () => Promise<ApiFailure | null>;

// Banner.tsx, the action may be a link:
action?: { label: string; onClick?: () => void; href?: string };
```

---

## 6. Verification and Testing Checklist

- [x] `npm run lint:css`, `npm run lint:design`, `npx tsc --noEmit`, `npm test` (73 files, 1242
      tests), `npm run build`, `npm run check:no-cdn` all pass in `memberframe/`.
- [x] `npm run typecheck`, `npm test` (46 files, 588 tests), `npm run build`, and `prisma validate`
      pass in `memberframe-backend/`.
- [x] Audit re-check commands: `document.referrer` and friends 0; `window.open` only in
      `src/canvas-components/`; secret prefixes 0; `from "@stripe/stripe-js"` value imports 0.
- [x] Build output: the main bundle `dist/index-*.mjs` contains no `js.stripe.com`; Stripe's loader
      is the separate chunk `dist/assets/index-*.js` (source map lists only `stripe-js/dist/pure.mjs`).
- [x] `test/connectionStore.test.ts`: the token never reaches `setPluginData`; a duplicated project and another browser find no token; a legacy plugin data token is deleted, not adopted.
- [x] `test/generatedCodeEscaping.test.ts`: every generator, hostile text in every field, parses with
      no TypeScript syntax error and reads back exactly.
- [ ] Light and dark rendering of the consent line and the Link This Project button (human).
- [ ] Network check in Framer DevTools (human, section 7).

---

## 7. Verified By Whom

The agent cannot see the Framer desktop app, cannot watch its network panel, and cannot create
objects in the live Stripe account. These need a person before submitting:

| Check | How | Expected |
| :--- | :--- | :--- |
| **Create the review coupon (C4)** | Live platform Stripe account, Products, Coupons: 100% off, then a promotion code `FRAMEFIC100MEMBERFRAME`, active | Applying it in the payment form activates a plan with no card |
| Run the reviewer instructions | A teammate follows `framer-review-instructions.md` on a fresh project | Pro unlocked with no card |
| Stripe loads late (C2) | DevTools Network, open the plugin, then Upgrade | No `js.stripe.com` request until the payment form opens |
| Token not shared (C1) | Connect in browser A; open the same project in browser B, or duplicate it | B and the copy show Signed Out |
| Old token cleaned (C1) | Open a project connected before this update | Signed Out once; sign in once; the old key is gone from plugin data |
| Consent line (C3) | Sign Up and Sign In, light and dark | The line and Privacy link are readable above the button |
| Billing portal (I2) | A failed-payment banner, and Manage Billing | First click loads, second opens the portal in the browser |
| Privacy page (I8, C3) | framefic.com/privacy | Exists, and mentions the signup notice to the support inbox. `BRANDING.privacyUrl` is UNCONFIRMED until then (task 8.8) |
| Migration (I5) | Deploy, `node dist/migrate.js` | `ip_address` is NULL in `member_sessions` and `creator_sessions` |
| Packed zip (I4) | `framer plugin pack` or the packaging step | The zip contains the `.map` files |

Verified by: _pending_
