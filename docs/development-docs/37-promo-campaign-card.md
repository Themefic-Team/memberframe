# 37. Promo campaign card (Home)

Status: implemented 2026-11-24, awaiting review.

## What it is

The campaign card on the panel's Home tab, the same card Hydra Booking ships
(its `AnnouncementCard`, 2026-11-12): brand blue, an optional "Offer closes in
m:ss" countdown over the title, a one line subtitle, one action button, the
animated gift on the right, and a close button. Same design, same rules, same
env names, so Framefic runs one campaign the same way across plugins.

Every word and every rule comes from the backend's env (`ANNOUNCEMENT_*`).
Changing the offer needs no new plugin build.

## Flow

1. The panel asks `GET /api/plugin/announcement` (public, no token, `no-store`).
   The backend answers `{ campaign }`: one validated object, or `null` when the
   campaign is off or any value does not parse (logged once, the server still
   starts). Nothing is defaulted or invented.
2. The panel shows the card only when the site is in the campaign's audience
   (`ANNOUNCEMENT_SHOW_TO`: `free` = no paid plan, i.e. none, trial, expired;
   or `monthly`, `yearly`, `lifetime`; or `all`). Signed out, there is no
   license, so `free` decides.
3. With a coupon, the first press copies the code and does nothing else. After
   that the button reads `ANNOUNCEMENT_BUTTON_TEXT` and opens the plans
   (Account, Subscription), the same place as Upgrade. Without a coupon it opens
   the plans at once. A blocked clipboard shows the code to select by hand.
4. The creator picks a plan, and in the payment form clicks "Have a coupon
   code?" and pastes the code. That form already calls
   `POST /api/plugin/apply-coupon` (and `checkout` takes `coupon`), which looks
   up an **active Stripe promotion code** with that exact text on MemberFrame's
   own (platform) Stripe account and attaches it to the PaymentIntent or the
   subscription. Stripe applies the discount and any restrictions.

## Stripe, not Paddle

MemberFrame bills through Stripe (19-pro-lock-and-trial.md). Hydra's card text
talks about Paddle discount codes; here the coupon must exist as a **Stripe
Promotion Code** (Dashboard, Product catalog, Coupons, a coupon, then "Add
promotion code") whose customer facing code equals `ANNOUNCEMENT_COUPON_CODE`,
active, and restricted to the plans it is meant for (for "50% off Lifetime",
limit the coupon to the Lifetime product). The env text alone discounts
nothing. The payment form shows the coupon field for Monthly and Lifetime.

## Offer window (browser only)

Kept in the creator's localStorage, one key per account (signed in email, or
`guest`), Framer project, and campaign id; the email and project id are SHA-256
hashes in the key. No database rows. The deadline is absolute, so reloading or
reopening keeps it. Closing the card, or its countdown running out, hides it for
seven days on that site, or until a running trial ends if that comes first. A
new `ANNOUNCEMENT_CAMPAIGN_ID` starts a fresh window everywhere. The countdown
hides the card only; the discount ends only when Stripe ends it (expire or
deactivate the promotion code).

## Env (memberframe-backend)

| Name | Meaning |
| --- | --- |
| `ANNOUNCEMENT_ENABLED` | yes/no, true/false. Unset: on |
| `ANNOUNCEMENT_CAMPAIGN_ID` | Required. Letters, digits, `. _ -`, 64 max |
| `ANNOUNCEMENT_TITLE` | Required, 80 characters max |
| `ANNOUNCEMENT_SUBTITLE` | Optional, 160 max |
| `ANNOUNCEMENT_BUTTON_TEXT` | Required, 40 max |
| `ANNOUNCEMENT_COUPON_CODE` | Optional. Letters, digits, `_ -`, 64 max. A Stripe promotion code |
| `ANNOUNCEMENT_COUNTDOWN_ENABLED` | yes/no. Unset: no timer |
| `ANNOUNCEMENT_DURATION_MINUTES` | Required with the countdown, above 0, at most 10080 |
| `ANNOUNCEMENT_COUNTDOWN_VISIBLE_MINUTES` | Optional: timer only in the last minutes |
| `ANNOUNCEMENT_SHOW_TO` | `free`, `monthly`, `yearly`, `lifetime` (comma list) or `all`. Default `free` |

## Files

Backend: `src/config/env.ts` (`announcement`), `src/services/license/announcement.ts`,
`src/routes/pluginAnnouncement.ts` (mounted ahead of the token checked billing
router in `src/app.ts`), `.env.example`, `test/announcement.test.ts`.

Panel: `src/utils/announcementRules.ts`, `src/services/announcementStore.ts`,
`src/services/licenseService.ts` (`fetchAnnouncement`),
`src/hooks/useAnnouncement.ts`, `src/components/home/AnnouncementCard.tsx`,
`src/components/tabs/HomeTab.tsx`, `src/App.tsx`, `src/styles/kit.css`
(`.mf-offer`), `public/announcement-gift.webp` and
`public/announcement-gift-static.webp`, `test/announcement.test.ts`.
