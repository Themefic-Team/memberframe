# Stripe

Stripe lets your buyers pay by credit or debit card, Apple Pay, and Google Pay, in over 135 currencies. You only paste one key, because MemberFrame sets up Stripe's webhook for you.

## Before you start

You need a Stripe account. You can connect test keys before your account is fully activated, so you can start testing straight away.

## Video tutorial

[Add Stripe Setup Video Tutorial]

## Step 1: Copy your secret key from Stripe

1. Sign in to your Stripe Dashboard.
2. Turn on **Test mode** in Stripe if you are connecting your test keys.
3. Open **Developers**, then **API keys**.
4. Copy the **Secret key**, which starts with `sk_test_` in test mode and `sk_live_` in live mode. A restricted key, which starts with `rk_`, works too.

[Add Stripe API Keys Screenshot]

## Step 2: Connect Stripe in MemberFrame

In the plugin, click **Manage**, then **Payments**, and check that the switch shows the mode you want, **Test** or **Live**. Click the **Stripe** card, paste the key into **Secret key**, and click **Connect Stripe**.

[Add Stripe Popup Screenshot]

The card will show **Connected**. MemberFrame registers its webhook with Stripe at the same time, so there is nothing else to set up.

## Step 3: Repeat for live payments

When your testing is done, switch to **Live**, copy your live secret key from Stripe, and connect Stripe again. Then click **Go live** in the banner.

## Check that it works

Buy a tier on your published site with Stripe's test card `4242 4242 4242 4242`, any future expiry date, and any security code. The member should move to that tier, and the payment should show in **Reports**, **Revenue** with the switch on **Test**.

## What to read next

- [How to take payments](../07-how-to-take-payments.md)
- [Lemon Squeezy](02-lemon-squeezy.md)
- [Razorpay](03-razorpay.md)
