# How to Add Your Site's Domain

MemberFrame only works on the domains you list in the plugin, so your live site needs its domain added before visitors can sign up, sign in, pay, or open locked content there. This page shows you where to find your domain in Framer, how to add it, and how to check that it is working.

## Before you start

Publish your site in Framer at least once, because MemberFrame checks that a website is really published at a domain before it saves it. Your site does not need to be finished, so you can publish it early and keep working on it.

## Video tutorial

[Add Site Domains Video Tutorial]

## Why your domain is needed

Every MemberFrame component on your site carries a key that tells MemberFrame which site it belongs to. Anyone can see that key in your page's code, so MemberFrame only answers it on the domains you list here, which means a copy of your site on another address cannot use your members, tiers, or payments.

Until a domain is on the list, visitors on it see a card that says **Add this domain to MemberFrame** in place of your sign in forms, pricing table, and other components. The **Home** tab of the plugin also shows a yellow **Add your domain to go live** banner while your list is empty.

## Step 1: Copy your domain from Framer

In Framer, click **Publish** at the top right. The address your site is published at shows in the menu that opens, for example `yoursite.framer.app`, so copy it from there.

[Add Framer Publish Address Screenshot]

If you connected a custom domain in Framer, such as `yoursite.com`, copy that one as well, because each domain is added on its own.

## Step 2: Open Site Domains

In the plugin, click the account icon at the top right to open your **Profile**, then scroll down to **Site Domains** under **Personal Info**. You can also click **Add domain** in the yellow banner on the **Home** tab, which opens the same screen.

[Add Site Domains Empty Screenshot]

## Step 3: Add the domain

Click **Add domain**, paste your domain into **Domain**, and click **Add domain** at the bottom of the popup. You can type it with or without `https://`, so `yoursite.framer.app`, `www.yoursite.com`, and a full address copied from your browser all work.

MemberFrame checks that a website is published at that address before it saves it, which catches a typing mistake straight away. When the check passes, the popup closes, a **Domain added** message appears, and the domain shows as a card in the list.

[Add Domain Popup Screenshot]

> If you see a message under **Domain**, read what it says. The most common reasons are a typing mistake, or a site that has not been published at that address yet, so publish in Framer and try again.

Repeat this step for every domain your site uses, such as your Framer address and your custom domain, or both `yoursite.com` and `www.yoursite.com` if visitors can reach your site on either.

## Step 4: Open your live site once

Open your published site in your browser on a page that has a MemberFrame component, such as your sign in or pricing page. MemberFrame notices the visit, and when you come back to the plugin, the domain's card will show a green dot and **Working**, with when it was last seen.

[Add Domain Working Screenshot]

Until then, the card says **Waiting for the first visit**. Click the refresh button next to the **Site Domains** heading to check again at any time.

## Add a domain MemberFrame has seen

If your components load on an address that is not on your list, such as a custom domain you connected later, MemberFrame shows it under **Seen on your site**. Click **Add** next to it to put it on your list in one click. Only add the addresses that are really yours.

## Remove a domain

Click the bin button on a domain's card, then click **Remove domain** to confirm. Visitors on that domain will no longer be able to sign up, sign in, pay, or open locked content there, and the change applies to your live site at once. Click **Keep domain** if you change your mind.

## Check that it works

Open your published site in a private window and go to your sign in page. You should see your sign in form, not the **Add this domain to MemberFrame** card, and the domain's card in **Site Domains** should show **Working**.

## Troubleshooting

**The card still says Waiting for the first visit.** Open a page of your live site that has a MemberFrame component on it, then come back to the plugin. A page without any MemberFrame component does not count as a visit.

**My live site still shows Add this domain to MemberFrame.** The card names the exact address it is on, so check that the same address is in **Site Domains**, including `www.` if the address has it. Then reload the page on your site.

**The card says Status unknown.** MemberFrame could not check your domains just now. Wait a moment and click the refresh button, because your domains still work while the status is unknown.

## What to read next

- [How to set up your membership pages](04-how-to-set-up-your-membership-pages.md)
- [How to create your member pages](05-how-to-create-your-member-pages.md)
- [Troubleshooting and FAQ](24-troubleshooting-and-faq.md)
