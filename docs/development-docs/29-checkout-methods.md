# Feature: Checkout Methods (Buyer Chooses How To Pay)

The buyer picks how to pay, WooCommerce style. Each connected gateway can be shown at checkout or kept off, and carries its own title and description.

**PRD reference**: F03 (payments), requested by the product owner 2026-10-20
**Status**: awaiting review
**Tasks**: unscheduled

---

## 1. Overview and Problem Solved

- **Feature Name**: Checkout methods
- **Target Audience**: Framer Creator, and the buyer on their site
- **Value Proposition**: The server used to choose the gateway (India Razorpay, EU/UK Lemon Squeezy, else Stripe, then a Default gateway) and the buyer never saw a choice. Every connected gateway was always in use. Now the buyer sees an order summary and the methods that can sell the price, with the one suiting their location preselected, and the creator decides which connected gateways appear.
- **Priority Tier**: P1, Creator Enhancement

### 1.1. Decisions (product owner, 2026-10-20)

| Question | Decision |
| :--- | :--- |
| When does the chooser show | When two or more gateways are shown at checkout (product owner, 2026-10-20, revised twice): every one is listed and can be chosen; MemberFrame never blocks one. Exactly one: no popup, straight into its checkout on the same page |
| A chosen gateway that cannot take the price | It is attempted; the refusal returns `gateway_error` with `detail`, the gateway's own reason. The page says "That payment method could not start", and in Test mode adds the detail. The one MemberFrame check kept: a Lemon Squeezy store in another currency, which would otherwise charge the plan's number in the store's money |
| Where the buyer pays | A new tab, opened inside the Continue click so popup blockers allow it. The pricing page waits up to 20 minutes, confirms through the status poll, and unlocks. Blocked tab: the checkout opens on the page instead |
| In-page checkout | Removed (2026-10-20): no Lemon Squeezy overlay, no Razorpay in-page window. Every gateway opens its own hosted page (Razorpay through MemberFrame's bridge page): in a new tab from the chooser, in the same tab when only one gateway is on. Either returns to the pricing page, which confirms and goes to After purchase |
| Location | Only preselects. It never hides a method (an Indian buyer abroad can still choose Razorpay) |
| Razorpay currency | Any currency. Razorpay refuses one the account cannot take (no International Payments) and the buyer sees "That payment method could not start. Choose another one." |
| Which member paid how | Already recorded on the checkout, subscription, and payment rows; shown in Manage, Members, a member's Purchases |
| Method names | An editable Title and Description per gateway, with defaults |
| Order | Fixed: the method suiting the buyer's location first and preselected, then Stripe, Lemon Squeezy, Razorpay |
| Default gateway, Route by buyer location | Removed. Preselection is always by location; the columns stay, unused |
| Turning a gateway off | Per mode, instant (Toggle). Members already paying through it keep renewing. Not a delete, so no confirm popup. The last enabled gateway cannot be turned off in Live mode |
| A paid member switching tiers | Unchanged: prorated, on the gateway they already pay through, no chooser |

---

## 2. User Flows

### 2.1. In-Plugin Configuration Flow

1. **Manage**, **Payments**: each connected gateway's bar has **Show at checkout** (Toggle). Off shows an **Off** badge.
2. Open a gateway: **Checkout title** and **Checkout description**, saved with **Save labels**.
3. **Checkout Settings** keeps Grace period, Pricing page, After purchase, Site currency.

### 2.2. Buyer Runtime Flow

1. **Get Premium**. Signed out: sign up first, then continue (unchanged).
2. `POST /api/checkout/options { tierKey, interval }`:
   - `{ kind: "change" }`: an in-place switch, straight to `create-session` as before.
   - `{ kind: "choose", summary, methods, recommended }`: no methods, "Payments are not set up yet"; one, straight to checkout; more, the chooser.
3. Chooser: summary (tier, period, price, renewal), a radio list of methods, **Continue to payment**, close by button, backdrop, or Escape.
4. `POST /api/checkout/create-session { ..., gateway }`, then the gateway's page or overlay as before.

---

## 3. Architecture and File Inventory

- **Backend**:
  - `prisma/schema.prisma`: `GatewayConfig.enabled`, `PaymentSettings.methodLabels`. Migration `20261021000000_checkout_methods`.
  - `src/lib/methodLabels.ts`: defaults, limits, `resolveMethodLabels`.
  - `src/services/payments/gatewayStore.ts`: `connectedGateways(..., { enabledOnly })`, `setGatewayEnabled`, `enabled` in the overview.
  - `src/services/payments/gatewayRouter.ts`: `availableMethods`.
  - `src/services/payments/checkoutService.ts`: `checkoutOptions`, `createCheckout` with an optional `gateway`, `purchasable` from enabled gateways.
  - `src/routes/payments.ts`: `POST /checkout/options`, `gateway` on `create-session`, `PUT /site/payments/gateways/:gateway/enabled`, labels on settings.
- **Plugin**: `src/services/paymentsService.ts`, `src/components/manage/PaymentsPanel.tsx`.
- **Canvas**: `src/canvas-components/MemberPricing.tsx`, the chooser and its labels.

---

## 5. Data Contracts

```
POST /api/checkout/options { tierKey, interval }
  -> { kind: "change" }
   | { kind: "choose",
       summary: { tierName, interval, amountMinor, currency },
       methods: [{ gateway, title, description }],
       recommended: gateway | null }

POST /api/checkout/create-session { tierKey, interval, returnPath, gateway? }
  gateway present: must be enabled and able to sell, else 400 method_unavailable

PUT /api/site/payments/gateways/:gateway/enabled { siteId, mode, enabled }
  turning off the last enabled gateway in Live mode: 400 last_live_method

PUT /api/site/payments/settings { ..., methodLabels?: { stripe?: { title, description }, ... } }
```

---

## 7. Verification

See the plan's verification list; recorded here as each item is checked.
