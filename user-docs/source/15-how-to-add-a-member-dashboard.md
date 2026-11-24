# How to Add a Member Dashboard

The Member Dashboard is a full account area for your members, right on your own site. A menu leads to separate sections for their overview, membership, billing, bookmarks, profile, and security, so members can change their plan, find their receipts, update their details, and keep their account safe without asking you for help.

## Before you start

Place the dashboard on the page members land on after they sign in, which is your **After sign in** page in **Settings**, **Config**, usually `/dashboard`. If you used **Predefined Pages**, it is already there.

## Video tutorial

[Add Member Dashboard Video Tutorial]

## Step 1: Add the dashboard

In the plugin, click **Builder**, pick **Member Dashboard**, and click **Add to canvas** while your dashboard page is open. It lands 960 pixels wide, and its height grows to fit the section that is showing.

[Add Member Dashboard Screenshot]

The menu sits in a sidebar on the left when the dashboard is wide enough, and it moves to a row of tabs across the top on narrow screens, such as phones. You choose this in **Navigation**, described in Step 3.

## The sections

| Section | What members see and do |
| --- | --- |
| **Overview** | A greeting with their name and photo, their tier badge, three tiles for their **Plan**, **Saved items**, and **Member since** date, their current plan with a **Manage plan** button, and the three items they saved most recently. |
| **Membership** | Their plan, its price, and when it renews, or that it gives lifetime access. They can upgrade, downgrade, cancel, resume, or undo a scheduled change. A member on your Free tier sees **See plans**, which opens your pricing page. |
| **Billing** | Their **Payment history** with a **Receipt** for each payment, a **Plans** history with credits for unused time, and a **Manage billing** button that opens their payment gateway's own billing page. |
| **Bookmarks** | Everything they saved with the Bookmark Button, with a search box, so they can open an item or **Remove** it. |
| **Profile** | Their photo, their name, their email, and your profile questions, with a **Save profile** button. |
| **Security** | Their password, the social accounts they sign in with, the devices they are signed in on, and **Delete account**. |
| **Sign out** | A sign out button at the bottom of the menu. |

## Step 2: Choose which sections show

Select the dashboard and open **Sections** in Framer's right sidebar. Each switch shows or hides one part of the dashboard.

| Setting | What it does |
| --- | --- |
| **Overview**, **Membership**, **Billing**, **Bookmarks**, **Profile**, **Security** | Shows or hides each section in the menu. If you turn them all off, **Overview** still shows. |
| **Photo Upload** | Lets members upload their own photo in **Profile**. |
| **Delete Account** | Lets members delete their own account in **Security**. |

[Add Dashboard Sections Screenshot]

## Step 3: Set up the menu and the canvas

| Setting | What it does |
| --- | --- |
| **Canvas Preview** | Which section the canvas shows, so you can design each one. Your live site ignores it. |
| **Default Section** | Where a member lands when they open the dashboard. |
| **Navigation** | **Auto** shows the sidebar when there is room and the top tabs when there is not. **Sidebar** and **Top** always use one of them. |
| **Headline** | The title of the dashboard. |
| **Signed Out Text** | What a signed-out visitor sees instead of the dashboard, with a sign in button. |

Choosing a section changes the page's address, for example to `/dashboard#account-billing`, so the browser's back button returns to the previous section. You can use these addresses in your own links to open a section directly, with `#account-overview`, `#account-membership`, `#account-billing`, `#account-bookmarks`, `#account-profile`, or `#account-security`.

## Step 4: Fine-tune what shows

These settings change smaller parts of the dashboard.

| Setting | What it does |
| --- | --- |
| **Avatar**, **Email**, **Membership Badge**, **Status** | Shows the member's photo, their email, their tier badge, and their status, such as **Active** or **Payment failed**. |
| **Profile Form** | Off hides the **Profile** section. |
| **Billing** | Off hides the **Membership** and **Billing** sections. |
| **Payment History** | Shows the member's past payments in **Billing**. |
| **Allow Cancel** | Lets members cancel their plan themselves. |
| **Sign Out**, **Sign Out Style** | Shows the sign out button as **Outline**, **Filled**, or **Text**. |
| **Sign In Page**, **After Sign Out** | Where the sign in button goes, and where members land after signing out. |
| **Accent Color**, **Corner Radius** | Your brand color and how rounded the dashboard is. |

You can change every word on the dashboard in **Labels**, including the names in the menu, and style it with the shared settings described in [How to add and style a component](06-how-to-add-and-style-a-component.md).

## What your members can do

- **Change plan:** in **Membership**, click **Upgrade** to move to a higher tier, and see the credit for the unused part of their current plan and the amount **Due today** before they click **Pay and upgrade**. A **Downgrade** happens at their next renewal, so nothing is charged today, and they can click **Undo** until then.
- **Cancel or resume:** click **Cancel plan** to stop renewing. They keep their access until the end of the period they paid for, and they can click **Resume plan** before then to keep it going.
- **Fix a failed payment:** when a renewal fails, the dashboard asks them to update their billing details by a date, and **Update payment** opens their gateway's billing page.
- **Find receipts:** in **Billing**, every payment shows its amount, its date, and a **Receipt** link.
- **Manage bookmarks:** in **Bookmarks**, search what they saved, open an item, or click **Remove**.
- **Update their profile:** in **Profile**, click **Upload photo** to add a PNG, JPEG, or WebP picture of up to 2 MB, edit their name, answer your profile questions, and click **Save profile**. Their email cannot be changed here, so they contact you if it needs changing.
- **Change their password:** in **Security**, type their current password and a new one, then click **Change password**. A member who signed up with a social account and has no password yet sees **Set password** instead. Changing the password signs them out on every other device.
- **Manage sign-in methods:** see each social account linked to their account and click **Unlink** to remove one. The last way they can sign in can never be removed, so they set a password first.
- **Manage devices:** see every device they are signed in on, with when it was last active, and sign out one device or click **Sign out everywhere**.
- **Delete their account:** click **Delete account**, type their email address to confirm, and click **Delete for good**. A member with a plan that still renews is asked to cancel it in **Membership** first.

Every action that removes something, such as unlinking an account, signing out a device, removing a photo, or deleting the account, asks the member to confirm first.

## Check that it works

Sign in on your published site as a test member and open your dashboard page. You should see the menu and your **Overview**, and after a test purchase, your plan in **Membership** and the payment in **Billing**. Open `/dashboard#account-security` to check that the address opens the **Security** section directly.

## What to read next

- [How to ask members profile questions](18-how-to-ask-members-profile-questions.md)
- [How to let members save bookmarks](17-how-to-let-members-save-bookmarks.md)
- [How to manage your members](19-how-to-manage-your-members.md)
