# How to Add a Pricing Table

The Member Pricing component is a pricing table built from your tiers. It shows each visible tier with its prices and features, and a button that starts checkout, so visitors can join a paid tier straight from your site.

## Before you start

Create your tiers in **Manage**, **Tiers** and connect a payment gateway in **Manage**, **Payments**, because the pricing table shows your real tiers and sells them through your gateways.

## Video tutorial

[Add Pricing Table Video Tutorial]

## Step 1: Add the pricing table

Open your pricing page in Framer, usually `/pricing`. In the plugin, click **Builder**, pick **Member Pricing**, and click **Add to canvas**.

[Add Member Pricing Screenshot]

## Step 2: Set it up

Select the pricing table and set it up in Framer's right sidebar.

| Setting | What it does |
| --- | --- |
| **Headline**, **Subheadline** | The title above your tiers and the line under it. |
| **Starts On** | Whether the table first shows **Monthly** or **Yearly** prices. Visitors can switch. |
| **One Time Prices** | Shows lifetime prices, paid once, for tiers that have them. |
| **Free Tier Card** | Shows a card for your Free tier. |
| **Highlight Tier** | Makes one tier stand out as the recommended choice, with a **Most popular** badge. |
| **Sign Up Page** | Where a signed-out visitor goes after choosing a tier, to create an account before checkout. |
| **Accent Color**, **Corner Radius** | Your brand color and how rounded the cards are. |

Each tier's features come from the **Features** list in its tier popup in **Manage**, **Tiers**, so you edit them there. You can change every word on the table, such as **Get {tier}** or **Most popular**, in **Labels**.

## What your visitors will see

1. The visitor picks a tier and clicks its button, for example **Get Gold**.
2. If they are not signed in, they create an account first and then continue to checkout.
3. If you show more than one gateway, a **Choose how to pay** window lists them, with the best one for their location picked, and they click **Continue to payment**. With one gateway, checkout opens straight away.
4. They pay on the gateway's own checkout page.
5. They come back to your **After purchase** page, and their tier changes at once.

Members who already pay see **Upgrade to {tier}** or **Switch to {tier}** on the other tiers, and **Current plan** on their own. When they upgrade, the table shows the credit for the unused part of their plan and the amount due today.

## Good to know

- Tiers with **Visible to members** unticked never show on the table.
- The yearly saving, such as **Save 17%**, is worked out from your own monthly and annual prices.
- In Test mode, the table shows a small **Test mode** label, so you always know no real money is moving.
- If no gateway is connected, buttons show "Payments are not set up yet. Check back soon."

## Check that it works

Open your pricing page on your published site in a private window and buy a tier with a test card while in Test mode. You should come back to your **After purchase** page as a member of that tier.

## What to read next

- [How to take payments](07-how-to-take-payments.md)
- [How to create and price your tiers](06-how-to-create-and-price-your-tiers.md)
- [How to add a member dashboard](14-how-to-add-a-member-dashboard.md)
