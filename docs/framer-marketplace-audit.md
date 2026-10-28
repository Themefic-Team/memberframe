# MemberFrame Framer Marketplace Audit

Audit date: 27 Oct 2026. Read-only review, no code was changed.

Scope:

- Plugin: `memberframe/` (including the live-site components in `src/canvas-components/`)
- Backend: `memberframe-backend/`
- Standard: Framefic *Framer Marketplace Pre-Flight Master Guide* (12 review areas, automated audits 1 to 7, release checklist sections A to D)

Verdict: **not ready to submit.** 4 items must change, 8 should improve, and the rest pass. The backend is in good shape. The blockers are in the plugin and in the missing reviewer pack.

## Status Legend

| Status | Meaning |
| :--- | :--- |
| Change | Breaks a guide rule. Reviewers will reject or send it back. Fix before submitting. |
| Improve | Allowed, but a likely reviewer question or scanner hit. Fix or justify in writing. |
| Pass | Meets the guide today. Keep it that way. |

## Summary

| ID | Status | Area | Repo | Finding |
| :--- | :--- | :--- | :--- | :--- |
| C1 | Change | 2. Storage | Plugin | Creator login token stored in shared plugin data |
| C2 | Change | 8. Stripe | Plugin | Stripe.js loads at plugin launch, fraud signals on |
| C3 | Change | 1. Data transmission | Plugin | No consent line before account data is sent |
| C4 | Change | 12. Reviewer access | Docs | No review instructions, coupon, or justification letter |
| I1 | Improve | 1. Data transmission | Plugin | `attach-project` can run on launch without a click |
| I2 | Improve | 7. Auth and popups | Plugin | `window.open` used 3 times in the plugin panel |
| I3 | Improve | 8. Secrets scan | Plugin | `sk_live_` and `whsec_` placeholders trip Audit 5 |
| I4 | Improve | 9. Bundle | Plugin | No source maps, no icon link in `index.html` |
| I5 | Improve | 11. Live-site privacy | Backend | IP address stored on every member and creator session |
| I6 | Improve | 4. Code generation | Plugin | Escaping of creator text in generated code not line-audited |
| I7 | Improve | 7. Auth | Backend | Hosted creator sign-in page offers email and password |
| I8 | Improve | 1. Disclosure | Backend | Signup notice emails creator data to a Framefic inbox |

## Change: Must Fix Before Submitting

### C1. Creator Login Token Stored in Shared Plugin Data

- **Area:** 2, Storage. Checklist A, "Shared storage clean".
- **Where:** `src/services/connectionStore.ts`. `TOKEN_KEY = "memberframe.creatorToken"` is written with `framer.setPluginData` through `writeKey`, and read back in `loadStoredConnection`.
- **Why it fails:** plugin data syncs to every collaborator and travels with a duplicated or remixed project. Anyone who can edit the project, or copies it, gets admin access to that site's members, payments and webhooks for up to 30 days. The guide forbids tokens, JWTs and session keys in `setPluginData`. The file's own header already records this as conflict C27.
- **What is already right:** the backend stores only the token hash, expires it after 30 days (`CREATOR_SESSION_TTL_SECONDS`), and revokes it on `POST /api/connect/disconnect`.

**Effective solution (fits the current structure):**

1. Keep `CONNECTION_KEY` in plugin data. The connection holds `siteId`, `siteKey` and `framerProjectId`, which are not secrets.
2. Move only the token to `localStorage`, keyed by project: `memberframe:creatorToken:<framerProjectId>`. Add two small helpers next to `readKey` and `writeKey`, for example `readLocalToken(projectId)` and `writeLocalToken(projectId, token | null)`, each wrapped in `try/catch`.
3. In `loadStoredConnection`, read the connection from plugin data first, then the token from `localStorage` using `connection.framerProjectId`. The in-memory `cachedToken` and `currentCreatorToken()` stay as they are.
4. In `saveConnection`, write the connection to plugin data and the token to `localStorage`. In `clearConnection` and `forgetTokenInMemory`, also remove the `localStorage` entry.
5. One-time cleanup: if `readKey(TOKEN_KEY)` still returns a value, call `writeKey(TOKEN_KEY, null)` and do not copy it into `localStorage`. The creator signs in once more. Copying it would hand the old token to whichever collaborator opens the plugin first.
6. This reverses PRD rule S2, which bans `localStorage`. Per `CLAUDE.md`, record the decision in PRD section 17 next to C27 before coding.

**Done when:** no `setPluginData` call carries the token, and opening the same project in a second browser shows Disconnected.

### C2. Stripe.js Loads at Plugin Launch

- **Area:** 8, Dependencies and Stripe.
- **Where:** `src/components/billing/PaymentModal.tsx`, line 3 (`import { loadStripe } from "@stripe/stripe-js"`) and `stripeFor()` at line 25.
- **Why it fails:** the default `@stripe/stripe-js` entry (4.10.0 installed) injects the `js.stripe.com` script as a side effect of being imported, so Stripe loads every time the plugin opens, not when the creator clicks Upgrade. `stripeFor()` also calls `loadStripe(key)` without `advancedFraudSignals: false`, so Stripe's background tracking runs.
- **What is already right:** `stripePromise` is only requested when `props.isOpen` is true, and `stripeLoadError` already shows a fallback for ad-blockers. Only the import and the options are wrong.

**Effective solution:**

1. Delete the top-level `loadStripe` import. Keep `import type { Stripe, StripeElementsOptions }`, because type imports load nothing.
2. Make `stripeFor()` load the pure entry on demand:

   ```ts
   const stripeFor = (key: string): Promise<Stripe | null> => {
     let found = stripes.get(key);
     if (!found) {
       found = import("@stripe/stripe-js/pure").then(({ loadStripe }) =>
         loadStripe(key, { advancedFraudSignals: false })
       );
       stripes.set(key, found);
     }
     return found;
   };
   ```

3. Keep the existing `stripeLoadError` path. A rejected promise from the dynamic import should set it.

**Done when:** DevTools Network shows no request to `js.stripe.com` until the payment modal opens.

### C3. No Consent Line Before Account Data Is Sent

- **Area:** 1, Data transmission. Checklist A, "Explicit consent on auth".
- **Where:** the Connect tab email step (`src/components/tabs/ConnectTab.tsx`) and the sign-in modal (`src/components/billing/AuthModal.tsx`).
- **Why it fails:** these flows send the creator's email, `framerUserId`, project name and published domains, and start a trial. The guide only allows those fields after a visible disclosure.

**Effective solution:**

1. Add one line directly above the button that sends the code, in both places: "By continuing, you agree to create an account to activate your trial and manage your license." Link "account" or a trailing "Privacy" to the Framefic privacy page.
2. Build it from the kit: a small secondary-text paragraph class in `src/styles/kit.css` (or the existing help-text class), no `style={{ }}`, no new colour literals, so `lint:css` and `lint:design` stay green.
3. Sentence case, no dashes, per `instruction/INSTRUCTION.md`.

**Done when:** the line is visible in light and dark before any request that carries email or project data.

### C4. No Reviewer Submission Pack

- **Area:** 12, Reviewer access. Checklist D.
- **Where:** nothing exists in `docs/`, `docs/qa-review/` or `instruction/`.
- **Why it fails:** reviewers never enter a card. Without a free path they cannot test Pro, and without a justification letter the data fields and the 9 declared permissions go unexplained.
- **What is already right:** the backend applies Stripe promotion codes and activates a 100% plan with no card (`memberframe-backend/src/services/license/billingService.ts`, around line 138).

**Effective solution:**

1. In MemberFrame's live platform Stripe account, create a 100% off promotion code, for example `FRAMEFIC100MEMBERFRAME`. Test it end to end on a fresh Framer project.
2. Add `docs/framer-review-instructions.md`: how to connect, how to apply the coupon, and what to test (insert components, delete a lock and see the confirmation, switch theme, log out).
3. Add `docs/framer-data-justification.md` with the two tables in the appendix of this file: every field sent, and every permission in `framer.json`.

**Done when:** a teammate can unlock Pro with only the instructions file and no card.

## Improve: Fix or Justify

### I1. `attach-project` Can Run on Launch Without a Click

- **Where:** `src/hooks/useConnection.ts`, around line 168, in the launch `useEffect`.
- **Issue:** when a stored token is valid but the project has no site yet, launch calls `attachProject` with `framerUserId`, `projectName` and origins, and starts the trial. The guide allows only `siteId` before a user action.
- **Effective solution:** in that branch, set a new state such as `{ status: "needs_link" }` instead of calling `attachProject`. The Connect tab renders a "Link this project" button under the consent line (C3), which calls the existing `attach` path already used after sign-in (the callback around line 221). After C1 this branch becomes rare, because a token no longer travels with a copied project.

### I2. `window.open` in the Plugin Panel

- **Where:** `src/components/account/LicenseGate.tsx:31`, `src/components/billing/AuthModal.tsx:70`, `src/components/billing/SubscriptionPage.tsx:179`.
- **Issue:** Audit 2 flags `window.open`. Calls made after an `await` also lose the click gesture and may be blocked as popups.
- **Effective solution:**
  - `AuthModal.tsx`: the URL is known up front (`accountPageUrl(...)`), so render an `<a href target="_blank" rel="noopener noreferrer">` styled as the button.
  - `LicenseGate.tsx` and `SubscriptionPage.tsx`: the billing-portal URL comes from `fetchBillingPortal`. Fetch on the first click, store the URL in state, then show an "Open billing portal" link.
  - The `window.open` calls in `src/canvas-components/` run on the published site, not in the plugin. Leave them.

### I3. Secret Placeholders Trip the Secrets Scan

- **Where:** `src/components/settings/gatewayKeys.ts:228` (`sk_live_...`), `src/components/settings/integrationRegistry.ts:161` and `:170`, `src/services/paymentsService.ts:167` (`sk_test_...`), `src/components/settings/WebhooksPanel.tsx:608` (`whsec_••••`).
- **Issue:** these are placeholders, not keys, but Audit 5 and Framer's scanner match the prefixes.
- **Effective solution:** reword to plain labels ("Secret key", "Webhook signing secret") and mask with dots only. Keep any prefix validation in `connectValidation.ts` or the backend, not in display strings.

### I4. No Source Maps, No Icon Link

- **Where:** `vite.config.ts`, `index.html`.
- **Issue:** reviewers review faster with readable source. `index.html` never references `icon.svg`, although `framer.json` declares it.
- **Effective solution:** set `build: { sourcemap: true }` in `vite.config.ts`, and add `<link rel="icon" type="image/svg+xml" href="/icon.svg" />` to `index.html`. Confirm the packed zip contains `.map` files.

### I5. IP Address Stored on Every Session (Backend)

- **Where:** `memberframe-backend/prisma/schema.prisma` (`MemberSession.ipAddress` line 310, `CreatorSession.ipAddress` line 514). Written from `routes/member.ts` (lines 218, 285, 351, 754, 762, 794), `routes/connect.ts` (lines 116, 153) and `routes/site.ts:388`, through `creatorAuthService`, `creatorHandoffService` and `memberAccessService`.
- **Issue:** the guide says never collect visitor IP addresses. The column is marked "diagnostics only" and nothing reads it for authorization.
- **Effective solution:** stop passing `ipAddress` in those calls, keep `userAgent` for the "signed-in devices" list, and add a migration that sets `ip_address` to NULL on both tables. Drop the column in a later release. The in-memory rate limiter in `middleware/rateLimit.ts` keys on IP but never stores it. Leave it.

### I6. Generated Code Escaping Not Line-Audited

- **Where:** `src/services/canvasComponentCodeGenerator.ts` and the `CONFIG` it bakes into each component.
- **Issue:** Area 4 requires that creator-typed strings (labels, paths, colours) cannot break out of the generated `.tsx` or the `cssContent` string. No `eval`, `new Function` or CDN import exists, and remote CSS imports are stripped, but string escaping was not checked line by line.
- **Effective solution:** confirm every baked value goes through `JSON.stringify` (not template interpolation), colours are validated against a colour pattern before reaching CSS, and paths start with `/` or `https://`. Add a unit test in `test/` that feeds `</style>`, a backtick and `${` through the generator and checks the output compiles unchanged.

### I7. Hosted Creator Sign-In Offers a Password (Backend)

- **Where:** `memberframe-backend/src/routes/creatorAccount.ts` (`POST /api/account/login`, password on `/verify`).
- **Issue:** allowed, because the page opens in the browser, not inside the plugin. Reviewers will open it and may ask.
- **Effective solution:** no code change. State it in the justification letter: "Password sign-in exists only on the hosted Framefic page. The plugin itself uses a 6-digit email code or Google."

### I8. Signup Notice to an Internal Inbox (Backend)

- **Where:** `memberframe-backend/src/services/license/licenseMail.ts:172` (`teamNotice`), sent to `TEAM_NOTIFICATION_EMAIL`.
- **Issue:** name, email and project name go to a Framefic inbox on signup and billing events. This is not marketing, but it is undisclosed.
- **Effective solution:** add one row to the data justification table and the privacy page. No code change needed.

## Pass

### Plugin

| Area | What passes |
| :--- | :--- |
| 1. Data transmission | Launch sends only `siteId` and the bearer token. No `document.referrer`, `window.top`, `window.parent` or `ancestorOrigins` (Audit 1: 0 hits). |
| 2. Storage | Plugin-data writes check `isAllowedTo("setPluginData")` and defer until granted. Seal registry and download rules are non-secret and small. |
| 3. HTML sanitization | No `setHTML` anywhere (Audit 4: 0 hits). |
| 4. Code generation | No `eval`, no `new Function`, no CDN imports. `stripRemoteCssImports.ts` removes remote CSS imports. |
| 5. Canvas deletion | Every delete opens `ConfirmDialog` (tiers, locks, custom fields, webhooks, members, payments). `removeNodes` only rolls back copies the plugin itself just made; existing pages are skipped, never overwritten. |
| 6. API gating and errors | `isAllowedTo` before `createCodeFile`, `setFileContent`, page chrome and plugin-data calls. Failures surface as toasts, not a blank panel. |
| 7. Auth | 6-digit email code or Google. No password field inside the plugin. Log out button on Profile. |
| 8. Dependencies | No hardcoded live keys. Publishable key comes from the server. All fonts bundled; `check:no-cdn` gate exists. |
| 10. UI and theme | `data-framer-theme` sync, `.primary-cta`, zero `style={{ }}` (Audit 3 hits are comments only). |
| 11. Live-site privacy | Canvas components check `RenderTarget` and stay idle on the canvas. No fingerprinting, no tracking cookies. The metered paywall counts reads on the member's own device. |

### Backend

| Topic | What passes |
| :--- | :--- |
| Secrets | `.env` is git-ignored and untracked. No hardcoded keys in `src/`. Audit 6 (legacy auth routes): 0 hits. |
| Stripe | Platform publishable key read from env. Webhooks verify the Stripe signature and process each event once. |
| Creator secrets | Gateway keys and SMTP password encrypted with AES-256-GCM (`lib/secretBox.ts`) and never returned to the browser. |
| Sessions and codes | Tokens and codes stored only as hashes. 30-day creator sessions, revocable. OTP attempts capped. |
| Abuse limits | Rate limits on email sends, credential checks, license checks and content routes. |
| Cookies | Member session cookie is auth-only, `SameSite=None; Secure; Partitioned`. No tracking cookie. |
| Geo routing | Country lookup for gateway choice is computed per request and never stored. |
| Logs and egress | No email, token or request body in logs. No analytics or third-party data sharing; outbound calls only to payment gateways, S3 and Google Fonts on the hosted page. |
| Request hygiene | JSON body limit 16 KB, every field validated and length-capped with zod. Avatar upload sniffs the real image type. |

## Known False Positives

When re-running the audits, these hits are expected and fine:

- Audit 2, `confirm(` in `src/canvas-components/MemberPricing.tsx`: a local function, not the browser dialog.
- Audit 2, `window.open` in `src/canvas-components/`: runs on the published site.
- Audit 3, `style={{` in `MemberAuth.tsx`, `InfoTip.tsx`, `SearchSelect.tsx`, `Slider.tsx`: comment lines only.

## Re-Check Commands

Run in `memberframe/` after each fix:

```powershell
$src = Get-ChildItem -Path ./src -Recurse -Include *.ts,*.tsx
$src | Select-String -Pattern "document\.referrer|window\.top|window\.parent|ancestorOrigins"         # expect 0
$src | Select-String -Pattern "(window\.)?(confirm|alert|prompt)\(|window\.open\("                    # expect only canvas-components
$src | Select-String -Pattern "style=\{\{"                                                            # expect only comments
$src | Select-String -Pattern "sk_live_|sk_test_|whsec_|AIzaSy|pk_live_[0-9a-zA-Z]{30,}"              # expect 0 after I3
$src | Select-String -Pattern "from `"@stripe/stripe-js`""                                             # expect 0 after C2
```

Then the project gates from `CLAUDE.md`:

```
npm run lint:css && npm run lint:design && npx tsc --noEmit && npm test && npm run build && npm run check:no-cdn
```

Backend: `npm test` and `npm run typecheck` in `memberframe-backend/`.

## Appendix: Justification Tables for C4

### Data Sent to the Backend

| Field | Source | Sent when | Purpose |
| :--- | :--- | :--- | :--- |
| `siteId` (Framer project id) | `framer.getProjectInfo().id` | Launch and every call | License anchor: which project has a trial or Pro plan |
| Creator bearer token | Issued after the email code | Launch and every call | Authenticates the creator. Hashed server-side, 30-day expiry, revoked on Log out |
| Creator email | Typed by the creator | Connect, after the consent line | Account identity, sign-in codes, receipts and invoices |
| `framerUserId` | `framer.getCurrentUser().id` | Linking a project, on click | One trial per Framer account |
| Creator name, project name | `getCurrentUser().name`, `getProjectInfo().name` | Connect and linking, on click | Names on receipts and plan emails |
| Published origins | `framer.getPublishInfo()` | Linking a project, on click | CORS allowlist for the site's member API |
| Gateway keys and SMTP password | Typed by the creator in Settings | On save | Lets the creator's members pay and receive email. Encrypted, never returned |
| Member email, name, device user agent | Typed by site members | Member sign-in | Membership accounts and the signed-in devices list. No IP after I5 |
| Signup notice | Creator name, email, project name | Account creation and billing events | Internal Framefic support inbox. Never shared or marketed |

### Permissions in `framer.json`

| Permission | Used for |
| :--- | :--- |
| `createCodeFile` | Creates the MemberFrame code components in the project |
| `setCodeFileContent` | Updates those components when settings, tiers or license state change |
| `addComponentInstance` | One-click insertion of a component onto the canvas |
| `createWebPage` | Scaffolds the sign-in and account pages on request. Existing pages are skipped |
| `cloneNode` | Copies the site's header and footer onto a new scaffolded page |
| `setParent` | Places the copied header and footer inside the new page |
| `setAttributes` | Sets layout on copied chrome and tags protected components with their lock id |
| `removeNodes2` | Rolls back a copy the plugin just made when scaffolding fails. Never removes user content |
| `setPluginData` | Stores non-secret project config: connection ids, lock registry, download rules |
