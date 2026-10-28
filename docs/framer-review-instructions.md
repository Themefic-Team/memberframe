# MemberFrame Review Instructions

For the Framer Marketplace review team. Everything below works in a fresh Framer project, with no card.

> **Before submitting (Framefic team only, delete this block when done):** create the promotion code
> `FRAMEFIC100MEMBERFRAME` in MemberFrame's live platform Stripe account (100% off, no expiry, no
> redemption cap or a high one), then run step 3 below end to end on a fresh Framer project. The
> backend looks codes up with `GET /v1/promotion_codes?code=...&active=true`, so the code must be
> active. Audit item C4 in [`framer-marketplace-audit.md`](framer-marketplace-audit.md).

## What MemberFrame Does

MemberFrame adds memberships to a Framer site: member sign in and sign up, a member account page,
pricing tables with checkout, and locks for pages, sections, and downloads. Creators set it up in
the plugin and style the components on the canvas.

## 1. Open the Plugin

1. Open any Framer project and run MemberFrame from the Plugins menu.
2. The panel opens on **Home**. Nothing is sent to MemberFrame's server until you sign in.

## 2. Create an Account and Start the Free Trial

1. Click the **account icon** at the top right of the panel, then **Sign Up**.
2. Read the line above the button: *By continuing, you agree to create an account to activate your
   trial and manage your license.* Click **Start 7-Day Free Trial**.
3. A browser tab opens on MemberFrame's hosted account page. Create the account with a 6-digit
   email code or with Google. (The hosted page also offers a password. That page runs in the browser,
   not in the plugin; the plugin itself never asks for a password.)
4. Return to Framer. The plugin connects on its own within a few seconds and the 7-day trial starts.
   **The trial unlocks every feature**, so this is enough to review the whole plugin.

## 3. Optional: Activate a Paid Plan With the Review Coupon

1. Account icon, **Manage Subscription**, **Upgrade to Pro Plan**.
2. Choose **Lifetime** or **Monthly**. The payment form opens.
3. Click **Have a coupon code?**, enter `FRAMEFIC100MEMBERFRAME`, and click **Apply**.
4. The total becomes $0.00 and the plan activates at once. No card is asked for.

## 4. What to Test

| Area | Steps | Expected |
| :--- | :--- | :--- |
| Setup guide | Home, **Setup guide** | Six steps, each with a check once done, and a progress bar |
| Member pages | **Builder**, Predefined Pages, select the pages, **Create Pages** | Sign in, sign up, reset password, dashboard, and pricing pages are added. Existing pages are skipped, never overwritten |
| Insert a component | **Builder**, pick a component, **Add to canvas** | The component is inserted and styled from Framer's right sidebar |
| Canvas preview | Select the Member Dashboard on the canvas, change **Canvas Preview** in the sidebar | The canvas switches between Overview, Membership, Billing, Bookmarks, Profile, and Security |
| Tiers | **Manage**, **Tiers**, add a tier, then delete it | Deleting opens a confirmation dialog first |
| Page locks | **Settings**, **Page locks**, add a lock, then delete it | Deleting opens a confirmation dialog first |
| Theme | Switch Framer between light and dark | The panel follows Framer's theme |
| Log out | Account icon, **Sign Out** | The panel returns to the signed out state, and the session is revoked on the server |

Connecting a payment gateway (Settings, Integration) needs the creator's own Stripe, Lemon
Squeezy, or Razorpay keys. Stripe test mode keys work; it is not needed to review the plugin.

## 5. Data and Permissions

What the plugin sends, when, and why, and what each permission in `framer.json` is used for:
[`framer-data-justification.md`](framer-data-justification.md).

## Contact

Framefic support: https://framefic.com/support
