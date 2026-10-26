# How to Take Payments

To sell paid tiers, you connect at least one payment gateway, which is the company that charges your buyers. MemberFrame works with Stripe, Lemon Squeezy, and Razorpay, and you can connect one, two, or all three. This page shows you how to connect a gateway, test it, go live, and set how checkout behaves.

## Before you start

You need an account with the gateway you want to use. Each gateway has its own page under **Integrations** in these docs that shows exactly where to find its keys.

## Video tutorial

[Add Take Payments Video Tutorial]

## Which gateway to choose

| Gateway | Best for | What buyers can pay with |
| --- | --- | --- |
| **Stripe** | Buyers worldwide, in over 135 currencies | Credit or debit card, Apple Pay, and Google Pay |
| **Lemon Squeezy** | Selling to the EU, the UK, and worldwide, because it handles sales tax and VAT for you | Card or PayPal |
| **Razorpay** | Buyers in India. It sells in Indian rupees (INR) only | UPI, cards, net banking, and wallets |

## Step 1: Start in Test mode

Click the **Manage** tab, then **Payments**. Keep the switch next to **Gateways** on **Test**, because in Test mode nobody is charged and you can use each gateway's test cards.

[Add Payments Test Mode Screenshot]

Test mode and Live mode each have their own keys, so the keys you connect now are only used for test purchases.

## Step 2: Connect a gateway

Click the gateway's card. A popup will open with the fields for that gateway's keys and a **Setup guide** link that opens the gateway's page in these docs.

[Add Gateway Popup Screenshot]

Paste the keys from the gateway's dashboard, then click the connect button at the bottom of the popup, for example **Connect Stripe**. The popup will close, a message will confirm the gateway is connected, and its card will show **Connected**.

The **Webhook URL** in the popup is how the gateway tells MemberFrame that a buyer has paid. Stripe and Lemon Squeezy set it up for you when you connect. For Razorpay, copy it and add it in your Razorpay dashboard yourself, as the Razorpay page explains.

## Step 3: Choose what buyers see at checkout

A connected gateway has a switch on its card that shows or hides it at checkout. Turn it off to hide the gateway from buyers without removing its keys, and its card will show **Off**. The switch saves straight away, so there is nothing else to click.

To change how a gateway is named in the checkout list, open its card and fill in **Checkout title** and **Checkout description**, then click **Save changes**. Leave them empty to use the default wording, such as "Credit or debit card, Apple Pay, and Google Pay."

When a buyer picks a tier, they choose how to pay from the gateways you show, and the one that suits their location is picked for them. With only one gateway shown, checkout opens straight away.

## Step 4: Set your checkout settings

Scroll down to **Checkout Settings** and fill in the fields, then click **Save checkout settings**.

| Setting | What it does |
| --- | --- |
| **Grace period** | How many days a member keeps access while a failed renewal payment is retried. Their status shows **Payment failed** in the meantime. |
| **Pricing page** | Where upgrade buttons send members, for example `/pricing`. |
| **After purchase** | Where buyers land after a confirmed payment, for example `/dashboard`. |
| **Site currency** | The one currency every tier is priced in. Type to search by code or name. |

> Changing the site currency moves every tier to the new currency and keeps the numbers as they are, so 9.99 USD becomes 9.99 EUR, not the converted amount. A warning stays on screen until you save, and it is a good idea to check your prices in **Tiers** afterwards.

## Step 5: Go live

When your test purchases work, switch the toggle from **Test** to **Live** and connect each gateway again with its live keys. A yellow banner will ask **Switch to live payments?**, and clicking **Go live** makes checkout use your live keys from then on.

[Add Go Live Banner Screenshot]

After you go live, buyers are charged real money, and purchases made in Test mode stop giving access. If you need to test again later, switch to **Test** and click **Switch to test** in the banner.

## Remove a gateway

Open the gateway's card and click **Remove** at the bottom left of the popup, then confirm. You cannot remove a gateway while members still have subscriptions renewing through it.

## Good to know

- Lemon Squeezy charges in your Lemon Squeezy store's currency, and Razorpay charges in INR only. If your site currency does not match, that gateway is not offered at checkout.
- A member who upgrades gets credit for the unused part of their current plan, and the checkout shows the amount due today before they pay.

## Check that it works

Publish your site, open your pricing page in a private window, sign up, and buy a tier with a test card. You should land on your **After purchase** page, and the member should show the new tier in **Manage**, **Members**.

## What to read next

- [Stripe](99-integrations/01-stripe.md)
- [How to add a pricing table](15-how-to-add-a-pricing-table.md)
- [How to read and export your reports](21-how-to-read-and-export-your-reports.md)
