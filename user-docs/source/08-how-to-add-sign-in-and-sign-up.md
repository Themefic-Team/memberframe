# How to Add Sign In and Sign Up

MemberFrame has five components for accounts. Use **Member Auth** when you want one form that does everything, or the four single-purpose components when you want a separate page for each step. This page explains how to add them, what every setting does, and what your visitors will see.

## Video tutorial

[Add Sign In and Sign Up Video Tutorial]

## Choose the right component

| Component | What it shows |
| --- | --- |
| **Member Auth** | Sign in, sign up, forgot password, and email code sign in, switching in place inside one form. It can also open as a popup over any page. |
| **Member Login** | Sign in with a password or with an email code, with links to your sign up and reset pages. |
| **Member Registration** | The sign up form only, with a link back to sign in. |
| **Password Reset** | Asks for an email address, then lets the member choose a new password from the emailed link. |
| **OTP Verification** | Sign in with an emailed six-digit code only, with no password. |

If you used **Predefined Pages** in the Builder, these components are already on your sign in, sign up, and reset pages.

## Step 1: Add the component

Open the page in Framer, then in the plugin click **Builder**, pick the component, and click **Add to canvas**. The form will appear on the page.

[Add Member Auth On Canvas Screenshot]

## Step 2: Choose how it appears

Select the component and look at Framer's right sidebar. **Display Mode** decides where the form shows.

- **Inline On Page** shows the form in the page, where you placed it.
- **Modal Overlay** shows the form as a popup over the page.

When you choose **Modal Overlay**, **Opens** decides when the popup appears: **On Click**, **On Page Load** after a **Delay**, or **On Scroll** at a **Scroll Depth**. To open it from your own button, set the button's link to `#sign-in` or name its layer sign-in, which works whichever **Opens** option you choose. Turn on **Once Per Visit** so the popup does not show again after a visitor closes it.

[Add Modal Overlay Settings Screenshot]

### Open the popup from your menu on every page

You only need to add the popup once. Open your **Navigation** component and put the component inside it, set to **Modal Overlay**, then set its **Position** to **Absolute** so it takes no room in the menu. Set the menu's **Login** button link to `#sign-in`. Every page that shows your menu can now open the popup. If your menu has separate tablet and phone variants, add the component to each one.

While you design the menu, the popup's card covers it on the canvas. Turn **Show On Canvas** off to show a small label in its place instead. Your live site is not affected.

## Step 3: Choose the sign-in options

| Setting | What it does |
| --- | --- |
| **Headline** and **Welcome Message** | The title of the form and the short line under it. |
| **Email Sign In** | Off hides the email form so only the social buttons show. |
| **Google**, **Apple**, **GitHub**, **Discord** | Shows each social sign-in button. Set the provider up in **Settings**, **Integration** first. |
| **Password Auth** | On, members can use a password. Off, they sign in with an email code only. |
| **Default Method** | Which form shows first: **Email & Password** or **Passwordless Code**. Members can switch with a link. |
| **Sign In Page**, **Sign Up Page**, **Reset Page**, **Code Sign In Page** | Where the links on the form go. On **Member Login**, if **Code Sign In Page** is empty, the code form opens inside the same card. |

Some settings only appear on the components that use them. You can style the form with the settings described in [How to add and style a component](05-how-to-add-and-style-a-component.md).

## What your visitors will see

- **Sign up:** the visitor types their name, email, and password, then types the confirmation code that is emailed to them. Their account is ready once the code is entered, and they start on your Free tier.
- **Sign in:** the member signs in with their password, an email code, or a social button, then lands on your **After sign in** page.
- **Forgot password:** the member types their email and gets a reset link that works for 15 minutes. It opens your **Reset page**, where they choose a new password that follows your password rules.
- **Locked page:** a visitor who was sent to sign in from a locked page goes back to that page after signing in.

## How email code sign in works

A member types their email and gets a six-digit code, then types the code to sign in, with no password needed. Signing in this way also confirms their email address.

- A code is only sent to an address that already has an account. Someone without an account sees the same message, but no email is sent, so nobody can use the form to find out who your members are.
- A code works for 10 minutes, and a new one can be requested after 60 seconds.
- After 3 wrong tries the code stops working, so the member needs to request a new one.

## Check that it works

Publish your site and open your sign up page in a private window. Sign up with a new email address, enter the code from your inbox, and check that you land on your **After sign in** page and appear in **Manage**, **Members**.

> Test in a private window, because your normal browser window may already be signed in.

## What to read next

- [How to turn on social sign in](09-how-to-turn-on-social-sign-in.md)
- [How to set up your membership pages](03-how-to-set-up-your-membership-pages.md)
- [How to add a member dashboard](14-how-to-add-a-member-dashboard.md)
