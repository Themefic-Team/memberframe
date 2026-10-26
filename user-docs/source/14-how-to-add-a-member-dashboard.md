# How to Add a Member Dashboard

The Member Dashboard is your members' own account page. It shows who they are, their tier, their billing, and their profile answers, and it lets them change or cancel their plan and sign out without asking you for help.

## Before you start

Place the dashboard on the page members land on after they sign in, which is your **After sign in** page in **Settings**, **Config**, usually `/dashboard`. If you used **Predefined Pages**, it is already there.

## Video tutorial

[Add Member Dashboard Video Tutorial]

## Step 1: Add the dashboard

In the plugin, click **Builder**, pick **Member Dashboard**, and click **Add to canvas** while your dashboard page is open.

[Add Member Dashboard Screenshot]

## Step 2: Choose what it shows

Select the dashboard and turn its parts on or off in Framer's right sidebar.

| Setting | What it does |
| --- | --- |
| **Headline** | The title at the top. |
| **Signed Out Text** | What a signed-out visitor sees instead of the dashboard, with a sign in link. |
| **Avatar**, **Email Row**, **Membership Row**, **Status Row** | Turn each part of the account summary on or off. |
| **Profile Form** | Lets members fill in and edit their answers to your profile questions. |
| **Billing** | Shows the member's plan, price, and next renewal, with buttons to manage it. |
| **Payment History** | Lists the member's past payments, each with a receipt. |
| **Allow Cancel** | Lets members cancel their plan themselves. |
| **Sign Out**, **Sign Out Style** | Shows the sign out button as **Outline**, **Filled**, or **Text**. |
| **Sign In Page**, **After Sign Out** | Where the sign in link goes, and where members land after signing out. |
| **Accent Color**, **Corner Radius** | Your brand color and how rounded the card is. |

You can change every word on the dashboard in **Labels**, and style it with the shared settings described in [How to add and style a component](05-how-to-add-and-style-a-component.md).

## What your members can do

- **See their account:** their email, their tier, and their status, such as **Active** or **Payment failed**.
- **Update their profile:** answer your profile questions and click **Save profile**.
- **Manage billing:** see when their plan renews, click **Manage billing** to open their subscription, and update their payment method if a payment failed.
- **Change plan:** click **Upgrade** to move to a higher tier, and see the credit for the unused part of their current plan before they pay. A **Downgrade** happens at their next renewal, so nothing is charged today, and they can undo it until then.
- **Cancel or resume:** click **Cancel plan** to stop renewing. They keep their access until the end of the period they paid for, and they can click **Resume plan** before then to keep it going.
- **See payment history:** every payment with its amount, date, and **Receipt** link.

## Check that it works

Sign in on your published site as a test member and open your dashboard page. You should see your tier and email, and after a test purchase, your billing details and payment history.

## What to read next

- [How to ask members profile questions](17-how-to-ask-members-profile-questions.md)
- [How to add a pricing table](15-how-to-add-a-pricing-table.md)
- [How to manage your members](18-how-to-manage-your-members.md)
