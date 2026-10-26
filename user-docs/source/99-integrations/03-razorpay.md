# Razorpay

Razorpay lets buyers in India pay with UPI, cards, net banking, and wallets. It sells in Indian rupees (INR) only, so your MemberFrame site currency must be INR for Razorpay to show at checkout. Unlike Stripe and Lemon Squeezy, Razorpay's webhook is one you add yourself, which takes a minute.

## Before you start

You need a Razorpay account, and your site currency set to INR in **Manage**, **Payments**, under **Checkout Settings**.

## Video tutorial

[Add Razorpay Setup Video Tutorial]

## Step 1: Create your API keys

In your Razorpay Dashboard, open **Account and Settings**, then **API keys**, and generate a key. Copy the **Key ID**, which starts with `rzp_test_` or `rzp_live_`, and the **Key secret**.

> The **Key secret** is shown only once, when the key is generated. If you no longer have it, regenerate the key.

[Add Razorpay API Keys Screenshot]

## Step 2: Copy the Webhook URL from MemberFrame

In the plugin, click **Manage**, then **Payments**, check the **Test** or **Live** switch, and click the **Razorpay** card. Copy the **Webhook URL** with the copy button, and note the events listed under it.

## Step 3: Add the webhook in Razorpay

1. In Razorpay, open **Webhooks** and click **Add new webhook**.
2. Paste the **Webhook URL** from MemberFrame.
3. Tick every event that MemberFrame listed under the **Webhook URL**.
4. Choose a secret, type it in, and save the webhook.

[Add Razorpay Webhook Screenshot]

## Step 4: Connect Razorpay in MemberFrame

Back in the Razorpay popup in the plugin, fill in the fields and click **Connect Razorpay**.

| Field | What to paste |
| --- | --- |
| **Key ID** | The key ID from **Account and Settings**, **API keys**. |
| **Key secret** | The key secret, shown once when the key was generated. |
| **Webhook secret** | The same secret you typed when you added the webhook in Razorpay. |

## Step 5: Repeat for live payments

When your testing is done, switch to **Live**, create live keys and a live webhook in Razorpay, and connect again. Then click **Go live** in the banner.

## Check that it works

Buy a tier on your published site in Test mode using Razorpay's test payment details. The member should move to that tier. If the payment goes through but the tier does not change, check that the webhook in Razorpay has the right URL, every listed event, and the same secret.

## What to read next

- [How to take payments](../07-how-to-take-payments.md)
- [Stripe](01-stripe.md)
- [Lemon Squeezy](02-lemon-squeezy.md)
