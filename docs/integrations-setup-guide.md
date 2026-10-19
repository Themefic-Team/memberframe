# MemberFrame Integrations Setup Guide

Step by step setup for every integration in the MemberFrame plugin: the three payment gateways, the four social sign in providers, outgoing webhooks, and custom email sending.

**Who this is for**: a creator setting up MemberFrame on a Framer site, and the team supporting them.

---

## Contents

1. [Before You Start](#1-before-you-start), including [Direct Links](#direct-links)
2. [Where Each Integration Lives](#2-where-each-integration-lives)
3. [Payments: Stripe](#3-payments-stripe)
4. [Payments: Lemon Squeezy](#4-payments-lemon-squeezy)
5. [Payments: Razorpay](#5-payments-razorpay)
6. [Checkout Settings](#6-checkout-settings)
7. [Sign In: Google](#7-sign-in-google)
8. [Sign In: GitHub](#8-sign-in-github)
9. [Sign In: Apple](#9-sign-in-apple)
10. [Sign In: Discord](#10-sign-in-discord)
11. [Webhooks](#11-webhooks)
12. [Custom Email Sending (SMTP)](#12-custom-email-sending-smtp)
13. [Troubleshooting](#13-troubleshooting)

---

## 1. Before You Start

Three things must be true, or the integrations below will save but not work:

| Requirement | Why |
| :--- | :--- |
| The project is connected to MemberFrame (the Account icon, top right of the plugin) | Every key is saved against your site. A project that is not connected has nowhere to save it |
| The MemberFrame server has a public `https` address | Stripe, Lemon Squeezy, Razorpay, Google, GitHub, Apple, and Discord all call the server back. None of them can reach `localhost` or `127.0.0.1` |
| The server has `PAYMENTS_ENCRYPTION_KEY` set | Secret keys are stored encrypted. Without it the server refuses to store them and the plugin says so |

**Copy URLs from the plugin, never type them.** Every redirect URL and webhook URL below is computed by the plugin for your site and shown with a **Copy** button. The examples in this guide use the production address `https://app.framefic.com/memberframe`; yours may differ.

**Secrets are write-only.** Once saved, a secret key is never shown again, not even to you. The field shows "Saved. Type to replace". Keep your own copy in a password manager.

### Direct Links

Each link opens the exact page a step below asks for. Sign in first if asked.

| Integration | Page | Link |
| :--- | :--- | :--- |
| Stripe | API keys (test) | https://dashboard.stripe.com/test/apikeys |
| Stripe | API keys (live) | https://dashboard.stripe.com/apikeys |
| Stripe | Webhooks (test), to check the MemberFrame endpoint | https://dashboard.stripe.com/test/webhooks |
| Stripe | Webhooks (live) | https://dashboard.stripe.com/webhooks |
| Lemon Squeezy | Products | https://app.lemonsqueezy.com/products |
| Lemon Squeezy | API keys | https://app.lemonsqueezy.com/settings/api |
| Lemon Squeezy | Stores (Store ID) | https://app.lemonsqueezy.com/settings/stores |
| Lemon Squeezy | Webhooks, to check the MemberFrame webhook | https://app.lemonsqueezy.com/settings/webhooks |
| Razorpay | API keys | https://dashboard.razorpay.com/app/website-app-settings/api-keys |
| Razorpay | Webhooks | https://dashboard.razorpay.com/app/website-app-settings/webhooks |
| Google | OAuth consent screen | https://console.cloud.google.com/apis/credentials/consent |
| Google | Credentials (create OAuth client ID) | https://console.cloud.google.com/apis/credentials |
| GitHub | New OAuth App | https://github.com/settings/applications/new |
| GitHub | Your OAuth Apps | https://github.com/settings/developers |
| Apple | Identifiers (App IDs) | https://developer.apple.com/account/resources/identifiers/list |
| Apple | Services IDs | https://developer.apple.com/account/resources/identifiers/list/serviceId |
| Apple | Keys (.p8 private key) | https://developer.apple.com/account/resources/authkeys/list |
| Apple | Membership (Team ID) | https://developer.apple.com/account#MembershipDetailsCard |
| Discord | Developer Portal applications | https://discord.com/developers/applications |
| Zapier | Zaps (Catch Hook trigger) | https://zapier.com/app/zaps |
| Make | Scenarios (Custom webhook) | https://www.make.com/en/login |
| Zoho Flow | Flows (Webhook trigger) | https://flow.zoho.com |
| Gmail SMTP | App passwords | https://myaccount.google.com/apppasswords |
| Microsoft 365 SMTP | Security, app passwords | https://account.microsoft.com/security |

---

## 2. Where Each Integration Lives

| Integration | Where in the plugin |
| :--- | :--- |
| Stripe, Lemon Squeezy, Razorpay | **Manage**, **Payments**, **Gateways** |
| Default gateway, grace period, pricing page | **Manage**, **Payments**, **Checkout Settings** |
| Google, GitHub, Apple, Discord sign in | **Settings**, **Integration**, **Sign in** |
| Webhooks (Zapier, Make, Zoho Flow, n8n, your server) | **Settings**, **Integration**, **Webhooks** |
| Custom SMTP | **Settings**, **Config**, **Email** |

### Test and Live

The **Test / Live** switch at the top of Gateways holds two separate sets of keys for each gateway.

- Set up **Test** first with your gateway's test or sandbox keys, and buy a plan on your published site with a test card.
- When that works, switch to **Live**, connect the same gateway again with live keys, and test once more with a real card.
- You cannot switch to Live until at least one gateway has live keys.

---

## 3. Payments: Stripe

**Setup time**: about 2 minutes. **What you paste**: one secret key.

MemberFrame registers its own webhook in your Stripe account and creates the products and prices from your tiers, so there is nothing else to set up in Stripe.

### Steps

1. In Stripe, make sure the **Test mode** (or **Sandbox**) toggle matches the mode you picked in the plugin.
2. Go to **Developers**, **API keys**.
3. Copy the **Secret key** (`sk_test_...` in test, `sk_live_...` in live).
   - A **restricted key** (`rk_test_...` / `rk_live_...`) also works if you prefer not to share the full secret key.
4. In the plugin: **Manage**, **Payments**, **Gateways**, open **Stripe**.
5. Paste the key into **Secret key** and click **Connect Stripe**.
6. The card turns **Connected** and shows your Stripe account name and the last four characters of the key.

### Check It Worked

- In Stripe, **Developers**, **Webhooks** now lists an endpoint described as "MemberFrame", pointing at:
  `https://app.framefic.com/memberframe/api/webhooks/stripe/<your site id>/test`
- It listens to these events, which MemberFrame selects for you:
  `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`, `charge.refunded`.

### If the Card Says the Webhook Could Not Be Registered

Stripe refuses a webhook address it cannot reach. This happens when the server runs on `localhost`. The card still connects, but payments will never unlock access. Either:

- give the server a public `https` address (set `API_BASE_URL` on the server) and click **Update keys**, or
- while developing, run the Stripe CLI and leave it running:

  ```
  stripe listen --forward-to localhost:4001/api/webhooks/stripe/<your site id>/test
  ```

  Put the `whsec_...` value it prints in the server's `STRIPE_CLI_WEBHOOK_SECRET` and restart the server.

### Update or Remove

- **Update keys**: paste a new secret key, for example after rolling it in Stripe.
- **Remove**: disconnects Stripe and deletes the webhook MemberFrame created. You are asked to confirm. Removing is refused while members still renew through Stripe in that mode.

---

## 4. Payments: Lemon Squeezy

**Setup time**: about 20 minutes the first time. **What you paste**: a test mode API key, your Store ID, and up to three variant IDs.

Lemon Squeezy is the merchant of record: it collects and pays sales tax and VAT for you. That is why buyer location routing sends EU and UK buyers to it ([section 6](#6-checkout-settings)).

This section sets it up end to end in **test mode**, on a local development machine or a staging server, and ends with [moving to live](#411-moving-to-live).

### 4.1. How It Works

| Part | Who does it |
| :--- | :--- |
| One product with a monthly, a yearly, and a one-time variant | You, once, in Lemon Squeezy |
| The price each tier is charged | MemberFrame. Each checkout sends the tier's own price, so the variant's price does not matter |
| The webhook that reports payments, renewals, and cancellations | MemberFrame registers it in your store when you connect |
| Confirming the first purchase | The webhook, and as a backup, the pricing page asks Lemon Squeezy directly while the buyer waits |

**How many tiers, how many variants?** Three variants cover any number of tiers. A variant only says *how often* a buyer is charged; the *amount* and the *name* come from the tier. For example, with Basic at 5.00 a month and Pro at 15.00 a month:

| Buyer chooses | Variant used | Charged | Name on the checkout |
| :--- | :--- | :--- | :--- |
| Basic, monthly | Monthly | 5.00, then every month | Basic |
| Pro, monthly | Monthly | 15.00, then every month | Pro |
| Pro, yearly | Yearly | Pro's yearly price, then every year | Pro |
| Pro, lifetime | One-time | Pro's lifetime price, once | Pro |

MemberFrame sends the tier's price as Lemon Squeezy's `custom_price`, which also applies to every renewal, and the tier's name as the checkout's product name. So you manage prices only in **Manage**, **Tiers**: change a price there and the next checkout uses it. Never create one product or variant per tier.

### 4.2. What You Need

- A Lemon Squeezy account. A store that is not activated yet is fine: test mode works without activation.
- The MemberFrame plugin connected to your Framer project.
- The MemberFrame server running with `PAYMENTS_ENCRYPTION_KEY` set.
- For local development, a tunnel such as [ngrok](https://ngrok.com) or Cloudflare Tunnel, so Lemon Squeezy can reach your server ([section 4.6](#46-give-a-local-server-a-public-address)).
- At least one tier with a price, in **Manage**, **Tiers**, priced in the **same currency as your Lemon Squeezy store**.

### 4.3. Turn On Test Mode in Lemon Squeezy

1. Open the [Lemon Squeezy dashboard](https://app.lemonsqueezy.com).
2. Turn on the **Test mode** switch, at the bottom of the left sidebar.
3. Leave it on for every step below. Products, keys, orders, and webhooks made in test mode are test data, kept apart from live data.

### 4.4. Create the Product and Variants

1. Go to [Products](https://app.lemonsqueezy.com/products), **New product**.
2. **Name**: for example "Membership". Members see it at checkout.
3. **Pricing**: set the first variant (see the table). Then click **Add variant** for the others.

| Variant name | Payment type (the cards) | Pricing model | Repeat payment every | Used for |
| :--- | :--- | :--- | :--- | :--- |
| Monthly | Subscription | Standard pricing | 1 month | Monthly prices |
| Yearly | Subscription | Standard pricing | 1 year | Yearly prices |
| One-time | Single payment | | | Lifetime prices |

   - **Pricing model**: always **Standard pricing**. Package, Graduated, and Volume pricing are for usage based billing (seats, units) and do not work with the per tier price MemberFrame sets.
   - **Price per unit**: any amount, for example 9.99. MemberFrame replaces it with the tier's price at checkout. The currency shown next to it is your store's currency: price your tiers in that same currency, or Lemon Squeezy is never offered at checkout.
   - **Free trial**: leave off. MemberFrame manages trials itself.
   - You only need the variants for the billing periods your tiers use. A tier priced only monthly needs only the Monthly variant.
4. Click **Publish product**.
5. Copy each **Variant ID** (a number such as `123456`). Open the product, then each variant: the ID is in the variant's details and in its checkout link (`.../checkout/buy/...?...variant=123456`, or `.../variants/123456` in the address bar).

Write the three IDs down next to their names. Mixing up monthly and yearly charges members on the wrong cycle.

### 4.5. Create a Test Mode API Key and Find the Store ID

**API key**

1. With **Test mode** still on, go to [Settings, API](https://app.lemonsqueezy.com/settings/api).
2. Click **+** (Create API key), name it, for example, "MemberFrame test", and create it.
3. Copy the key now (it starts with `eyJ0eXAi...` and is very long). Lemon Squeezy shows it only once.

A key made while **Test mode** is on is a test key. MemberFrame checks this: a live key in the Test form is refused with "That API key is a live key. Make one in test mode."

**Store ID**

Go to [Settings, Stores](https://app.lemonsqueezy.com/settings/stores). The number next to your store name (for example `#12345`) is the Store ID. Copy only the digits.

### 4.6. Give a Local Server a Public Address

Skip this if your MemberFrame server already has a public `https` address (staging or production).

Lemon Squeezy cannot deliver webhooks to `localhost` or `127.0.0.1`. MemberFrame registers the webhook at the server's `API_BASE_URL`, so that address must be public **before** you connect.

1. Start the backend as usual (port `4001` in this repository's `.env`).
2. Start a tunnel to it:

   ```
   ngrok http 4001
   ```

3. Copy the `https://....ngrok-free.app` address ngrok prints.
4. In `memberframe-backend/.env`, set:

   ```
   API_BASE_URL="https://xxxx-xx-xx.ngrok-free.app"
   ```

5. Restart the backend.

Each time ngrok restarts on a free plan, the address changes. Update `API_BASE_URL`, restart the backend, and click **Update keys** on the Lemon Squeezy card: MemberFrame registers a webhook at the new address and deletes the old one. A reserved ngrok domain or a Cloudflare named tunnel avoids this.

**No tunnel at all?** You can still test the first purchase: while the buyer waits on your pricing page, MemberFrame asks Lemon Squeezy whether the order was paid and unlocks access. Renewals, failed payments, cancellations, and refunds will not reach MemberFrame until there is a webhook.

### 4.7. Connect in the Plugin

1. Open the MemberFrame plugin: **Manage**, **Payments**.
2. Make sure **Test** is selected at the top right of **Gateways**.
3. Open **Lemon Squeezy** and fill in:

| Field | Value |
| :--- | :--- |
| API key | The test mode key from 4.5 |
| Store ID | The digits from 4.5 |
| Monthly variant | The Monthly variant ID from 4.4 |
| Yearly variant | The Yearly variant ID from 4.4 |
| One-time variant | The One-time variant ID from 4.4 |

4. Click **Connect Lemon Squeezy**.

MemberFrame then checks, in order:

1. The API key and Store ID belong together.
2. The key is a test mode key.
3. Each variant ID is a number and exists in this store.
4. It registers the webhook.

The card turns **Connected** and shows your store name. If it also shows a notice, read it: "Add at least one variant ID so tiers can be sold" means no variant was saved, and "Connected, but the webhook could not be registered" means [section 4.6](#46-give-a-local-server-a-public-address) is not done.

### 4.8. Check the Webhook

**You do not add this webhook yourself.** MemberFrame creates it in your store when you click **Connect Lemon Squeezy** (or **Update keys**). The **Webhook URL** on the plugin card is for reference only.

**To check it is there**

1. With **Test mode** on, go to [Settings, Webhooks](https://app.lemonsqueezy.com/settings/webhooks).
2. There should be exactly one MemberFrame webhook, pointing at your server's address plus `/api/webhooks/lemonsqueezy/<your site id>/test`. For example:
   - Production: `https://app.framefic.com/memberframe/api/webhooks/lemonsqueezy/<your site id>/test`
   - Local with a tunnel: `https://xxxx-xx-xx.ngrok-free.app/api/webhooks/lemonsqueezy/<your site id>/test`
3. Its ticked events (under "What updates should we send?") are exactly these nine:

| Event | Ticked |
| :--- | :--- |
| `order_created` | Yes |
| `order_refunded` | Yes |
| `subscription_created` | Yes |
| `subscription_updated` | Yes |
| `subscription_cancelled` | Yes |
| `subscription_resumed` | Yes |
| `subscription_expired` | Yes |
| `subscription_payment_success` | Yes |
| `subscription_payment_failed` | Yes |
| Everything else (`affiliate_activated`, `customer_updated`, `dispute_created`, `dispute_resolved`, `subscription_paused`, `subscription_unpaused`, `subscription_payment_recovered`, `subscription_payment_refunded`, `license_key_*`) | No |

**Why a webhook made by hand does not work**

The webhook form in Lemon Squeezy asks for a **Signing secret**, used to sign each request in the `X-Signature` header. When MemberFrame registers the webhook, it generates a random secret and keeps it, encrypted, on its own server. Nobody can read it back, including you. A webhook you create by hand has a different secret, so MemberFrame refuses every event it sends, and payments never unlock access, even with the right URL and events.

For the same reason, if you open the MemberFrame webhook to look at it, close it with **Cancel**. Saving it can replace the stored secret.

**If the webhook is missing, or was made by hand**

1. Delete any webhook you created by hand in [Settings, Webhooks](https://app.lemonsqueezy.com/settings/webhooks).
2. In the plugin: **Manage**, **Payments**, **Test**, open **Lemon Squeezy**, click **Update keys**. You do not need to paste the API key again: an empty field keeps the stored value.
3. MemberFrame registers a fresh webhook with the right URL, secret, and events, and deletes the one it made before.
4. Reload Settings, Webhooks in Lemon Squeezy to see it.

If the card says **"Connected, but the webhook could not be registered: ..."**, the rest of the message is Lemon Squeezy's reason. The usual one is that the server address is not public or not running: open `<your server address>/health` (for example `https://app.framefic.com/memberframe/health`) and check it answers `"status":"ok"`. For local development, see [section 4.6](#46-give-a-local-server-a-public-address).

Only Razorpay needs a webhook added by hand ([section 5](#5-payments-razorpay)), because its API does not let MemberFrame create one.

### 4.9. Make a Test Purchase

1. Add a `<MemberPricing>` component to a page (or use **Builder**, **Predefined Pages**, **Member pricing**) and publish the site, or use the canvas preview.
2. Sign in as a test member (any email you can read; with `MAIL_DRIVER=log` the code is written to `memberframe-backend/storage/mail/`).
3. Choose a paid plan. The Lemon Squeezy checkout opens with **Test mode** shown on it.
4. Pay with a test card:

| Card number | Result |
| :--- | :--- |
| `4242 4242 4242 4242` | Payment succeeds |
| `4000 0000 0000 0002` | Card declined |

   Use any future expiry date, any 3 digit CVC, and any name and postal code.
5. After paying, you return to the site. The page shows "Your payment is being confirmed" for a few seconds, then the member's plan unlocks.

**Check the result**

- Plugin: **Manage**, **Members**: the member shows the new plan; open them to see the purchase.
- Lemon Squeezy (test mode): [Orders](https://app.lemonsqueezy.com/orders) and [Subscriptions](https://app.lemonsqueezy.com/subscriptions) show the purchase.
- Lemon Squeezy, [Settings, Webhooks](https://app.lemonsqueezy.com/settings/webhooks): open the webhook to see each delivery and the answer from your server. A `200` means MemberFrame accepted it.

### 4.10. Test the Rest of the Lifecycle

All in Lemon Squeezy with **Test mode** on. Each one should change the member in **Manage**, **Members** within a few seconds.

| To test | Do this | Expected in MemberFrame |
| :--- | :--- | :--- |
| Cancellation | [Subscriptions](https://app.lemonsqueezy.com/subscriptions), open the subscription, **Cancel subscription** | The plan shows as cancelling and ends at the period end |
| Refund | [Orders](https://app.lemonsqueezy.com/orders), open the order, **Refund** | The payment shows as refunded |
| Lifetime | Buy a lifetime price | Charged once on the One-time variant, no renewal |
| Upgrade | As the member, choose a higher tier on the pricing page | The member moves to the new tier |
| Declined card | Buy with `4000 0000 0000 0002` | No access is granted |

To rerun a delivery that failed (for example while the tunnel was down), open the webhook in Lemon Squeezy and resend it from its delivery list.

### 4.11. Moving to Live

Test and Live keep separate keys, so going live is a second connection, not an edit.

1. **Activate your store** in Lemon Squeezy (identity and payout details). Live checkouts are refused until Lemon Squeezy approves it.
2. Turn **Test mode** off in Lemon Squeezy.
3. Make sure the product and its three variants exist in **live** mode (create them again, or copy the product to live mode), and copy the **live variant IDs**. Test variant IDs do not work in live mode.
4. Create a **live** API key in [Settings, API](https://app.lemonsqueezy.com/settings/api).
5. Make sure the server's `API_BASE_URL` is the permanent production address, never a tunnel.
6. In the plugin, select **Live**, open **Lemon Squeezy**, paste the live key, the Store ID, and the live variant IDs, and click **Connect Lemon Squeezy**.
7. Confirm **Go live**, then make one real purchase and refund it.

### 4.12. Lemon Squeezy Troubleshooting

| Message or symptom | Cause | Fix |
| :--- | :--- | :--- |
| "That API key is a live key. Make one in test mode." | The key was made with **Test mode** off | Turn **Test mode** on and create a new key |
| "That API key is a test mode key. Make one in live mode." | A test key in the Live form | Turn **Test mode** off and create a live key |
| "Lemon Squeezy did not accept that API key and Store ID together." | Wrong key, a revoked key, or the Store ID of another store | Copy the Store ID again from Settings, Stores, and paste a fresh key |
| "Paste the Store ID, a number." | The `#` or the store name was pasted | Paste the digits only |
| "The monthly variant ID must be a number." | A product ID, a URL, or a name was pasted | Paste only the variant's number |
| "Variant 123456 was not found in this store." | The variant is in another store, or in the other mode | Copy the ID from the same store, with the same Test mode setting as the key |
| "Add at least one variant ID so tiers can be sold." | All three variant fields were left empty | Add the variant IDs and click **Update keys** |
| "Connected, but the webhook could not be registered" | The server address is not public | Do [section 4.6](#46-give-a-local-server-a-public-address), then **Update keys** |
| Lemon Squeezy is never offered at checkout | The tier's currency differs from the store's currency, or there is no variant for that billing period | Price the tier in the store's currency, and add the missing variant |
| Payment succeeds but the plan never unlocks | The webhook cannot reach the server and the buyer left the page before it confirmed | Check the webhook's deliveries in Lemon Squeezy; fix the tunnel or `API_BASE_URL`, then resend the delivery |
| Webhook deliveries fail after restarting ngrok | The free ngrok address changed | Update `API_BASE_URL`, restart the backend, click **Update keys** |
| Webhook deliveries fail with an error status | The webhook was edited or recreated by hand, so its secret no longer matches | Delete the hand made webhook and click **Update keys** to register a fresh one |

---

## 5. Payments: Razorpay

**Setup time**: about 15 minutes the first time. **What you paste**: a Key ID, a Key Secret, and a webhook secret you choose.

Razorpay is for buyers in India: cards, UPI (including UPI Autopay for subscriptions), net banking, and wallets. Buyer location routing sends buyers in India to it ([section 6](#6-checkout-settings)).

This section sets it up end to end in **test mode**, on a local development machine or a staging server, and ends with [moving to live](#511-moving-to-live).

### 5.1. How It Works

| Part | Who does it |
| :--- | :--- |
| A Razorpay **plan** for each tier's monthly and yearly price | MemberFrame, automatically, the first time that price is bought. Named after the tier |
| A Razorpay **order** for each lifetime purchase | MemberFrame, at checkout |
| The payment window (cards, UPI, UPI QR, net banking) | Razorpay Checkout, opened on your page |
| The webhook that reports payments, renewals, failures, and refunds | **You**, by hand, in the Razorpay dashboard. Razorpay does not let MemberFrame create it |
| Confirming the first purchase | The webhook, and as a backup, the pricing page asks Razorpay directly while the buyer waits |

**Tiers and prices**: you set every price in **Manage**, **Tiers**, as with the other gateways. There is nothing to create in Razorpay per tier. When you change a tier's price, MemberFrame makes a new plan for it; existing subscribers stay on the plan they bought.

**Currency**: Razorpay sells **INR only** in MemberFrame. A tier priced in any other currency is never offered through Razorpay; buyers in India then go to your default gateway.

### 5.2. What You Need

- A Razorpay account. Test mode works before your account is activated (KYC).
- **Subscriptions** available on the account, for monthly and yearly tiers. Lifetime prices work without it. If creating a plan fails, enable Subscriptions in the dashboard or ask Razorpay support.
- The MemberFrame plugin connected to your Framer project, and the server running with `PAYMENTS_ENCRYPTION_KEY` set.
- At least one tier priced in **INR** in **Manage**, **Tiers**.
- For local development, a tunnel such as [ngrok](https://ngrok.com) or Cloudflare Tunnel, so Razorpay can reach your server ([section 5.5](#55-give-a-local-server-a-public-address)).

### 5.3. Switch the Razorpay Dashboard to Test Mode

1. Open the [Razorpay Dashboard](https://dashboard.razorpay.com).
2. Use the **Test Mode** / **Live Mode** switch at the top of the dashboard and select **Test Mode**.
3. Keep it on Test Mode for every step below. API keys, webhooks, plans, and payments are kept separately for each mode.

### 5.4. Generate Test API Keys

1. Go to [Account & Settings, API Keys](https://dashboard.razorpay.com/app/website-app-settings/api-keys).
2. Click **Generate Test Key** (or **Regenerate** if one exists and you do not have its secret).
3. Copy both values:

| Value | Looks like | Note |
| :--- | :--- | :--- |
| Key ID | `rzp_test_XXXXXXXXXXXXXX` | Public. Shown again any time |
| Key Secret | A long random string | Shown **only once**. If you lose it, regenerate the key |

MemberFrame checks the mode from the Key ID: a `rzp_live_` key in the Test form is refused with "That is a live key. Paste a test key, rzp_test_."

### 5.5. Give a Local Server a Public Address

Skip this if your MemberFrame server already has a public `https` address (staging or production).

Razorpay cannot deliver webhooks to `localhost` or `127.0.0.1`.

1. Start the backend (port `4001` in this repository's `.env`).
2. Run `ngrok http 4001` and copy the `https://....ngrok-free.app` address.
3. Set it in `memberframe-backend/.env` and restart the backend:

   ```
   API_BASE_URL="https://xxxx-xx-xx.ngrok-free.app"
   ```

When the ngrok address changes, edit the webhook's URL in the Razorpay dashboard ([5.7](#57-add-the-webhook-in-razorpay)) to the new address. Razorpay does not follow it on its own, and **Update keys** cannot change it either, because MemberFrame did not create it.

**No tunnel at all?** You can still test the first purchase: while the buyer waits on your pricing page, MemberFrame asks Razorpay whether the order or subscription was paid and unlocks access. Renewals, failed payments, cancellations, and refunds will not reach MemberFrame without the webhook.

### 5.6. Connect in the Plugin

1. Open the MemberFrame plugin: **Manage**, **Payments**.
2. Make sure **Test** is selected at the top right of **Gateways**.
3. Open **Razorpay** and fill in:

| Field | Value |
| :--- | :--- |
| Key ID | The `rzp_test_...` Key ID from 5.4 |
| Key secret | The Key Secret from 5.4 |
| Webhook secret | Leave empty for now. You choose it in 5.7 |

4. Click **Connect Razorpay**. The card turns **Connected** with the notice: "Connected. Add the webhook in your Razorpay dashboard and paste its secret, or purchases will not unlock access." That is expected.
5. Click **Copy** next to **Webhook URL**. It looks like:
   - Production: `https://app.framefic.com/memberframe/api/webhooks/razorpay/<your site id>/test`
   - Local with a tunnel: `https://xxxx-xx-xx.ngrok-free.app/api/webhooks/razorpay/<your site id>/test`

### 5.7. Add the Webhook in Razorpay

Unlike Stripe and Lemon Squeezy, **this one you do add by hand**, and here you choose the secret yourself, so it can match.

1. Still in **Test Mode**, go to [Account & Settings, Webhooks](https://dashboard.razorpay.com/app/website-app-settings/webhooks).
2. Click **+ Add New Webhook**.
3. Fill in:

| Field | Value |
| :--- | :--- |
| Webhook URL | The URL you copied in 5.6 |
| Secret | Make up a long random value, for example the output of `openssl rand -hex 24`. Keep a copy: Razorpay will not show it again |
| Alert Email | Optional. Razorpay emails it when deliveries keep failing |
| Active Events | Tick exactly the nine below |

| Event | Ticked |
| :--- | :--- |
| `subscription.activated` | Yes |
| `subscription.charged` | Yes |
| `subscription.pending` | Yes |
| `subscription.halted` | Yes |
| `subscription.cancelled` | Yes |
| `subscription.completed` | Yes |
| `subscription.resumed` | Yes |
| `order.paid` | Yes |
| `refund.processed` | Yes |
| Everything else (`payment.*`, `invoice.*`, `subscription.authenticated`, `subscription.paused`, `subscription.updated`, and the rest) | No |

   Type each name into the **Search** box above the list and tick it, rather than ticking a whole group. The bar under the list should read **9 events selected**.

   **Searching `subscription` finds nothing ("0 search results")?** Subscriptions is not enabled on your account, and Razorpay hides its events until it is. Open [Subscriptions](https://dashboard.razorpay.com/app/subscriptions) in Test Mode and click **Get started** or **Activate**; if Razorpay asks you to request access, submit the request or ask through **Help & Support**. Meanwhile, create the webhook with `order.paid` and `refund.processed` only (lifetime purchases work), and once Subscriptions is on, **edit** the same webhook to tick the seven `subscription.*` events.

4. Click **Create Webhook**.

### 5.8. Paste the Webhook Secret

1. Back in the plugin, open **Razorpay**.
2. Paste the **same secret** into **Webhook secret**. Leave Key ID and Key secret empty: an empty field keeps the stored value.
3. Click **Update keys**. The notice disappears.

**Why the secret matters**: Razorpay signs each webhook with it in the `X-Razorpay-Signature` header, and MemberFrame recalculates the signature before it trusts the event. Without the matching secret, every webhook is refused and payments never unlock access. Without the check at all, anyone who found the URL could send a fake "paid" event.

If you ever change the secret in Razorpay, paste the new one here and click **Update keys**.

### 5.9. Make a Test Purchase

1. Add a `<MemberPricing>` component to a page (or **Builder**, **Predefined Pages**, **Member pricing**) and publish the site, or use the canvas preview.
2. Sign in as a test member (with `MAIL_DRIVER=log`, the code is written to `memberframe-backend/storage/mail/`).
3. Choose a tier priced in INR. Razorpay Checkout opens, marked as test mode, with the tier's name and price. (For a buyer outside India with location routing on, another gateway opens instead. To test Razorpay from outside India, set **Default gateway** to Razorpay or turn **Route by buyer location** off.)
4. Pay with a test method:

| Method | Test value | Result |
| :--- | :--- | :--- |
| UPI | VPA `success@razorpay` | Payment succeeds |
| UPI | VPA `failure@razorpay` | Payment fails |
| Net banking | Any bank, then **Success** on Razorpay's test bank page | Payment succeeds |
| Card | A card from [Razorpay's test cards](https://razorpay.com/docs/payments/payments/test-card-details/), any future expiry, any CVV, any OTP on the test page | Payment succeeds or fails, as the list says |

   For a monthly or yearly tier, pick a card or UPI that the test list marks as supporting **recurring** payments; others cannot start a subscription.
5. After paying, the page shows "Your payment is being confirmed" for a few seconds, then the member's plan unlocks.

**Check the result**

- Plugin: **Manage**, **Members**: the member shows the new plan.
- Razorpay (Test Mode): **Transactions**, **Payments** lists the payment; **Subscriptions** lists the subscription, and **Subscriptions**, **Plans** shows the plan MemberFrame made, named after the tier.
- Razorpay, [Webhooks](https://dashboard.razorpay.com/app/website-app-settings/webhooks): open the webhook to see its recent deliveries. A `200` response means MemberFrame accepted it.

### 5.10. Test the Rest of the Lifecycle

In the Razorpay dashboard with **Test Mode** on. Each should change the member in **Manage**, **Members** within a few seconds.

| To test | Do this | Expected in MemberFrame |
| :--- | :--- | :--- |
| Cancellation | **Subscriptions**, open it, **Cancel**, at the end of the billing cycle | The plan ends at the period end |
| Immediate cancellation | **Subscriptions**, open it, cancel immediately | Access ends now |
| Refund | **Transactions**, **Payments**, open the payment, **Issue Refund** | The payment shows as refunded |
| Lifetime | Buy a lifetime price | One order, charged once, no subscription |
| Failed payment | Pay with `failure@razorpay` or a failing test card | No access is granted |

A cancellation scheduled for the end of the cycle **cannot be undone** in Razorpay, so MemberFrame offers no resume for Razorpay subscriptions. The member subscribes again instead.

### 5.11. Moving to Live

Test and Live keep separate keys and separate webhooks, so going live is a second setup.

1. **Activate your account** in Razorpay (KYC and bank details). Live payments are refused until Razorpay approves it.
2. Switch the dashboard to **Live Mode**.
3. Generate **live** API keys (`rzp_live_...`).
4. Make sure the server's `API_BASE_URL` is the permanent production address, never a tunnel.
5. In the plugin, select **Live**, open **Razorpay**, paste the live Key ID and Key secret, click **Connect Razorpay**, and copy the **Webhook URL**. It now ends in `/live`.
6. In Razorpay **Live Mode**, add a new webhook with that URL, a **new** secret, and the same nine events ([5.7](#57-add-the-webhook-in-razorpay)).
7. Paste that secret into the plugin's **Webhook secret** and click **Update keys**.
8. Confirm **Go live**, then make one real purchase and refund it.

### 5.12. Razorpay Troubleshooting

| Message or symptom | Cause | Fix |
| :--- | :--- | :--- |
| "Paste the Key ID. It starts with rzp_test_ or rzp_live_." | The Key Secret or something else was pasted into Key ID | Paste the value that starts with `rzp_` |
| "That is a live key. Paste a test key, rzp_test_." | A live key in the Test form | Switch Razorpay to Test Mode and generate a test key |
| "That is a test key. Paste a live key, rzp_live_." | A test key in the Live form | Generate a live key in Live Mode |
| "Razorpay did not accept that Key ID and Secret." | The secret belongs to another key, or the key was regenerated | Regenerate the key and paste both values again |
| "Connected. Add the webhook in your Razorpay dashboard and paste its secret..." | No webhook secret stored yet | Do [5.7](#57-add-the-webhook-in-razorpay) and [5.8](#58-paste-the-webhook-secret) |
| Razorpay is never offered at checkout | The tier is not priced in INR, or the buyer is outside India with location routing on | Price the tier in INR; to test from outside India, make Razorpay the default gateway |
| "Subscriptions is not enabled on this Razorpay account, so only lifetime prices can be sold." | Subscriptions is not enabled on the Razorpay account. Monthly and yearly tiers go to another gateway until it is | Enable [Subscriptions](https://dashboard.razorpay.com/app/subscriptions), then click **Update keys** |
| Webhook form: searching `subscription.charged` shows "0 search results" | Subscriptions is not enabled, so its events are hidden | Enable [Subscriptions](https://dashboard.razorpay.com/app/subscriptions), then edit the webhook and tick the seven events |
| Payment succeeds but the plan never unlocks | The webhook is missing, points at an old address, or its secret differs, and the buyer left the page before it confirmed | Check the webhook's URL and recent deliveries in Razorpay; paste the same secret into the plugin and click **Update keys** |
| Webhook deliveries fail with `400` and `invalid_signature` | The secret in Razorpay and in the plugin differ | Set a new secret in Razorpay, paste the same one in the plugin, **Update keys** |
| Webhook deliveries fail after restarting ngrok | The free ngrok address changed | Edit the webhook URL in Razorpay to the new address |
| A cancelled subscription cannot be resumed | Razorpay does not allow undoing a scheduled cancel | The member subscribes again |

### 5.13. What Each Razorpay Event Does

What MemberFrame does when each of the nine webhook events arrives. Useful when reading the webhook's delivery log.

| Event | When Razorpay sends it | What MemberFrame does |
| :--- | :--- | :--- |
| `subscription.activated` | The first payment of a monthly or yearly plan went through | Gives the member the tier and records the period end |
| `subscription.charged` | Any successful charge, including every renewal | Records the payment and moves the period end forward |
| `subscription.pending` | A renewal charge failed and Razorpay is retrying | Marks the payment as failed. The member keeps access for the **Grace period** set in Checkout Settings |
| `subscription.halted` | Every retry failed | Ends the subscription; access ends |
| `subscription.cancelled` | The subscription was cancelled, now or at the end of the cycle | Ends the subscription; access ends |
| `subscription.completed` | All billing cycles ran out (after 10 years yearly, or 120 months monthly) | Ends the subscription |
| `subscription.resumed` | A paused or halted subscription was charged again | Restores access and the period end |
| `order.paid` | A lifetime purchase was paid | Gives the member the tier for life and records the payment |
| `refund.processed` | A refund on a lifetime purchase went through | Marks the purchase as refunded |

Each event is applied once: a delivery Razorpay repeats is recognised by its event id and ignored.

---

## 6. Checkout Settings

**Manage**, **Payments**, **Checkout Settings**. These apply to every gateway.

| Setting | What it does |
| :--- | :--- |
| Default gateway | Which gateway a checkout uses when location routing does not decide. **First connected** picks the first one connected, in the order Stripe, Lemon Squeezy, Razorpay |
| Route by buyer location | Picks a gateway from the buyer's country: India goes to Razorpay; the EU, UK, Norway, Iceland, Liechtenstein, and Switzerland go to Lemon Squeezy, which handles VAT; everyone else goes to Stripe. When the matching gateway is not connected, the default gateway is used |
| Grace period | Days a member keeps access after a renewal payment fails, while the gateway retries the card |
| Pricing page | The page path of your pricing page, for example `/pricing`. Must start with a slash |

---

## 7. Sign In: Google

**Where**: **Settings**, **Integration**, **Sign in**, **Google sign in**.

### Steps

1. Open the **Google sign in** card in the plugin and click **Copy** next to **Redirect URL**. It looks like:
   `https://app.framefic.com/memberframe/api/member/oauth/google/callback`
2. Go to [Google Cloud Console](https://console.cloud.google.com) and create or select a project.
3. **APIs & Services**, **OAuth consent screen**:
   - User type: **External**.
   - Fill in the app name, support email, and developer contact email.
   - Scopes: `openid`, `email`, `profile` (the defaults are enough).
   - Publish the app when you are ready for anyone to sign in. While it is in **Testing**, only the test users you list can sign in.
4. **APIs & Services**, **Credentials**, **Create credentials**, **OAuth client ID**:
   - Application type: **Web application**.
   - **Authorized redirect URIs**: paste the Redirect URL from step 1.
   - Click **Create**.
5. Copy the **Client ID** (ends in `.apps.googleusercontent.com`) and the **Client secret**.
6. Back in the plugin, paste both into the card, turn the switch **on**, and click **Save**.

---

## 8. Sign In: GitHub

**Where**: **Settings**, **Integration**, **Sign in**, **GitHub sign in**.

### Steps

1. Open the **GitHub sign in** card in the plugin and click **Copy** next to **Redirect URL**. It looks like:
   `https://app.framefic.com/memberframe/api/member/oauth/github/callback`
2. In GitHub: **Settings**, **Developer settings**, **OAuth Apps**, **New OAuth App**.
3. Fill in:

| Field | Value |
| :--- | :--- |
| Application name | Your site's name. Members see it on the GitHub consent screen |
| Homepage URL | Your published Framer site, for example `https://mysite.framer.website` |
| Authorization callback URL | The Redirect URL from step 1 |

4. Click **Register application**.
5. Copy the **Client ID**, then click **Generate a new client secret** and copy it.
6. Back in the plugin, paste both, turn the switch **on**, and click **Save**.

MemberFrame asks GitHub for `read:user` and `user:email`, so it can read a member's primary verified email even when it is private on their profile.

---

## 9. Sign In: Apple

**Where**: **Settings**, **Integration**, **Sign in**, **Apple sign in**.

**You need**: a paid Apple Developer Program membership.

### Steps

1. Open the **Apple sign in** card in the plugin and click **Copy** next to **Redirect URL**. It looks like:
   `https://app.framefic.com/memberframe/api/member/oauth/apple/callback`
2. In [Apple Developer](https://developer.apple.com/account), **Certificates, Identifiers & Profiles**, **Identifiers**:
   - **App ID**: create one (or use an existing one) and tick **Sign in with Apple**.
   - **Services ID**: click **+**, choose **Services IDs**, and give it an identifier such as `com.yoursite.memberframe`. This identifier is your **Services ID**.
3. Open the Services ID, tick **Sign in with Apple**, and click **Configure**:
   - **Primary App ID**: the App ID from step 2.
   - **Domains and Subdomains**: the domain of the MemberFrame server, for example `app.framefic.com`. No `https://`, no path.
   - **Return URLs**: the Redirect URL from step 1.
   - Click **Save**, then **Continue**, then **Save**.
4. **Keys**, **+**, tick **Sign in with Apple**, click **Configure**, choose the Primary App ID, and register the key.
   - Download the `.p8` file. Apple lets you download it **only once**.
   - Note the 10 character **Key ID**.
5. Note your 10 character **Team ID**, shown at the top right of the developer account and under **Membership**.
6. Back in the plugin, fill in:

| Field | Value |
| :--- | :--- |
| Services ID | The identifier from step 2, for example `com.yoursite.memberframe` |
| Team ID | From step 5 |
| Key ID | From step 4 |
| Private key | Open the `.p8` file in a text editor and paste the whole contents, including the `BEGIN PRIVATE KEY` and `END PRIVATE KEY` lines |

7. Turn the switch **on** and click **Save**.

Apple only shares a member's name on their **first** sign in, and a member may choose **Hide My Email**, in which case MemberFrame receives an `@privaterelay.appleid.com` address. Emails sent to it still reach the member.

---

## 10. Sign In: Discord

**Where**: **Settings**, **Integration**, **Sign in**, **Discord sign in**.

### Steps

1. Open the **Discord sign in** card in the plugin and click **Copy** next to **Redirect URL**. It looks like:
   `https://app.framefic.com/memberframe/api/member/oauth/discord/callback`
2. Go to the [Discord Developer Portal](https://discord.com/developers/applications) and click **New Application**. Name it after your site.
3. **General Information**: copy the **Application ID**.
4. **OAuth2**:
   - **Client Secret**: click **Reset Secret** and copy it.
   - **Redirects**: click **Add Redirect**, paste the Redirect URL from step 1, and click **Save Changes**.
5. Back in the plugin, paste the **Application ID** and **Client secret**, turn the switch **on**, and click **Save**.

MemberFrame asks Discord for `identify` and `email`. A Discord account with no verified email cannot sign in.

**Paste the Redirect URL only under OAuth2, Redirects.** Leave **Interactions Endpoint URL** on the General Information page empty. That field is for bots: Discord sends it a signed test request when you save, MemberFrame's callback does not answer like a bot, and Discord refuses to save with "interactions_endpoint_url: The specified interactions endpoint url could not be verified." Clear the field and save again to fix it.

---

## 11. Webhooks

**Where**: **Settings**, **Integration**, **Webhooks**.

Sends member events to Zapier, Make, Zoho Flow, n8n, Pabbly, or your own server, so your CRM or mailing list learns about a member the moment something happens. Up to 10 webhooks per site.

### Steps

1. In the tool you are sending to, create a webhook trigger and copy its URL:

| Tool | Where to get the URL |
| :--- | :--- |
| Zapier | New Zap, trigger **Webhooks by Zapier**, **Catch Hook** |
| Make | New scenario, **Webhooks**, **Custom webhook** |
| Zoho Flow | New flow, trigger **Webhook** |
| n8n | Add a **Webhook** node, use its **Production URL** |
| Your server | Any `https` address that accepts a JSON `POST` |

2. In the plugin, click **Add webhook**.
3. Fill in:

| Field | Value |
| :--- | :--- |
| Name | Anything that tells you where it goes, for example `Zoho CRM` |
| URL | The URL from step 1. Must be `https` |
| Send when | The events this destination needs (see below) |
| For members on | **All plans**, or only the plans you tick |
| Fields sent | Optional. Choose which member fields to send and the key each one is sent under. Leave it alone to send the standard payload |

4. Click **Save webhook**.
5. Click **Send test**. MemberFrame posts a sample `webhook.test` event and shows the answer from your tool at once. Many tools (Zapier, Make) need this sample before you can map fields.

### Events

| In the plugin | Event name | Fires when |
| :--- | :--- | :--- |
| New member signs up | `member.created` | An account is confirmed, or created by an email code or social sign in |
| Member updates their profile or status | `member.updated` | The member edits their profile, or you change their status in Manage |
| Member's plan changes | `member.tier_changed` | A payment, upgrade, cancellation, or your change in Manage. Includes the previous plan |
| Member is deleted | `member.deleted` | You delete the member in Manage |

### Delivery and Security

- Failed deliveries are retried 6 times: at once, then after 1 minute, 5 minutes, 30 minutes, 2 hours, and 6 hours.
- **Recent deliveries** on each webhook shows every attempt and its result.
- Every request carries an `X-MemberFrame-Signature` header, signed with the webhook's **Signing secret** (shown on the webhook, with **Copy secret**). Your own server can use it to prove the request came from MemberFrame. The full format is in [`development-docs/20-webhooks.md`](development-docs/20-webhooks.md), section 4.

---

## 12. Custom Email Sending (SMTP)

**Where**: **Settings**, **Config**, **Email**, **Custom SMTP**.

Optional. By default, member emails (sign in codes, email confirmation, password reset) come from the Framefic platform sender. With custom SMTP they come from your own address and domain.

### Steps

1. Get the SMTP details from your email provider (Google Workspace, Microsoft 365, Zoho Mail, Postmark, SendGrid, Amazon SES, Mailgun, and so on).
2. Open the **Custom SMTP** card and fill in:

| Field | Value |
| :--- | :--- |
| Host | Your provider's SMTP server, for example `smtp.gmail.com` |
| Security | **STARTTLS (587)** for most providers, **SSL/TLS (465)** if your provider says so. Choosing one sets the port |
| Port | Set by Security. Change it only if your provider uses another port |
| Username | Usually your full email address, or the provider's SMTP username |
| Password | The SMTP password. For Gmail and Microsoft 365 with two step verification, use an **app password** |
| From name | The name members see, for example your site's name |
| From address | An address your provider allows you to send from |
| Reply-to | Optional. Where replies go, if not the From address |

3. Click **Save and turn on**.
4. Enter a **Test address** and click **Send test email**. The test goes through your SMTP only.

If your SMTP ever fails, the email goes out from the platform sender instead, so a member is never locked out. The card shows **Send failed** with the reason.

For good delivery, set up SPF, DKIM, and DMARC records for your domain as your email provider describes.

---

## 13. Troubleshooting

| Symptom | Cause | Fix |
| :--- | :--- | :--- |
| A payment succeeds but the member never gets access | The webhook is not reaching the server | Stripe and Lemon Squeezy: check the card for a "could not register the webhook" notice and see [section 3](#if-the-card-says-the-webhook-could-not-be-registered). Razorpay: check the webhook and its secret, [section 5](#5-payments-razorpay) |
| "The server has no encryption key, so it cannot store gateway keys" | `PAYMENTS_ENCRYPTION_KEY` is not set on the server | Set it (`openssl rand -base64 32`) and restart the server |
| "Connect a gateway with live keys before switching to Live" | Only test keys are connected | Connect a gateway in **Live** mode first |
| "Members still renew through this gateway" when removing | Active subscriptions use it | Wait for those plans to end, or cancel them in the gateway |
| Lemon Squeezy: "Variant ... was not found in this store" | The variant belongs to another store, or to the other mode | Check the Store ID, and make the API key in the same mode as the variant |
| Google: `redirect_uri_mismatch` | The redirect URI in Google differs from the plugin's by even one character | Copy the Redirect URL from the plugin again and paste it exactly |
| Google: "Access blocked" for some visitors | The consent screen is still in **Testing** | Publish the app on the OAuth consent screen |
| GitHub: "The redirect_uri is not associated with this application" | Callback URL mismatch | Paste the plugin's Redirect URL as the **Authorization callback URL** |
| Apple: `invalid_client` | Wrong Services ID, Team ID, Key ID, or a damaged private key | Use the Services ID, not the App ID, and paste the whole `.p8` file |
| Discord: "Invalid OAuth2 redirect_uri" | The redirect was not saved | Add it under **OAuth2**, **Redirects**, and click **Save Changes** |
| Discord: "interactions_endpoint_url: The specified interactions endpoint url could not be verified" | The Redirect URL was pasted into **Interactions Endpoint URL** on General Information | Clear that field, save, and add the URL under **OAuth2**, **Redirects** instead |
| A sign in popup opens and closes with no result | The server's public address is wrong | Check `API_BASE_URL` on the server matches the address in your Redirect URLs |
| Webhook test fails with a refused address | The URL is `http`, or points at a private network address | Use a public `https` URL |
| SMTP test fails with an authentication error | Wrong username or password, or the provider needs an app password | Create an app password at your provider and paste it |

Still stuck? Contact [Framefic support](https://framefic.com/support/).
