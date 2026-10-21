# Feature: Fair Plan Changes (Upgrade Credit, Scheduled Downgrade)

An upgrade costs the new price minus the unused part of the current plan, and a downgrade takes effect at the end of the paid period. The member's billing history shows every plan and payment, with the credit.

**PRD reference**: F03 (payments), F06 (dashboard), requested by the product owner 2026-10-20
**Status**: awaiting review
**Tasks**: unscheduled

---

## 1. Overview and Problem Solved

A member on Standard yearly (100) who moved to Premium yearly (500) a few days later paid the full 500. On Lemon Squeezy and Razorpay, MemberFrame refunded the unused Standard time afterwards, but only when the old payment had been recorded; on Stripe, the in-place change charged the prorated difference and kept the old renewal date. The buyer never saw the credit before paying, and the Dashboard's history listed only payment rows.

### 1.1. Decisions (product owner, 2026-10-20)

| Question | Decision |
| :--- | :--- |
| Upgrade price | New price minus the unused part of the current plan, worked out by `unusedCredit` (days left over days in the period). The new period starts today and renews at the full new price |
| How the credit is given | A one-time discount at checkout on Stripe (a coupon) and Lemon Squeezy (a discount code). Razorpay cannot discount a subscription's first charge: full price, then the credit refunded |
| Downgrade | At the end of the paid period. Nothing is charged or refunded now |
| History | Every plan the member held and every payment, every gateway, with credits |

---

## 2. User Flows

### 2.1. Upgrade

1. Pricing page or Dashboard, a higher plan.
2. The summary shows `Premium 500.00`, `Credit for unused Standard -98.63`, **`Due today 401.37`**, `Then 500.00 every year`.
3. Stripe (same gateway): changed in place with `billing_cycle_anchor: now`, Stripe crediting the unused time itself. Otherwise a checkout with the credit off its first charge (Stripe, Lemon Squeezy), or at full price with the credit refunded after (Razorpay).
4. The old plan ends; its credit is not refunded again when it was given as a discount (`Checkout.creditMinor`).

### 2.2. Downgrade

1. Dashboard, a lower plan: "Switches to Standard on 20 Oct 2027. Nothing is charged today."
2. Stripe: the price changes with `proration_behavior: none`, so the next invoice is the lower price. Razorpay: the plan changes at `cycle_end`. Lemon Squeezy: its API cannot change a custom price, so the plan cancels at period end and the member is emailed a link to continue on the lower plan.
3. `Subscription.scheduledTierKey` and `scheduledInterval` hold it; the popup shows "Changes to Standard on 20 Oct 2027" and **Undo**.
4. On the renewal, the tier switches and the schedule clears.

---

### 2.3. When a Period Ends

| Subscription | What ends or renews it |
| :--- | :--- |
| active (auto-renewing) | The gateway: its renewal, failure, cancel, or expiry event. **Safety net** (`reconcileOverdue`, every sweep): an active plan more than an hour past its period end is checked with the gateway (`syncStatus`) and its answer applied as the webhook would have been. No renewal a day later, or no gateway to ask: the grace period starts |
| canceling (cancelled by the member) | The sweep ends it once its period end has passed; the member drops to Free |
| past_due (renewal failed) | Ended when the grace period runs out |
| scheduled downgrade | Switched on the renewal; on Lemon Squeezy, ended at the period end with an email to continue on the lower plan |

The Dashboard says "Renewal is being processed." for an active plan whose date has passed, never "Renews on" a past date.

## 3. Architecture

- **Backend**: `prisma/schema.prisma` (`Checkout.creditMinor`, `Subscription.scheduledTierKey`, `scheduledInterval`; migration `20261022000000_plan_changes`); `services/payments/prices.ts` (`unusedCredit`, `planChangeCredit`); `checkoutService.ts` (options with credit and kind, upgrade discount, `scheduleDowngrade`, `undoScheduledChange`, billing history); `stripe.ts`, `lemonsqueezy.ts`, `razorpay.ts` (discount, `scheduleChange`, `cancelScheduledChange`); `apply.ts` (no double credit, switch on renewal); `routes/payments.ts` (`POST /api/member/billing/undo-change`).
- **Canvas**: `MemberPricing.tsx` (the breakdown in the chooser), `MemberDashboard.tsx` (breakdown, downgrade note, scheduled change and Undo, history).

## 7. Verification

- [x] Unit: credit amounts and limits; Stripe anchor and coupon; Lemon Squeezy discount; no refund after a discount; downgrade scheduling and the switch on renewal; history.
- [ ] Human, Test mode, each gateway: upgrade a day after buying (Stripe and Lemon Squeezy about 401 charged; Razorpay 500 then about 98.6 refunded); downgrade (nothing charged, change shown, switch at renewal).
