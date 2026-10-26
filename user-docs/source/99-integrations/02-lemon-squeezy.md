# Lemon Squeezy

Lemon Squeezy lets your buyers pay by card or PayPal, and it handles sales tax and VAT for you, which makes it a good choice when you sell to the EU, the UK, and worldwide. MemberFrame sets up Lemon Squeezy's webhook for you when you connect.

## Before you start

You need a Lemon Squeezy account with a store. Lemon Squeezy charges in your store's currency, so your MemberFrame site currency must match it.

## Video tutorial

[Add Lemon Squeezy Setup Video Tutorial]

## Step 1: Create one product with three variants

In Lemon Squeezy, create one product for your membership with three variants: a monthly subscription, a yearly subscription, and a single payment. Each tier is charged its own price on these variants, so one product covers every tier you sell.

[Add Lemon Squeezy Variants Screenshot]

## Step 2: Copy your keys and IDs

1. Open **Settings**, then **API**, and create an API key. Make it in the same mode you are connecting, so a test mode key for **Test**.
2. Open **Settings**, then **Stores**, and copy the number next to your store's name. This is your Store ID.
3. Open your product and copy the ID of each of the three variants.

## Step 3: Connect Lemon Squeezy in MemberFrame

In the plugin, click **Manage**, then **Payments**, and check the **Test** or **Live** switch. Click the **Lemon Squeezy** card and fill in the fields.

| Field | What to paste |
| --- | --- |
| **API key** | The API key from **Settings**, **API**. |
| **Store ID** | The number from **Settings**, **Stores**. |
| **Monthly variant** | The ID of the monthly subscription variant. |
| **Yearly variant** | The ID of the yearly subscription variant. |
| **One-time variant** | The ID of the single payment variant, used for lifetime prices. |

Click **Connect Lemon Squeezy**, and the card will show **Connected**.

[Add Lemon Squeezy Popup Screenshot]

## Step 4: Repeat for live payments

When your testing is done, switch to **Live**, create a live API key in Lemon Squeezy, and connect again with your live details. Then click **Go live** in the banner.

## Good to know

- When a member moves to a lower tier, Lemon Squeezy cannot change the price in place, so their plan ends at the end of the period and they are emailed a link to continue on the lower tier.

## Check that it works

Buy a tier on your published site in Test mode using a Lemon Squeezy test card. The member should move to that tier, and the payment should show in **Reports**, **Revenue** with the switch on **Test**.

## What to read next

- [How to take payments](../07-how-to-take-payments.md)
- [Stripe](01-stripe.md)
- [Razorpay](03-razorpay.md)
