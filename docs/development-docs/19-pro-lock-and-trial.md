# Feature: Plugin Billing, Trial, Watermark, and Pro Lock

Technical development specification, user flow, architectural wiring, and testing checklist for MemberFrame's own monetization: the creator's account, the 7-day trial, subscriptions with prorated upgrades, the trial watermark, and the lock when a plan ends.

**PRD reference**: [F19](../memberframe-complete-prd.md) section 8, lines 1260-1290
**Reference implementation**: the BEAF plugin (`BEAF-Framer-Plugin`) and its backend (`Framefic-BEAF-Backend`), copied in structure and flow, with its flaws fixed (section 1.3)
**Status**: in progress
**Tasks**: 4.3, 4.4, 4.6, 4.7 (see [`../IMPLEMENTATION-STATUS.md`](../IMPLEMENTATION-STATUS.md)). 4.5 is deliberately not built (section 1.4)

---

## 1. Overview and Problem Solved

- **Feature Name**: Plugin Billing (account, trial, subscription, watermark, lock)
- **Target Audience**: Framer Creator (pays MemberFrame); Site Visitor (sees the watermark or the lock)
- **Value Proposition**: MemberFrame had no monetization. Anyone who connected could use every feature for free. This adds BEAF's proven model: try everything free for 7 days with a small "Made with Framefic" mark, then subscribe.
- **Priority Tier**: P0: Core MVP

### 1.1. Decisions (product owner, 2026-10-18)

| Topic | Decision |
| :--- | :--- |
| Prices | As BEAF: monthly $4.99, yearly $49.99, lifetime $99.99 capped at `LIFETIME_MAX` (default 20). The yearly saving is computed from the real prices, not hard-coded. Prices come from Stripe price ids in env |
| Trial | 7 days, starts automatically the first time the plugin is used in a project; one per creator account and Framer user, bound to that one project |
| During trial | Every visible canvas component shows BEAF's bottom-right "Made with Framefic" watermark, on the canvas and the published site. Bookmark Button and Bookmarks Tray are excluded |
| When a plan ends | Each component blurs behind an "Upgrade to Pro" card, **and** the server refuses member sign in, checkout, and downloads for that site (402 `license_inactive`) |
| Panel when ended | Locked entirely, as BEAF: only Account and Manage Subscription work |
| Upgrades | Monthly to yearly, and monthly or yearly to lifetime, prorated: the unused part of the current period is credited against the new plan |
| Downgrades | Not allowed, as BEAF (yearly to monthly, or from lifetime) |
| Look | **Revised 2026-10-18:** an exact copy of the BEAF plugin's billing and registration UI, CSS, wording, and flow, so every Framefic plugin bills the same way. Lives in `src/components/billing/` and `src/styles/billing/`, exempt from `lint:design` (design-system.md v0.4.4). The hosted `/auth` page and every email copy BEAF's too. The canvas watermark copies BEAF's exactly |

### 1.2. What already existed

Every canvas component carried the four F19 lines (`IS_LOCKED`, `IS_TRIAL`, `@plugin-lock-state`, `@plugin-trial-state`) set to unlocked, and draft watermark and lock renders that nothing switched on. The generator asserts `LOCK_STATE_SIGNATURE`.

### 1.3. BEAF flaws fixed rather than copied

| BEAF | MemberFrame |
| :--- | :--- |
| Checkout, cancel, change plan, and the billing portal trust any `siteId` with no authentication | Every billing route needs the creator's token and checks the site is theirs |
| Sign-in codes and the auth handoff live in process memory | Both in the database, so a restart or a second server loses nothing |
| A failed trial eligibility check falls through to a "direct insert" and grants a trial anyway | No fallback: ineligible is ineligible |
| `past_due` is paid to the plugin and locked on the live site | One resolution, used by the panel, the components, and the server block |
| `invoice.paid`'s first-purchase branch throws a ReferenceError, so the event is never marked processed | Idempotent by event id, every branch tested |
| Customers get no purchase, renewal, failure, or trial emails | They get all of them (section 2.4) |
| Token in plugin `localStorage` | `framer.setPluginData`, PRD rule S2 |

### 1.4. Deliberately not built

F19's 1-instance limit during the trial (task 4.5). A membership site needs several auth screens and a dashboard, so the limit would make the trial unusable. It can be added later.

---

## 2. User Flows

### 2.1. In-Plugin Flow (Framer Designer)

1. **First open, signed out.** Any click opens the account modal: "Start 7-Day Free Trial" (sign up) or "Sign in with browser". Either opens MemberFrame's sign-in page in a new browser tab.
2. **The browser tab.** Email code sign in, sign up with name, email, password and a confirmation code, password sign in, forgot password, and Google. On success it says "Signed in. Return to Framer" and closes.
3. **Back in the panel.** The plugin has been polling; it receives its token, attaches this Framer project, and the trial starts if the creator is eligible. A sticky banner counts down: "N days left", then `HH:MM:SS` under 24 hours, with Upgrade.
4. **Another project, same account.** "Trial already claimed in {project}. Upgrade to activate this project." The panel is locked.
5. **Trial or plan ended.** A modal that cannot be dismissed: "Your trial has ended", Upgrade now, Log out. Every tab is locked except Account. The Builder's action reads "Upgrade to unlock".
6. **Account.** Avatar with a PRO or TRIAL ring and badge, name, email, Plan Type card with status and Manage Subscription, Personal Info, this project's domains, Sign out.
7. **Manage Subscription.** Monthly/Yearly toggle with the saving badge, plan cards, "or, pay once" and the Lifetime card with spots left. Paying opens Stripe's card form inside the panel. Subscribed: PLAN, STATUS, START, END, RENEWS; Manage billing (Stripe portal), Upgrade plan (with the prorated price shown before confirming), Cancel (reason, confirm, done), Resume while canceling.
8. **Notices.** Payment failed (update card), access ends on {date} (resume), renews on {date} (7 days before a yearly renewal, 3 before a monthly).

### 2.2. Visitor Runtime Flow

1. **Trial.** Every MemberFrame component except the bookmarks shows "Made with Framefic" bottom right, linking to framefic.com.
2. **Paid.** No mark.
3. **Ended.** The component's content is blurred and not clickable, under a card: "Upgrade to Pro. This site's MemberFrame plan has ended." Member sign in, checkout, and downloads are refused by the server, so editing the code file cannot get around it.

### 2.3. Prorated upgrade, worked

Monthly at $4.99, upgraded to yearly on day 10 of a 30-day month: unused credit 4.99 × 20/30 = $3.33, due today $49.99 − $3.33 = **$46.66**, and the new year starts today. To lifetime instead: $99.99 − $3.33 = **$96.66**, and the monthly plan stops at once. Monthly to yearly uses Stripe's own preview and invoice (`proration_behavior: always_invoice`, `billing_cycle_anchor: now`), so the price shown is the price charged; lifetime uses the same formula computed here.

### 2.4. Emails (platform sender)

Trial started; trial ends in 2 days; trial ended; payment receipt (first, renewal, upgrade, lifetime); renewal reminder (7 days before yearly, 3 before monthly); payment failed; subscription cancelled with its end date; plan expired. A short notice also goes to `TEAM_NOTIFICATION_EMAIL`, as BEAF.

---

## 3. Architecture and File Inventory

```
Plugin panel ──Bearer──► /api/connect/*      account handoff, project attach
             ──Bearer──► /api/plugin/*       license, plans, checkout, upgrade, cancel, portal
Hosted page  ──────────► /auth (new tab)     sign up, sign in, code, password, Google
Stripe (platform keys) ► /api/webhooks/platform/stripe
Canvas components ─────► GET /api/license?site=<siteKey>   (public, cached 60s)
Member API routes ─────► requireActiveLicense             (402 license_inactive)
Hourly job ────────────► expire trials, trial and renewal reminders
```

The license belongs to one Framer project (`Site`), as BEAF. The trial belongs to one creator account and one Framer user, bound to the first project.

- **Backend**: `prisma/schema.prisma` (`PluginTrial`, `PluginSubscription`, `PluginPayment`, `PlatformWebhookEvent`, `CreatorAuthHandoff`; `User.avatarUrl`, `User.googleId`); `src/services/license/` (`licenseService`, `trialService`, `proration`, `billingService`, `platformWebhook`, `licenseJobs`); `src/lib/stripeRest.ts`; `src/routes/pluginBilling.ts`, `license.ts`, `creatorAuthPage.ts`; `src/lib/creatorAuthPageHtml.ts`; `src/middleware/license.ts`; mail templates in `src/lib/mailer.ts`.
- **Plugin**: `src/services/licenseService.ts`, `src/hooks/useLicense.ts`, `src/utils/lockPatcher.ts`, `src/components/billing/*` (AuthModal, TrialStatusModal, TrialStickyBanner, WatermarkNotice, ProfilePage, SubscriptionPage, PaymentPlans, PaymentModal, PaymentSuccessModal, billingHelpers), `src/styles/billing/*` (ported from BEAF's CSS), `src/components/account/LicenseProvider.tsx` and `LicenseGate.tsx` (failed payment, canceling, renewing notices); `App.tsx`, `PluginShell.tsx`, `BuilderTab.tsx`, the generator.
- **Canvas**: a shared `// @memberframe-license-start/end` block in MemberAuth (all five auth screens), MemberDashboard, MemberPricing, MeteredPaywall, ProtectedDownload. The bookmark components carry none.

---

## 4. Framer Property Controls Specification

None added. The license is not a creator setting: it is baked into the four F19 lines by `enforceLockState` and confirmed at runtime by `/api/license`.

---

## 5. Data Contracts

```
GET  /api/license?site=<siteKey>                  public
  -> { state: "trial" | "active" | "expired" }

GET  /api/plugin/license?siteId=                  creator
  -> { state: "trial"|"active"|"expired"|"trial_claimed_other_site"|"none", plan, status,
       trialEndsAt, currentPeriodStart, currentPeriodEnd, cancelAtPeriodEnd, startedAt,
       claimedProjectName }
GET  /api/plugin/plans                            creator
  -> { plans: [{ id, amountMinor, currency, interval }], yearlySavingPercent,
       lifetime: { total, remaining }, publishableKey }
POST /api/plugin/checkout { siteId, plan, coupon? }
  -> { clientSecret, mode: "subscription"|"payment", amountDueMinor, creditMinor }
POST /api/plugin/checkout/confirm { siteId, paymentIntentId }
GET  /api/plugin/upgrade-preview?siteId&targetPlan
  -> { creditMinor, amountDueMinor, currency, newPeriodEnd }
POST /api/plugin/upgrade { siteId, targetPlan }   400 downgrade_not_allowed
POST /api/plugin/cancel { siteId, reason }        POST /api/plugin/resume { siteId }
GET  /api/plugin/billing-portal?siteId=  -> { url }

GET  /api/connect/handoff?sessionId=  -> { status: "pending" } | { status: "ready", token, expiresAt, creator }
POST /api/connect/attach-project { framerProjectId, framerUserId, projectName, projectUrl }
  -> { site, settings, settingsVersion, license }
```

License resolution: licensed when the plan is `active`, `past_due` (Stripe still retrying), `canceling` before its period end, or a paid lifetime; or the trial is `trialing` before `endsAt`. Otherwise `expired` if the site ever had a trial or plan, `trial_claimed_other_site` if the owner's trial is bound elsewhere, else `none`.

Environment: `PLATFORM_STRIPE_SECRET_KEY`, `PLATFORM_STRIPE_PUBLISHABLE_KEY`, `PLATFORM_STRIPE_WEBHOOK_SECRET`, `PLATFORM_PRICE_MONTHLY`, `PLATFORM_PRICE_YEARLY`, `PLATFORM_PRICE_LIFETIME`, `LIFETIME_MAX`, `TRIAL_DURATION_DAYS`, `TRIAL_DURATION_MINUTES`, `BILLING_RETURN_URL`, `TEAM_NOTIFICATION_EMAIL`.

### 5.1. The License Push (2026-10-20)

Nothing polls the license. The server tells the open plugin when it changes, and the plugin relocks the canvas.

```
GET /api/plugin/events?siteId=                    creator, text/event-stream
  event: license
  data: { license: <the /api/plugin/license view> }    on open, then on every change
  : ping                                               every 25 seconds
```

- **Backend:** `invalidateLicense(siteId)`, which every change already calls (the trial-end job, billing, the trial start), also calls `emitLicenseChanged` (`services/license/licenseEvents.ts`). Each open stream sends the fresh license. Each stream also reads the license itself once a minute and sends it only if it changed. That catches a trial ending by date before the hourly license job, and a row edited outside the server (a script, phpMyAdmin). A stream lasts at most an hour, and a creator may hold 5.
- **Plugin:** `services/licenseStream.ts` reads the stream with `fetch`, since `EventSource` cannot send the bearer header. `useLicense` applies each license, and `enforceLockState` rewrites the four baked lines, so every canvas instance remounts locked or unlocked within seconds. Reconnects back off: 2, 5, 15, 60 seconds, then 5 minutes. A stream that ends within 30 seconds counts as a failure, so a proxy that will not hold it never causes a reconnect loop.
- **Canvas components:** ask `/api/license` once on mount, and again only when the tab comes back after ten minutes or more. The old 30 second recheck is gone. The baked state is part of the per-page cache key, so a rewritten component asks afresh.
- **Published site:** one license request per page load. The member API refuses an unlicensed site on its own (`requireActiveLicense`).
- **Deployment:** the proxy in front of the backend must not buffer `text/event-stream`. The route sends `X-Accel-Buffering: no` for nginx. The emitter is in memory, which suits the single process in the Dockerfile; more than one process would need a shared channel such as Redis pub/sub.

---

## 6. Verification and Testing Checklist

- [ ] Trial eligibility across account, Framer user, and project; claimed elsewhere
- [ ] License resolution matrix
- [ ] Proration: the day-10 example, lifetime credit
- [ ] Webhook transitions and idempotency (Stripe mocked)
- [ ] `requireActiveLicense` on the member routes, not on webhooks, preview, or shield
- [ ] Auth handoff single use and expiry
- [ ] Reminders sent once
- [ ] `lockPatcher` leaves a hand-edited file alone
- [ ] Countdown switches format at exactly 24 hours
- [ ] License block parity; watermark markup; bookmarks carry none
- [ ] End to end in Stripe test mode with a Test Clock (trial, expiry, subscribe, day-10 upgrade, cancel, resume, failed card, renewal reminder)

---

## 7. Build Log

Built in phases; each records what landed and what was verified.

### 2026-10-18: built, all six phases

- **Backend**: migration `20261018000000_plugin_billing` (additive: five tables, three nullable `users` columns), applied to the dev database with `prisma db execute`, since that database predates `migrate`. License resolution, trial, proration, Stripe billing, platform webhook, hourly job, emails, the hosted page, `/api/license`, `/api/plugin/*`, and `requireActiveLicense` on the member, checkout, and asset routes. `verifyConnect` was split into `consumeCreatorCode`, `findOrCreateCreator`, `attachProject`, and `issueCreatorSession`, unchanged in behaviour; the old `/api/connect/start` and `/verify` still work.
- **Plugin**: the Account tab is now sign in (new tab, polling), profile, and Manage subscription; every other tab is the sign in when signed out and the lock screen when the plan has ended; one license notice above the tabs. `enforceLockState` rewrites deployed files when the license changes, and the generator bakes the state into new files. Kit gained `Modal` (design-system.md v0.4.3). Stripe Elements: `@stripe/stripe-js`, `@stripe/react-stripe-js`.
- **Canvas**: one byte-identical license block in MemberAuth (all five screens), MemberDashboard, MemberPricing, MeteredPaywall, ProtectedDownload; BEAF's watermark markup and colours as CSS classes, with a dark backing so it reads on a light card; the lock is a blurred cover with a card that shrinks to one line on a small component. Bookmarks carry no license render.
- **Verified**: plugin lint, design lint, tsc, 880 tests, build; backend tsc, 443 tests; the dev server serves `/auth`, `/api/license`, and `/api/connect/handoff`.
- **Not verified**: a real Stripe payment, upgrade, or webhook (needs the `PLATFORM_*` keys and `stripe listen`); the screens rendered in Framer; Google sign in (needs `CREATOR_GOOGLE_*`).
- **Existing development sites**: with no trial yet they resolve `expired` and their member API answers 402 until the plugin is opened and signed in; set `LICENSE_ENFORCEMENT=false` to work on them without that.

### 2026-10-18: billing UI rebuilt as an exact BEAF clone

The product owner asked for BEAF's billing and registration screens and flow to be copied exactly, as the company-wide standard, rather than restyled in the Pixelfic kit.

- **Plugin**: the kit screens (`account/AccountPage`, `SignInPanel`, `SubscriptionPage`, `PaymentModal`, `LockedScreen`, `styles/account.css`) are removed. In their place are copies of BEAF's AuthModal ("You Get 7-Day Free Trial", waiting state), TrialStatusModal ("You're all set!", "Your trial has ended", "Trial Already Claimed", which only Upgrade or Log out leave), the yellow sticky countdown above the tab bar (days, then "5h 3m 2s" in the last 24 hours), the Builder's watermark notice, Profile (plus this project's site key and allowed domains), Manage Subscription, the plan cards, Stripe Elements with the coupon, Confirm Plan Change with the credit and amount due, and the 3-step cancel. As in BEAF, any click while signed out opens the sign up modal. The one change is that Profile's own Sign In button opens Sign In. BEAF's inline styles became classes in `styles/billing/components.css` (`lint:css` still applies). Clashing class names were prefixed with `beaf-`. `PluginShell` gained `topBanner` and `flush`.
- **Backend**: `/auth` and `/auth/success` are BEAF's `authPage.js` markup and CSS, with Sign In and Sign Up tabs, code, password, forgot password, and Google. `/api/account/code|verify|login` follow BEAF's answers: 409 when signing up with an existing email, 404 when signing in with an unknown email. `POST /api/plugin/apply-coupon` applies a coupon after checkout has started, as BEAF does. Every customer email uses BEAF's signup-mail design (`lib/frameficMail.ts`, with cid images from `assets/`), and team notices use BEAF's team-mail design.
- **Verified**: plugin lint:css, lint:design, tsc, 884 tests, build; backend tsc, 451 tests.
- **Not verified**: the screens rendered inside Framer, a real Stripe payment, and Google sign in. These need the `PLATFORM_STRIPE_*` and `CREATOR_GOOGLE_*` keys.

### 2026-10-19: signed out shows Home; Google on the account page

- **Plugin**: signed out, the panel shows Home, and Home works. Every other tab, the account icon, and Home's shortcuts open "You Get 7-Day Free Trial" instead of navigating. This replaces the catch-every-click capture. Home's banner now reads "Try MemberFrame free for 7 days" with a **Start free trial** action. The stored tab is kept, so signing in returns the creator to where they were.
- **Backend**: `/auth` shows **Sign up with Google** / **Continue with Google** whenever Google can be used. With `CREATOR_GOOGLE_CLIENT_ID` and `_SECRET` set, the button runs real Google OAuth (redirect URI `{API_BASE_URL}/api/account/google/callback`). Without them, a development server opens BEAF's "Simulate Google Sign In" form, which posts to `POST /api/account/google/mock`. That form signs in as any address typed, so it never runs in production; production without keys hides the button. Real and simulated sign-ins share `finishGoogleSignIn`. A simulated one never sets a Google id.
- **Verified**: plugin lint:css, lint:design, tsc, 884 tests, build; backend tsc, 452 tests.

### 2026-10-19: BEAF's .env names, Stripe price setup, trial testing

- **Env**: every F19 setting also reads the BEAF backend's name: `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_*`, `GOOGLE_CLIENT_*`, `LIFETIME_DEAL_MAX_USERS`. Our own `PLATFORM_` / `CREATOR_` names win when both are set. Example values (`your-...`, `..._here`) count as unset. The `.env` reader now strips an inline ` # comment` from unquoted values; before, `TRIAL_DURATION_MINUTES=10 # testing` made the server refuse to start.
- **`npm run stripe:prices -- --write`**: creates the "MemberFrame Pro" product with three prices (monthly 499, yearly 4999, lifetime 9999, in USD minor units) in the Stripe account behind the key, and writes their ids to `.env`. It is idempotent through lookup keys `memberframe_pro_monthly`, `memberframe_pro_yearly`, `memberframe_lifetime`. It refuses a live key without `--live`.
- **`npm run trial:reset -- <email> [--expire]` / `-- --all`**: forgets a trial, so the next project open starts a fresh one, or ends it now. It refuses in production.
- **Testing the trial end, step by step**:
  1. Set `TRIAL_DURATION_MINUTES=10` and `LICENSE_JOB_SECONDS=60`, and restart the backend.
  2. `npm run trial:reset -- you@example.com`, then open the plugin in a project and sign in. The trial starts at 10 minutes.
  3. Wait, or run `npm run trial:reset -- you@example.com --expire`. Then:
     - The panel shows "Your trial has ended".
     - Components blur within 60 seconds.
     - Member sign in answers 402.
     - Within a minute, the job sends "trial ended" and the team notice.
- **Verified**: backend tsc, 462 tests (new `envBilling.test.ts`). `pluginTrialHandoff.test.ts` now pins the 7-day default, since it read the developer's `.env`.
