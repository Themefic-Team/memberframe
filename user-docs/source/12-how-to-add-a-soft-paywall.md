# How to Add a Soft Paywall

The Soft Paywall shows the start of an article, then fades the rest under a lock card that asks the reader to subscribe or sign in. It works on any page, including your CMS blog posts, and you only need to place it right below the content it protects.

## Before you start

Create the tiers that should read your articles in full in **Manage**, **Tiers**, and make sure your sign in and pricing pages exist, because the lock card links to them.

## Video tutorial

[Add Soft Paywall Video Tutorial]

## Choose the type of paywall

- **Free Articles Meter** lets each reader open a set number of articles in full, such as 3 every 30 days. After that, articles show their opening paragraphs and the lock card.
- **Read More Teaser** always shows the opening paragraphs and the lock card to anyone without access. It is the classic teaser.

## Step 1: Add the Soft Paywall

In the plugin, click **Builder**, pick **Soft Paywall**, and click **Add to canvas**.

## Step 2: Place it right below the content

Drag the Soft Paywall into the page, directly below the content it should protect, inside the same stack. That content can be a text block, a CMS post body, a stack, a grid, or a list, and the paywall locks the layer right above it.

[Add Soft Paywall Placement Screenshot]

On a CMS blog post, open the blog's detail page and drop the paywall directly below the post body, then set its width to **Fill** and its height to **Fit**. Because the detail page is shared by every post, all your posts will be protected at once.

> You do not need a code override or any extra setup. If a page has more than one paywall, each one protects the layer right above it.

## Step 3: Set up the paywall

Select the Soft Paywall and set it up in Framer's right sidebar.

| Setting | What it does |
| --- | --- |
| **Paywall Type** | **Free Articles Meter** or **Read More Teaser**. |
| **Free Articles** | How many articles a reader can open in full, from 1 to 100. The default is 3. Meter only. |
| **Reset Window** | How often the count starts again: **Every 7 Days** or **Every 30 Days**. Meter only. |
| **Full Access For** | Who always reads in full: **Any signed-in member**, **Any paid plan**, a tier and higher, or **Only chosen tiers…** with the tiers you tick in **Chosen Tiers**. |
| **Free Preview** | How much stays visible before the fade: paragraphs of a text block, or items of a stack, grid, or list. |
| **Below Paywall** | **Show** keeps the rest of the page visible. **Hide** hides everything below the paywall from readers without access, except your footer. |
| **Show Counter** | Shows a small counter such as "Article 2 of 3 free articles this month". Meter only. |
| **Lock Title**, **Lock Message** | The words on the lock card. The meter and the teaser each have their own. |
| **Unlock Button** | The text of the lock card's button. |
| **Glass** | How the fade looks: **Content Blur**, **Card Blur**, and **Card Opacity**. |
| **Accent Color**, **Corner Radius** | Your brand color and how rounded the card is. |

The paywall also has the shared style settings, including **Labels**, where you can change every word it shows. The lock card's button goes to your pricing page, and its sign in link goes to your sign in page and brings the reader back afterwards.

## Step 4: Publish and test

Publish your site and open an article in a private window. The paywall only cuts and frosts the article on your published site and in Framer's **Preview**, so on the canvas you will see the lock card to design it.

## How the meter counts

- Opening an article that was already counted is free, so readers can come back to it.
- A signed-out reader is counted on their device. A signed-in member is counted on their account, across all their devices, and signing in never gives extra free articles.
- Members included in **Full Access For** read everything with no counter. A signed-in member on a lower tier sees **Upgrade to keep reading**.

## Good to know

- Search engines still see the whole article. MemberFrame tells Google the article is behind a paywall, so your search ranking is not harmed.
- The article's text stays in the page's code, so a determined reader could find it. For content that must stay private, use a page lock or a protected download.

## Check that it works

With **Free Articles Meter** set to 3, open four different articles in a private window. The first three should open in full with the counter, and the fourth should show the lock card.

## What to read next

- [How to lock a page](10-how-to-lock-a-page.md)
- [How to add a pricing table](15-how-to-add-a-pricing-table.md)
- [Troubleshooting and FAQ](23-troubleshooting-and-faq.md)
