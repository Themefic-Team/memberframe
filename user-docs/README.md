# MemberFrame User Docs

Help documentation for Framer creators who use MemberFrame, written to `instruction/Doc-Instruction.md`. The pages are written in Markdown in `source/` and built into Microsoft Word files.

| File | What it is |
| --- | --- |
| `MemberFrame-Help-Docs.docx` | Every page in one Word document, with a contents list and links between pages. |
| `pages/*.docx` | One Word file per page, to paste into its own Google Docs tab. The `99-integrations` folder holds the child tabs under **Integrations**. |
| `source/*.md` | The pages themselves. Edit these, never the `.docx` files. |

Rebuild after any change: `npm run docs:user`. The build also checks the writing rules it can check by machine (no dashes, no "we", "us", or "our", a video placeholder and "What to read next" on every help page, placeholder format, and links between pages), and stops with a list if one fails.

**Tone:** Friendly and helpful.

## Reading Order

1. [MemberFrame Highlighted Features](source/00-highlighted-features.md)
2. [Getting Started with MemberFrame](source/01-getting-started.md)
3. [How to Create Your Account and Start Your Free Trial](source/02-how-to-create-your-account-and-start-your-free-trial.md)
4. [How to Set Up Your Membership Pages](source/03-how-to-set-up-your-membership-pages.md)
5. [How to Create Your Member Pages](source/04-how-to-create-your-member-pages.md)
6. [How to Add and Style a Component](source/05-how-to-add-and-style-a-component.md)
7. [How to Create and Price Your Tiers](source/06-how-to-create-and-price-your-tiers.md)
8. [How to Take Payments](source/07-how-to-take-payments.md)
9. [How to Add Sign In and Sign Up](source/08-how-to-add-sign-in-and-sign-up.md)
10. [How to Turn On Social Sign In](source/09-how-to-turn-on-social-sign-in.md)
11. [How to Lock a Page](source/10-how-to-lock-a-page.md)
12. [How to Lock Part of a Page](source/11-how-to-lock-part-of-a-page.md)
13. [How to Add a Soft Paywall](source/12-how-to-add-a-soft-paywall.md)
14. [How to Share a Protected Download](source/13-how-to-share-a-protected-download.md)
15. [How to Add a Member Dashboard](source/14-how-to-add-a-member-dashboard.md)
16. [How to Add a Pricing Table](source/15-how-to-add-a-pricing-table.md)
17. [How to Let Members Save Bookmarks](source/16-how-to-let-members-save-bookmarks.md)
18. [How to Ask Members Profile Questions](source/17-how-to-ask-members-profile-questions.md)
19. [How to Manage Your Members](source/18-how-to-manage-your-members.md)
20. [How to Send Emails from Your Own Address](source/19-how-to-send-emails-from-your-own-address.md)
21. [How to Send Member Events with Webhooks](source/20-how-to-send-member-events-with-webhooks.md)
22. [How to Read and Export Your Reports](source/21-how-to-read-and-export-your-reports.md)
23. [How to Manage Your MemberFrame Plan](source/22-how-to-manage-your-memberframe-plan.md)
24. [Troubleshooting and FAQ](source/23-troubleshooting-and-faq.md)
25. Integrations
    - [Stripe](source/99-integrations/01-stripe.md)
    - [Lemon Squeezy](source/99-integrations/02-lemon-squeezy.md)
    - [Razorpay](source/99-integrations/03-razorpay.md)
    - [Google](source/99-integrations/04-google.md)
    - [GitHub](source/99-integrations/05-github.md)
    - [Apple](source/99-integrations/06-apple.md)
    - [Discord](source/99-integrations/07-discord.md)

## Terms Used in These Docs

Use these words, and only these, for these things on every page.

| Term | Meaning |
| --- | --- |
| The plugin | The MemberFrame window inside Framer. |
| Component | A ready-made MemberFrame block you place on a page, such as Member Pricing. |
| Framer's right sidebar | Where you set a selected component's settings in Framer. |
| Popup | The window that opens over the plugin when you click a card, such as a tier or a gateway. |
| Visitor | Anyone on your site who is not signed in. |
| Member | Someone with an account on your site. |
| Tier | A membership level, such as Free or Gold. A few plugin labels say plan, such as **All plans** and **Any paid plan**, and these mean tiers. |
| Free tier | The one tier every new member starts on, at level 0. |
| Level | The number that orders tiers. A higher level includes what lower levels can see. |
| Payment gateway | Stripe, Lemon Squeezy, or Razorpay. Shortened to gateway. |
| Test mode, Live mode | Test charges nothing; Live charges real money. |
| Site currency | The one currency every tier is priced in. |
| Page lock | A lock on a page, or every page under a path. |
| Section lock | A lock on chosen layers of a page, picked as a code override in Framer. |
| Route Shield | The script, added to your site once, that makes page and section locks work. |
| Soft Paywall | The component that shows the start of an article, then a lock card. |
| Profile field | A question members answer on their dashboard. |
| Webhook | A message sent to another service when something happens to a member. |
| Your MemberFrame plan | The subscription you pay for the plugin: Monthly, Yearly, or Lifetime. |
| Publish | Framer's Publish button, which updates your live site. |

## Importing Into Google Docs With Tabs

1. In Google Docs, add one tab for each page, in the reading order above, and child tabs under **Integrations**.
2. Open each file from `pages/` in Google Docs (File, Open, Upload), select all, copy, and paste it into its tab.

Or open `MemberFrame-Help-Docs.docx` to get every page in one document.
