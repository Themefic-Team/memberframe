# How to Create and Price Your Tiers

Tiers are your membership levels, such as Free, Pro, or Gold, and every member is on exactly one tier. Page locks, paywalls, downloads, pricing tables, reports, and webhooks all use your tiers, so it helps to create them early.

## Before you start

All tier prices use your site currency, which you set in **Manage**, then **Payments**, under **Checkout Settings**. Check it first, so your prices are in the right currency from the start.

## Video tutorial

[Add Create and Price Tiers Video Tutorial]

## How tiers work

Every site has exactly one Free tier. New members start on it, and members whose paid plan ends go back to it, so it can never be deleted and it never has a price. You can add as many paid tiers as you need, each with its own name and prices.

Each paid tier also has a **Level**. A higher level includes everything a lower level can see, so a page locked to "Pro members or higher" opens for Pro and for every tier with a higher level. The Free tier is always level 0.

## Step 1: Create your Free tier

Click the **Manage** tab, then **Tiers**. If you have no tiers yet, click **Create tier**, keep the **Type** on **Free**, type a **Name** such as Free, and click **Create tier** at the bottom of the popup.

[Add Tiers Empty Screenshot]

## Step 2: Create a paid tier

Click **Create tier** under your list of tiers. A popup will open with the type already set to **Paid**, because your site has a Free tier now.

[Add New Tier Popup Screenshot]

Fill in the tier's details.

| Setting | What it does |
| --- | --- |
| **Type** | Free or Paid. A site has one Free tier, so Free is greyed out once you have it. The type cannot change after you save. |
| **Name** | What members see on your pricing table, their dashboard, and their emails. |
| **ID** | A short code made from the name, for example `gold`. Locks and plans use it, so it never changes once the tier is saved, which means renaming a tier later never breaks a lock. |
| **Level** | The order of your tiers. The plugin suggests the next free number, and a higher number means a better tier. |
| **Monthly**, **Annual**, **Lifetime** | Prices in your site currency. A paid tier needs at least one. Leave a price empty if you do not sell that option. Lifetime is one payment that never renews. |
| **Visible to members** | Ticked, the tier shows on your pricing table. Untick it for a private or retired tier, and members already on it keep it. |

## Step 3: Add the tier's features

Under **Features**, click **Add feature** and type one line for each thing the tier includes, such as "All courses". These lines show on the tier's card in your pricing table, in the order you add them.

Untick the checkbox in front of a line when the tier does not include it. The line will show with a cross, which helps buyers see what a higher tier adds. Removing a line asks you to confirm first.

[Add Tier Features Screenshot]

## Step 4: Save the tier

Click **Create tier** at the bottom of the popup. The popup will close and your new tier will appear in the list with its prices. Nothing is saved until you click this button, so closing the popup throws your changes away.

## Edit or delete a tier

Click a tier in the list to open it in the same popup, change what you need, and click **Save tier**. To delete a paid tier, click **Delete tier** at the bottom left of the popup and confirm.

> Pages, sections, and paywalls set to a deleted tier lock for everyone until you choose another tier for them. A tier that members are still on cannot be deleted, so move those members to another tier in **Manage**, **Members** first, or untick **Visible to members** instead.

## Good to know

- The yearly saving on your pricing table, such as "Save 17%", is worked out from your own prices: the annual price compared with twelve monthly payments.
- If you see **Another tier already uses that name**, choose a different name, because each tier needs its own name and ID.
- Changes show on the canvas within about 15 seconds, and on your published site the next time a page loads.

## Check that it works

Open a page with your **Member Pricing** component. Your visible tiers should show with their prices and features.

## What to read next

- [How to take payments](07-how-to-take-payments.md)
- [How to add a pricing table](15-how-to-add-a-pricing-table.md)
- [How to lock a page](10-how-to-lock-a-page.md)
