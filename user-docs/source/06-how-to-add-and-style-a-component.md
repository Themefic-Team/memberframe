# How to Add and Style a Component

Components are the ready-made MemberFrame blocks you place on your pages, such as sign in forms, pricing tables, and paywalls. This page shows you how to add any component to a page and how to style it so it matches your site.

## Video tutorial

[Add Add and Style a Component Video Tutorial]

## The components

Each component has a badge in the Builder that says where it usually goes.

| Component | What it does | Where it usually goes |
| --- | --- | --- |
| **Member Auth** | Sign in, sign up, password reset, and email code sign in, all in one form. | Login page |
| **Member Login** | Sign in with a password or with an email code. | `/login` |
| **Member Registration** | A sign up form for new members. | `/signup` |
| **Password Reset** | Asks for an email, then sets a new password from the emailed link. | `/reset-password` |
| **OTP Verification** | Sign in with a six-digit code sent by email, with no password. | Login page |
| **Member Dashboard** | A full account area: overview, plan, billing, bookmarks, profile, and security. | `/dashboard` |
| **Member Pricing** | Your tiers and prices, with a button that starts checkout. | `/pricing` |
| **Soft Paywall** | A few free articles, or a read more teaser, then a lock card. | Any page or CMS page |
| **Protected Download** | A download button that only the right members can use. | Any page |
| **Bookmark Button** | Lets members save a page or a CMS item. | Cards and pages |
| **Bookmarks Tray** | A drawer listing everything a member saved. | Navigation bar |

## Step 1: Choose a component

Click the **Builder** tab and pick the component from the **Component** list. A live preview will show what it looks like with your real tiers and prices.

[Add Builder Component Preview Screenshot]

## Step 2: Add it to your page

Open the page you want in Framer, then click **Add to canvas** in the plugin. The component will appear on the page, and the note under the button reminds you to finish its setup in Framer's right sidebar.

The first time you add a component in a new project, Framer needs a moment to compile its file, so the button may show **Framer is compiling...** for a few seconds. Keep the plugin open and the component will appear when Framer is ready.

> If you see **Connect this project first**, sign in from the account icon before you add components, because a component added before that cannot reach your members.

## Step 3: Set it up in Framer's right sidebar

Select the component on the canvas. Framer's right sidebar will show its settings, such as which buttons to show and which pages it links to. Each component's own settings are explained on its page in these docs.

[Add Component Sidebar Screenshot]

## Step 4: Style it

Every component shares the same style settings in the right sidebar, so once you know them on one component you know them on all of them. Components start in a light style, and you change any color you like in **Colors**.

| Setting | What it does |
| --- | --- |
| **Accent Color** | The color of buttons, links, and highlights. Match it to your brand, and you can pick one of your Framer color styles. |
| **Corner Radius** | How rounded the card and buttons are, in pixels. |
| **Colors** | Your own **Background**, **Text**, **Muted text**, **Border**, **Field**, and **Button text** colors. Each one is optional, and an empty one keeps the light default. |
| **Typography** | Pick a **Font** from your site's fonts, which applies as soon as you choose it, and set the **Text size** from 70% to 160%. Without a font, the component uses Inter. |
| **Layout** | The **Padding** inside the card, the **Spacing** between its parts, the **Border** width, and the **Shadow**. |
| **Spacing** | The **Margin** around the component, and **Custom padding** when you want different padding on each side. |
| **Labels** | Every word the component shows, so you can change the wording or translate it. |

The sign in components, the Member Dashboard, and the Soft Paywall grow to fit their content, so raising the **Margin** makes their frame taller instead of squeezing the card. The other components keep the fixed size you give them in Framer.

## Keep components up to date

When MemberFrame is updated, select the component in the **Builder** and click **Add to canvas** again. This refreshes the component's file in your project, every copy on your pages updates with it, and your settings are kept, so you can delete the extra copy that was just added.

## If your MemberFrame plan ends

During your free trial, components on your published site show a small **Made with Framefic** mark in the bottom right corner, which goes away when you upgrade. If your trial or plan ends, or you sign the plugin out, components are locked on the canvas, and on your live site their content is blurred under an upgrade message until you choose a plan.

## Check that it works

Click Framer's **Preview** button. The component should show with your colors and fonts, and with your real tiers and prices where it shows them. On your published site, it should look the same, as long as your domain is in **Profile**, **Site Domains**.

## Troubleshooting

**Add to canvas shows an error.** Read the message, because it tells you what to do.

| Message | What to do |
| --- | --- |
| **Your MemberFrame session ended** | Sign in again from the account icon, then add the component. |
| **This project belongs to another MemberFrame account** | Sign in with the account that connected this project. |
| **Too many components were added in a minute** | Wait a moment, then try again. |
| **MemberFrame does not know this project under the signed-in account** | Sign out from **Profile**, sign in again in this project, then add the component. |

**My live site shows Add this domain to MemberFrame.** Add the domain shown on the card in **Profile**, **Site Domains**, then reload the page, as explained in [How to add your site's domain](03-how-to-add-your-site-domain.md).

## What to read next

- [How to add sign in and sign up](09-how-to-add-sign-in-and-sign-up.md)
- [How to add a pricing table](16-how-to-add-a-pricing-table.md)
- [How to manage your MemberFrame plan](23-how-to-manage-your-memberframe-plan.md)
