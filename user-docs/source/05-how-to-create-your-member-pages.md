# How to Create Your Member Pages

A membership site needs a few standard pages: one to sign in, one to sign up, one to reset a password, a dashboard for members, and a pricing page. MemberFrame can create all of them for you in one click, with the right component already placed on each page and your site's own header and footer around it.

## Before you start

Sign in to the plugin from the account icon, because components placed on the new pages need your account to reach your members. The pages are created at the addresses in **Settings**, then **Config**, and you can change those first if you want different addresses, as shown in [How to set up your membership pages](04-how-to-set-up-your-membership-pages.md).

## Video tutorial

[Add Create Member Pages Video Tutorial]

## Step 1: Open Predefined Pages

Make sure the Framer canvas is open, then click the **Builder** tab and scroll down to **Predefined Pages**. The badge next to the heading shows how many pages you have ticked out of the ones still to create, for example **5 of 5 to create**.

[Add Predefined Pages Screenshot]

## Step 2: Tick the pages you want

Each row shows the page, its address, and the component it will hold.

| Page | Component placed on it |
| --- | --- |
| **Sign in / Login** | Member Login |
| **Sign up / Registration** | Member Registration |
| **Reset password / OTP** | Password Reset |
| **Member dashboard** | Member Dashboard |
| **Member pricing** | Member Pricing |

Tick the pages you need. A page that already exists in your project shows **Already exists** and is skipped, so you never get a second copy.

## Step 3: Create the pages

Click **Create Pages**. The button shows how many pages it will create, for example **Create 5 Pages**, and while it works it tells you what it is doing, such as **Saving components...** and **Adding component 2 of 5**, so you can see it is still busy.

[Add Creating Pages Screenshot]

When it finishes, a message will confirm the new pages, and a second message, **Page paths saved in Settings**, will confirm that the new addresses are now your sign in, sign up, reset, and after sign in pages in **Settings**, **Config**. Every component on the new pages already links to those addresses.

> If you see **Open the canvas first**, switch Framer to the canvas and try again, because pages can only be added while the canvas is open.

## How the new pages look

MemberFrame borrows the header and footer from one of your existing pages, so a new page looks like the rest of your site, with the component placed between them.

If your project has no header and footer yet, for example a brand new project, each new page is set up to center its component in the middle of the page on desktop, tablet, and phone, with some space above and below it.

## Step 4: Style each page

Open each new page in Framer, select its component, and set its colors, fonts, and text in Framer's right sidebar. The next page explains every style setting.

## Check that it works

Look at the page list in Framer. You should see the new pages at the addresses from **Settings**, **Config**, and the badge in **Predefined Pages** should now read **All pages created**.

## Troubleshooting

**Pages created, some components not placed.** Framer was still compiling a component's file when MemberFrame tried to place it, which can take a while in a new project. Wait until Framer finishes, then open **Assets**, then **Code**, in Framer and drag the named component onto its page.

**The page has no Desktop frame yet.** Open the page in Framer so it gets its Desktop frame, then add the component from the **Builder** with **Add to canvas**.

**Your MemberFrame session ended.** Sign in again from the account icon. A page that was already created is skipped the next time you click **Create Pages**, so open it in Framer and add its component from the **Builder** with **Add to canvas** instead.

## What to read next

- [How to add and style a component](06-how-to-add-and-style-a-component.md)
- [How to set up your membership pages](04-how-to-set-up-your-membership-pages.md)
- [How to create and price your tiers](07-how-to-create-and-price-your-tiers.md)
