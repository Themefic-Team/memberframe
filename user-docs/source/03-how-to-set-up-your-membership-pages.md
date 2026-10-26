# How to Set Up Your Membership Pages

This screen tells MemberFrame which page of your site does which job, such as where visitors sign in and where members land afterwards. It also sets your password rules and whether new visitors can create an account. Set it up before you create your member pages, because the Builder creates pages at these addresses.

## Video tutorial

[Add Set Up Membership Pages Video Tutorial]

## Step 1: Open Settings, Config

Click the **Settings** tab, then click **Config** in the bar under the tabs. The **Membership** section is at the top.

[Add Settings Config Screenshot]

## Step 2: Check your page addresses

Each field holds the address of a page on your site, starting with a slash, for example `/login`. Hover the small info icon next to a label to see a short reminder of what it is for.

| Setting | What it does |
| --- | --- |
| **Login page** | Where a signed-out visitor is sent to sign in. Page locks, paywalls, and downloads send visitors here. |
| **Sign up page** | Where new visitors create an account. Leave it the same as the login page if one page does both. |
| **Reset page** | The page that the password reset email opens, so members can choose a new password. |
| **After sign in** | Where a member lands after signing in, usually `/dashboard`. |
| **After sign out** | Where a member lands after signing out, usually your home page `/`. |

If an address does not start with one slash or points to another website, a message will appear under the fields, and the address will need fixing before you can save.

## Step 3: Choose whether new visitors can sign up

Tick **Allow new sign ups** to let visitors create an account. Untick it if your site is invite-only, so the sign up form refuses new accounts while existing members can still sign in.

> Signing in with an email code is only for members who already have an account, so it never creates a new one. Sign in with Google, Apple, GitHub, or Discord can still create a new account even when **Allow new sign ups** is off, so turn off those buttons on your sign in component if your site is invite-only.

## Step 4: Set your password rules

Set **Minimum password length** to a number from 8 to 64, then tick the extra rules you want: **Require a number**, **Require an uppercase letter**, **Require a lowercase letter**, and **Require a symbol**. The line under the rules sums them up in plain words, so you can check them at a glance.

[Add Password Rules Screenshot]

These rules apply to sign up and password reset on every form on your site, without publishing again. Signing in is not affected, so a member whose password is older than a new rule can still sign in and will meet the rule at their next reset.

## Step 5: Save your settings

Click **Save settings** at the bottom of the screen. A message will confirm that your settings are saved, and the new addresses and rules will apply straight away.

## Check that it works

Go to **Builder** and look at **Predefined Pages**. The page addresses listed there should match the ones you just saved.

## What to read next

- [How to create your member pages](04-how-to-create-your-member-pages.md)
- [How to send emails from your own address](19-how-to-send-emails-from-your-own-address.md)
- [How to add sign in and sign up](08-how-to-add-sign-in-and-sign-up.md)
