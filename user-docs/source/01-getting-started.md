# Getting Started with MemberFrame

MemberFrame turns your Framer website into a membership site. Visitors can create an account, sign in, buy a tier, and see content that only members can see, and you set all of it up inside Framer without writing code. This page walks you through the first setup from start to finish, so you know which page to read for each step.

## Before you start

You need a Framer project that you can edit and publish. Payments, social sign in, and custom emails each need an account with that service, but you can add them later, so you only need your Framer project to begin.

## Video tutorial

[Add Getting Started Video Tutorial]

## Step 1: Open the plugin in your project

Open your project in Framer, open the **Plugins** menu, and search for **MemberFrame**, then open it. The plugin will open in a small window at the top right of the canvas.

[Add MemberFrame Plugin Window Screenshot]

The plugin has five tabs across the top and an account icon at the top right. Here is what each one is for, so you know where to look later.

| Tab | What you do there |
| --- | --- |
| **Home** | See the quick start steps, and open the **Guide**, **Contact us**, and **Changelog** links. |
| **Builder** | Choose a component, preview it, add it to your page, and create your member pages. |
| **Manage** | Run your membership day to day in three views: **Members**, **Tiers**, and **Payments**. |
| **Settings** | Set site-wide rules in four views: **Config**, **Page locks**, **Fields**, and **Integration**. |
| **Reports** | See your members, revenue, and subscriptions, and export them as CSV or PDF. |
| Account icon | Sign in to MemberFrame, start your free trial, and manage your MemberFrame plan. |

## Step 2: Create your account and start your free trial

Click the account icon at the top right, or click **Start free trial** on the **Home** tab, and create your MemberFrame account in the browser tab that opens. When you come back to Framer, your 7-day free trial will start and this project will be connected to your account, which is where your members and settings are stored.

Read [How to create your account and start your free trial](02-how-to-create-your-account-and-start-your-free-trial.md) for the details.

## Step 3: Choose your membership pages

Go to **Settings**, then **Config**, and check the addresses of your sign in, sign up, and reset pages, and where members land after they sign in and sign out. Every component and lock uses these addresses, so set them before you create any pages. Click **Save settings** when you are done.

## Step 4: Create your member pages

Go to **Builder** and scroll down to **Predefined Pages**, tick the pages you want, and click **Create Pages**. MemberFrame will add the sign in, sign up, reset password, dashboard, and pricing pages to your project with the right component already on each one.

## Step 5: Create your tiers

Go to **Manage**, then **Tiers**, and create your Free tier first, because it is where every new member starts. Then add one or more paid tiers with their prices.

## Step 6: Connect a payment gateway in Test mode

Go to **Manage**, then **Payments**, keep the switch on **Test**, and connect Stripe, Lemon Squeezy, or Razorpay with its test keys. In Test mode nobody is charged, so you can try every purchase safely.

## Step 7: Add the extras you need

These are optional, so add only the ones that fit your site.

- Social sign in with Google, Apple, GitHub, or Discord, in **Settings**, then **Integration**.
- Profile questions for your members, in **Settings**, then **Fields**.
- Emails sent from your own address, in **Settings**, then **Config**, then **Email**.
- Webhooks that send member events to Zapier, Make, or your own server, in **Settings**, then **Integration**.

## Step 8: Protect your content

Paste the Route Shield script into your site once, then lock pages, lock sections, add a Soft Paywall to your articles, or share files with a Protected Download. Each of these has its own page in these docs.

## Step 9: Publish and test, then go live

Publish your site in Framer and test everything in a private browser window, using a test card for purchases. When everything works, switch **Manage**, **Payments** to **Live**, connect your live keys, and click **Go live**, so buyers will be charged for real from then on.

> Always finish testing in Test mode before you go live. In Live mode buyers pay real money, and purchases made in Test mode stop giving access.

## Check that it works

Open your published site in a private window, sign up as a new member, and open a locked page. You should land on the page you chose in Settings, and the new member should appear in **Manage**, then **Members**.

## What to read next

- [How to create your account and start your free trial](02-how-to-create-your-account-and-start-your-free-trial.md)
- [How to set up your membership pages](03-how-to-set-up-your-membership-pages.md)
- [How to create your member pages](04-how-to-create-your-member-pages.md)
