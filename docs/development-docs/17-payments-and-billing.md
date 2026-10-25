# Feature: Payments And Billing

Technical development specification, user flow, architectural wiring, and testing checklist for paid tiers: gateway connection, checkout, subscriptions, the pricing table, and member billing.

**Plan**: [FP-16 Payments & Billing](../features-plan/16.%20Payments%20%26%20Billing.md)
**PRD reference**: F02, F03, F06, F18, sections 10.4, 10.5, 11.3 of [memberframe-complete-prd.md](../memberframe-complete-prd.md); backend PRD phase B3
**Status**: built, 2026-10-16, including the follow-ups in section 7. Not yet run against real gateway accounts (section 6)
**Supersedes**: [03-tri-gateway-payments.md](03-tri-gateway-payments.md), the Phase 1 key vault

---

## 1. Overview and Problem Solved

- **Feature Name**: Payments and Billing
- **Target Audience**: Framer Creator to configure; Site Visitor to buy; Site Member to manage their plan
- **Value Proposition**: A creator sets prices on tiers, connects their own Stripe, Lemon Squeezy, or Razorpay account, and drops one component on a page. Buyers are routed to the gateway that suits their country, pay on the gateway's own page, and are moved to the tier automatically. Money goes straight into the creator's account: MemberFrame adds no fee, and a test in both repositories fails the build if one ever appears.
- **Priority Tier**: P0: Core MVP

---

## 2. User Flows

### 2.1. In-Plugin Configuration Flow (Framer Designer)

1. **Manage, Tiers**: set a monthly, yearly, and or lifetime price on each paid tier. A tier with no price is free.
2. **Manage, Payments, Mode**: Test (the default for every new site) or Live.
3. **Manage, Payments, Gateways**: open a gateway card and paste its keys for the current mode.
   - **Stripe**: the secret key (`sk_test_` or `rk_test_` in Test). MemberFrame registers its webhook with that key; nothing else to set up.
   - **Lemon Squeezy**: API key, Store ID, and the ids of three variants of one product (monthly, yearly, one-time). Each tier is charged its own price on those variants, so one product covers every tier. The webhook is registered automatically.
   - **Razorpay**: Key ID, Key Secret, and a Webhook Secret. Razorpay does not let apps register webhooks, so the card shows the URL and the event list to add in the Razorpay dashboard.
4. **Manage, Payments, Checkout**: default gateway, routing by buyer location, grace period days, the pricing page path, the after purchase path, the default currency.
5. **Builder**: insert **Member Pricing** on the pricing page. Its prices are read live, so changing a price needs no redeploy.
6. Going live: switch Mode to Live. That only shows the live keys: connect at least one gateway there, then press **Go live** in the banner. The server refuses Live until a gateway has live keys and is shown at checkout. Every test purchase stops granting access at that moment. Viewing Test while the site is live offers **Switch to test** the same way.

### 2.2. Visitor / Member Runtime Flow

1. A visitor opens the pricing page. `<MemberPricing>` loads `GET /api/checkout/pricing` and the session in parallel and shows a card per tier, with a Monthly / Yearly switch and the yearly saving.
2. **Signed out**: the button keeps the choice in `sessionStorage` (`memberframe:checkout-intent:<siteKey>`) and goes to the sign up page. After sign up and email confirmation, signing in returns them to the pricing page (MemberAuth reads the same key), and the checkout starts by itself.
3. **Signed in**: `POST /api/checkout/create-session { tierKey, interval, returnPath }`. The server prices it from the tier table, picks the gateway, and returns the gateway's checkout URL (Razorpay: MemberFrame's bridge page, which opens Razorpay Checkout with the UPI QR).
4. The buyer pays. The gateway sends its webhook; MemberFrame verifies it, records it once, and moves the member to the tier.
5. The gateway returns the buyer to `pricing?mf_checkout=<id>`. The component polls `GET /api/checkout/status/:id` for up to 30 seconds, says "You are on Gold", tells the page's other components and the Route Shield that the tier changed, then goes to the after purchase page.
6. **Member Dashboard, Billing**: plan, price, renewal date, Manage billing (Stripe Billing Portal, Lemon Squeezy customer portal, Razorpay subscription link), Cancel plan (at period end, asks first), Resume (Stripe and Lemon Squeezy), payment history with receipts. A failed renewal shows the grace warning with the date access ends.
7. **Member Gate**: a signed-in member on too low a tier gets "Upgrade to unlock", which goes to the pricing page. A signed-out visitor still goes to sign in.

### 2.3. What happens over time

| Event | Result |
| :--- | :--- |
| Paid | Subscription `active`, member on the tier |
| Renewal paid | Period end moves, payment recorded |
| Renewal failed | Subscription `past_due`, member `past_due`, access continues until `now + grace days` |
| Retry paid | Back to `active` |
| Canceled by the member | Subscription `canceling`, member `canceled`, access until the period end |
| Period or grace over | Ended by the gateway's event, or by the 5 minute sweep. Member back to Free |
| New tier bought | A switch: the old recurring subscription is cancelled at the gateway and ended. No proration yet |
| Lifetime refunded in full | Access ends |
| Site switched to live | Every test subscription ends |

A tier granted by hand in Manage, Members is never removed by any of this.

---

## 3. Architecture and File Inventory

### Backend (`memberframe-backend`)

| File | Role |
| :--- | :--- |
| `prisma/schema.prisma`, `migrations/20261016000000_payments` | `payment_settings`, `gateway_configs`, `gateway_prices`, `checkouts`, `subscriptions`, `payments`, `webhook_events` |
| `src/lib/secretBox.ts` | AES-256-GCM for every gateway secret, key from `PAYMENTS_ENCRYPTION_KEY` |
| `src/services/payments/types.ts` | The normalized shapes: `GatewayAdapter`, `PaymentEvent` |
| `src/services/payments/stripe.ts`, `razorpay.ts`, `lemonsqueezy.ts` | One adapter each: connect, price, checkout, webhook verify and parse, portal, cancel |
| `src/services/payments/gatewayStore.ts` | The only file that decrypts a secret. Settings, connect, disconnect, statuses |
| `src/services/payments/gatewayRouter.ts` | Country from CDN headers, India to Razorpay, EU and UK to Lemon Squeezy, else Stripe, with fallbacks |
| `src/services/payments/apply.ts` | The state machine: event to subscription to member tier. The sweep. Ending test purchases |
| `src/services/payments/checkoutService.ts` | Public pricing, checkout creation with lazy price sync, the member's billing actions |
| `src/routes/payments.ts` | Creator routes, member routes, the webhook receiver, the Razorpay bridge page |
| `src/routes/shield.ts` | Applies PRD 11.3: past due within grace and canceled within the period stay entitled |
| `src/services/sessionService.ts` | The session now carries `currentPeriodEnd` and `gracePeriodEndsAt` |

### Plugin (`memberframe`)

| File | Role |
| :--- | :--- |
| `src/services/paymentsService.ts` | API calls, gateway field definitions, plain-language failures |
| `src/components/manage/PaymentsPanel.tsx` | Manage, Payments: mode, gateway cards, checkout settings |
| `src/components/tabs/ManageTab.tsx` | Third segment, Payments |
| `src/canvas-components/MemberPricing.tsx` | The pricing table |
| `src/canvas-components/MemberDashboard.tsx` | Billing section |
| `src/canvas-components/MemberGate.tsx` | Upgrade button to the pricing page |
| `src/canvas-components/MemberAuth.tsx` | Returns a buyer to the pricing page after sign in |
| `src/services/canvasComponentCodeGenerator.ts` | `MEMBER_PRICING_DESCRIPTOR` |
| `src/components/settings/*` | Gateway cards and currency removed from Settings: one place for payments |

### Endpoints

| Method | Path | Who |
| :--- | :--- | :--- |
| GET | `/api/site/payments?siteId=` | Creator |
| PUT | `/api/site/payments/settings` | Creator |
| PUT, DELETE | `/api/site/payments/gateways/:gateway` | Creator |
| GET | `/api/site/payments/members/:memberId` | Creator |
| GET | `/api/checkout/pricing` | Public, site key |
| POST | `/api/checkout/create-session` | Member |
| GET | `/api/checkout/status/:id` | Member who started it |
| GET | `/api/member/billing` | Member |
| POST | `/api/member/billing/portal`, `/cancel`, `/resume` | Member |
| POST | `/api/webhooks/:gateway/:siteId/:mode` | Gateway, signature checked on the raw body |
| GET | `/api/pay/razorpay/:checkoutId` | Buyer's browser |

### Webhook order

Raw body (mounted before the JSON parser), then signature, then a unique insert into `webhook_events` (a duplicate answers 200 and does nothing), then apply. A failure while applying removes the ledger row and answers 500, so the gateway's retry is processed rather than skipped.

### Styling

`MemberPricing` follows the canvas contract: one `cssContent` string, the shared appearance block (byte-identical in all five components and checked by `canvasAppearanceParity.test.ts`), Theme default Light, fixed size. The plugin panel uses kit components only: `Segmented`, `FieldRow` with `hint`, `Badge`, `Banner`, `Button`, and the existing `integration-card` classes.

---

## 4. Framer Property Controls Specification

### Member Pricing

| Control Title | Control Type | Default Value | Description |
| :--- | :--- | :--- | :--- |
| Headline | String | Choose your plan | Above the cards |
| Subheadline | String, text area | Upgrade, switch, or cancel any time. | Under the headline |
| Starts On | Enum, segmented | Monthly | Which side the Monthly / Yearly switch starts on |
| One Time Prices | Boolean | Yes | Show lifetime prices, as their own card or an "Or pay once" link |
| Free Tier Card | Boolean | Yes | Show the free tier, so the table doubles as a sign up page |
| Highlight Tier | String | (empty) | A tier name or key to mark "Most popular" |
| Features | Array of { Tier, Lines } | Free, Silver, Gold, VIP samples | One feature per line, matched to a tier by name or key |
| Sign Up Page | String | the site's sign up page | Where a signed-out buyer makes an account |
| Accent Color | Color | #5271ff | Buttons and highlight |
| Corner Radius | Number | 16px | 0 to 40 |
| Theme, Colors, Typography, Layout, Labels | Shared groups | Light | As on every component; Labels holds every visible string |

### Member Dashboard (added)

| Control Title | Control Type | Default Value | Description |
| :--- | :--- | :--- | :--- |
| Billing | Boolean | Yes | Plan, renewal, manage, cancel (was "Billing Note") |
| Payment History | Boolean | Yes | Past payments with receipts |
| Allow Cancel | Boolean | Yes | Show Cancel plan |

### Member Gate (added)

| Control Title | Control Type | Default Value | Description |
| :--- | :--- | :--- | :--- |
| Pricing Page | String | /pricing | Where "Upgrade to unlock" goes for a signed-in member |

---

## 5. Data Contracts and Core User Schema

```typescript
// GET /api/checkout/pricing
interface PublicPricing {
  mode: "test" | "live";
  pricingPath: string;
  afterPurchasePath: string;
  tiers: Array<{
    key: string; name: string; rank: number; currency: string;
    prices: Record<"month" | "year" | "lifetime", number | null>;     // minor units
    purchasable: Record<"month" | "year" | "lifetime", boolean>;       // a connected gateway can sell it
  }>;
}

// POST /api/checkout/create-session. Nothing else is accepted: no amount, no member id.
interface CreateSessionRequest { tierKey: string; interval: "month" | "year" | "lifetime"; returnPath: string }
interface CreateSessionResponse { url: string; checkoutId: string; gateway: string; mode: string }

// sessionStorage, written by MemberPricing, read by MemberPricing and MemberAuth
interface CheckoutIntent { tierKey: string; interval: string; returnPath: string; ts: number } // 30 minute life

// Every gateway event becomes one of these before anything acts on it
type PaymentAction = "activate" | "renewed" | "payment_failed" | "cancel_scheduled" | "resumed" | "ended" | "refunded";
```

---

## 6. Verification and Testing Checklist

### Automated, passing

- [x] Backend 252 tests: signature verification for all three gateways (good, wrong secret, edited body, stale), event parsing for every handled event in both Stripe API shapes, routing, encryption round trip and tamper refusal, the zero fee scan, and the state machine end to end on an in-memory database (buy, duplicate, switch, renew, fail, grace, cancel, sweep, refund, go live, manual grant kept)
- [x] Shield runs past due and canceled members against their dates
- [x] Plugin 741 tests: the generator, the pricing component's request body (no amount), https-only redirects, storage writes, the MemberAuth hand-off, the payments service
- [x] Zero inline CSS, design lint, both typechecks, both builds

### Human checks, not yet done

- [ ] Stripe test mode end to end on the published site, with `stripe listen --forward-to <api>/api/webhooks/stripe/<siteId>/test` and `STRIPE_CLI_WEBHOOK_SECRET` set, or with a public `API_BASE_URL`
- [ ] Razorpay test mode: UPI `success@razorpay` through the bridge page, webhook added by hand
- [ ] Lemon Squeezy test mode with three variants and `custom_price`
- [ ] Stripe Billing Portal: the creator must save its settings once in the Stripe dashboard (test mode too), or Manage billing does nothing
- [ ] Member Pricing in light and dark, at 360px and desktop widths, in Framer
- [ ] Manage, Payments in both panel themes
- [ ] Contrast of the pricing badge and the test mode pill

### Known limits

- Razorpay sells INR only. A tier without an INR price is sold to Indian buyers through Stripe instead.
- A Lemon Squeezy store sells only in its own currency (read at connect).
- A switch on Lemon Squeezy or Razorpay is a new checkout plus a refund for the unused time, not an in-place change, because neither can change a subscription's price in place for every payment method.
- Webhooks are applied inside the request, not queued; fine at this scale, revisit with a queue.
- The country database (`geoip-country`, GeoLite2) is refreshed by updating the package.

---

## 7. Follow-up, 2026-10-16: the remaining items

### 7.1. Switching plans with credit for unused time

- **Stripe**: changed in place. `changePlan` swaps the subscription item to the new price with `proration_behavior`: `always_invoice` for an upgrade (charged the difference now), `create_prorations` for a downgrade (credit on the next invoice). No checkout page. The member pricing card asks first ("Confirm switch to Gold").
- **Lemon Squeezy and Razorpay**: a new checkout. When it completes, `apply.ts` ends the old plan at the gateway and refunds `unusedCredit`: the last payment times the share of its period still unused. Refunds under 50 minor units are skipped.
- Checkouts now record `amount_minor`, `currency`, and `replaces_subscription_id`.

### 7.2. Prices in more than one currency

- New table `tier_prices` (tier, currency, interval, amount). The tier's own columns stay its base price list.
- **Manage, Tiers**: "Add currency" adds monthly, annual, and lifetime prices in another currency.
- A buyer is shown their country's currency when the tier has prices in it (India INR, eurozone EUR, UK GBP, US USD), otherwise the base currency. Never a conversion.
- Each gateway sells only what it can: Razorpay INR, a Lemon Squeezy store its own currency, Stripe anything. Routing skips a gateway that cannot sell the buyer's currency.

### 7.3. Custom tiers (conflict C9, resolved)

- **Manage, Tiers, Tier type**: the built in four, or "Custom, from the name", which makes a key such as `pro_plus`. Keys are fixed once saved.
- Every Builder and Page Locks deploy writes the site's tiers, by rank and by name, into the gate's Access Tier list (`withSiteTiers`). Tier names are encoded, so a name cannot break the generated file.
- Page Locks offers the site's tiers. The API accepts any tier key on a page lock rule.
- **Bug fixed on the way**: the gate read the session response as if it were the member, but the API sends `{ member, tiers }`, so a signed in member was never let through. It now reads `member` and compares against the site's real ladder from `tiers`, for signed in and signed out answers alike.

### 7.4. Checkout on the creator's page

- **Lemon Squeezy**: checkouts are created with `checkout_options.embed`, and Member Pricing opens them as an overlay through `lemon.js`. `Checkout.Success` starts the same server confirmation as a redirect.
- **Razorpay**: Member Pricing opens Razorpay Checkout itself (UPI QR, cards, net banking) with the order or subscription id the API returns. The bridge page stays as the fallback.
- Either falls back to the hosted page when its script cannot load.

### 7.5. Country routing without a CDN

`resolveCountry`, first match wins: the test override header (test mode only), a CDN header, then the buyer's IP in the bundled GeoLite2 country database. Behind a tunnel in development the forwarded address is used. To try India routing from anywhere in test mode, open the pricing page with `?mf_country=IN`.

`geoip-country` pulled in `ip-address@6` (high advisories, used only by its database update script, never at lookup). An npm `overrides` entry pins `ip-address@^10.7.4`; `npm audit` reports 0.

### 7.6. Sign in provider secrets, encrypted

- Google, GitHub, Apple, and Discord client secrets are sealed in `integration_secrets` (AES-256-GCM, same key as gateways). The settings document keeps the non-secret values and `secretsPresent`.
- Settings responses and connect responses never carry a client secret (`withoutSecrets`).
- An empty secret on a later save keeps the stored one.
- Existing plain text secrets are moved at startup (`migratePlaintextIntegrationSecrets`). On this machine it moved two and left none.

### 7.7. Confirming a purchase without a webhook

Found in testing: a Stripe test purchase was paid, but the pricing page stayed on "Your payment is being confirmed". `API_BASE_URL` was `http://127.0.0.1:4001`, so Stripe had refused to register the webhook, and no event ever arrived. The checkout stayed `open`.

- **Pull on status.** `GET /api/checkout/status/:id` asks the gateway about an open checkout (`confirmCheckout` on each adapter), at most every 2.5 seconds per checkout, and applies the answer through `applyPaymentEvent`, the same path as a webhook. Stripe reads the Checkout Session with its invoice. Razorpay reads the order and its captured payment, or the subscription and its paid invoice. Lemon Squeezy finds the buyer's paid order for the checkout's variant, made no earlier than the checkout, then its subscription and first invoice.
- A webhook that lands later finds the subscription already there and changes nothing. A race between the two ends on the unique key and is ignored.
- Webhooks stay required for renewals, failed payments, and cancels.
- **Webhook address while developing.** When `API_BASE_URL` is a loopback address, outside production, connecting a gateway registers the webhook at the https host the request came through (an ngrok tunnel) instead (`publicApiBase`). Reconnect a gateway after the tunnel address changes.
