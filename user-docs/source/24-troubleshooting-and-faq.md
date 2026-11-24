# Troubleshooting and FAQ

This page lists the most common problems and questions, with what to do for each one. If your problem is not here, click **Contact us** on the **Home** tab of the plugin.

## Video tutorial

[Add Troubleshooting Video Tutorial]

## Your live site

**My live site shows Add this domain to MemberFrame.** The domain your site is on is not in **Profile**, **Site Domains** yet. The card names the exact address, so add that address, including `www.` if it has it, then reload the page. Read [How to add your site's domain](03-how-to-add-your-site-domain.md) for the steps.

**I cannot add my domain.** MemberFrame checks that a website is published at the address before it saves it. Check the spelling, publish your site in Framer, and try again. Copy the address from Framer's **Publish** menu so it matches exactly.

**My custom domain does not work but my Framer address does.** Each domain is added on its own, so add your custom domain in **Site Domains** as well. If MemberFrame has already seen it, it shows under **Seen on your site** with an **Add** button.

**The Home tab says Add your domain to go live.** Your **Site Domains** list is empty, so your live site cannot sign up, sign in, or take payments yet. Click **Add domain** in the banner to fix it.

## The plugin and components

**A change in the plugin does not show.** Close the plugin and open it again, then check again. This also makes sure you have the newest version of every screen.

**A component looks old or is missing a new setting.** Pick the component in the **Builder** and click **Add to canvas** again. This refreshes its file in your project, every copy on your pages updates with it, and your settings are kept.

**Add to canvas shows Framer is compiling... for a while.** The first component in a new project takes Framer longer to compile, so keep the plugin open and wait. If **Create Pages** says **Pages created, some components not placed**, drag each named component onto its page from **Assets**, then **Code**, once Framer has finished.

**Add to canvas says my session ended.** Sign in again from the account icon, then add the component again.

**Add to canvas says this project belongs to another MemberFrame account.** The project was connected with a different account, so sign out in **Profile** and sign in with the account that connected it.

**The plugin says Connect this project first.** Click the account icon at the top right and sign in, so the project is connected to your MemberFrame account.

**The plugin is signed out on another computer, or for a teammate.** Your sign in is kept in the browser you used, for each project, so sign in once more on the new computer. A teammate signs in with their own account. Your site, members, and settings are all kept.

**Profile shows Link This Project.** You are signed in, but this project is not linked to a site yet, for example a duplicated project. Click **Link This Project** to link it to your account.

**Components are locked or blurred.** Your free trial or your MemberFrame plan has ended, or the plugin is signed out. Open the account screen and sign in or choose a plan, and everything will come back.

**The pricing table shows sample plans on the canvas.** The plugin could not reach your site's data. Check that you are signed in, because your published site always shows your real tiers.

**My component's colors look different from before.** Components no longer have a **Theme** setting and always start in a light style. Set the colors you want in **Colors** in Framer's right sidebar.

## Locks and paywalls

**A locked page opens for everyone.** Check that the Route Shield script is in Framer's **Site Settings**, under **Custom Code**, in **End of head tag**, and that you published after adding it. Then test in a private window, because your normal window may be signed in as a member.

**A section lock does nothing.** Check that the layer has the **MemberFrameLocks** code override with your lock's name, then test in Framer's **Preview** or on your published site, because locks never run on the canvas.

**The Soft Paywall does not lock my article.** Make sure the Soft Paywall sits directly below the article in the same stack, with nothing in between, and test on your published site or in **Preview**.

**The paywall locks too early or too late.** Check **Free Articles** and **Reset Window**. A private window starts a new count, and a signed-in member is counted on their account instead of their device.

## Tiers and payments

**Another tier already uses that name.** Each tier needs its own name and ID, so choose a different name.

**A tier cannot be deleted.** Members are still on it, so move them to another tier in **Manage**, **Members** first, or untick **Visible to members** to hide it instead. The Free tier can never be deleted.

**A gateway is not offered at checkout.** The gateway must be connected in the current mode, **Test** or **Live**, its switch must be on, and it must be able to sell in your site currency. Razorpay sells in INR only, and Lemon Squeezy sells in your Lemon Squeezy store's currency.

**A payment went through but the member's tier did not change.** Check the gateway's webhook. For Razorpay, add the **Webhook URL** and the listed events in your Razorpay dashboard yourself, using the same secret you pasted into MemberFrame.

**The Go live button does not show.** Connect at least one gateway with its live keys while the switch is on **Live**, and the banner with **Go live** will appear.

## Sign in and email

**A member gets no email code.** Email code sign in only works for existing members, so check the address in **Manage**, **Members**. Ask the member to check their spam folder and to wait 60 seconds before asking for a new code.

**Social sign in fails.** Check that the **Redirect URL** in the provider's app matches the one in the provider's popup exactly, and that the provider's switch is on in **Settings**, **Integration**.

**My sign in popup opens on page load but not from my button.** **Trigger ID** only works when **Opens** is **On Click**. Add a second copy of the component set to **On Click**, for example inside your **Navigation** component, and link your button to `#sign-in`.

**A member cannot remember how they signed up.** Open them in **Manage**, **Members** to see their **Sign-in methods**, or click **Send magic link** to email them a one-click sign-in link.

**A member cannot unlink their last social account.** The last way a member can sign in can never be removed. They set a password first in the **Security** section of their dashboard, then they can unlink it.

**A member cannot delete their account.** Their plan still renews, so they cancel it in the **Membership** section of their dashboard first, then delete the account.

**Emails do not come from my address.** Check that the **Custom SMTP** switch is on in **Settings**, **Config**, and send a test email from its popup to see the real result.

## Frequently asked questions

**Do I need to publish again after changing a lock?** No. Page locks and section locks take effect on your live site as soon as you save them. You only publish when you add the Route Shield, add a component, or pick a section lock on a new layer.

**Do I need to publish again after adding a domain?** No. A domain works on your live site as soon as it is added, so reload the page on your site to see the change.

**Can I use one page for sign in and sign up?** Yes. Put the **Member Auth** component on your login page and set **Sign up page** to the same address as **Login page** in **Settings**, **Config**.

**Can I make my site invite-only?** Yes. Untick **Allow new sign ups** in **Settings**, **Config**, and keep the social sign-in buttons off on your forms, because social sign in can still create new accounts.

**What happens to a member when their paid plan ends?** They go back to your Free tier, so they keep their account and can buy again at any time.

**Does changing a member's tier in Manage change their billing?** No. It changes their access only. Use **Revoke access** to cancel their subscription, or change it in your gateway's dashboard.

**Can members delete their own account?** Yes, from the **Security** section of the Member Dashboard, once their plan no longer renews. Turn off **Delete Account** in the dashboard's **Sections** if you would rather they contact you.

**Can I translate the components into another language?** Yes. Select a component and open **Labels** in Framer's right sidebar, which holds every word the component shows your visitors, so you can rewrite or translate each one.

**How do I see the setup steps again?** Click **Setup guide** under **Quick Start** on the **Home** tab, which also shows how many of the seven steps are done.

## What to read next

- [Getting Started with MemberFrame](01-getting-started.md)
- [How to add your site's domain](03-how-to-add-your-site-domain.md)
- [How to lock a page](11-how-to-lock-a-page.md)
