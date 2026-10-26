# How to Turn On Social Sign In

Social sign in lets visitors sign in with an account they already have: Google, Apple, GitHub, or Discord. Each provider needs a free developer app on the provider's own website, and then you paste two or three values from it into MemberFrame. This page shows the steps that are the same for every provider.

## Before you start

You need an account with the provider. Each provider has its own page under **Integrations** in these docs, with the exact steps to create its developer app.

## Video tutorial

[Add Social Sign In Video Tutorial]

## Step 1: Open the provider's popup

Click the **Settings** tab, then **Integration**. Under **Sign in**, click the provider's card, for example **Google sign in**. A popup will open with the fields for that provider and a **Setup guide** link to its page in these docs.

[Add Sign In Providers Screenshot]

## Step 2: Copy the Redirect URL

Click the copy button next to **Redirect URL**. This is the address the provider sends members back to after they sign in, and you will paste it into the provider's developer app.

[Add Redirect URL Screenshot]

## Step 3: Create the app at the provider

Follow the provider's page in these docs to create the developer app and paste the **Redirect URL** into it. Then copy the provider's ID and secret back into the popup.

## Step 4: Save and turn it on

Click **Save settings** at the bottom of the popup, and the card will show **Connected**. Then check that the switch on the card is on, because members can only use a provider while its switch is on. The switch saves straight away, so you can turn a provider off and on again without opening the popup.

> If a card shows **Update needed**, the address MemberFrame uses has changed. Open the card, click **Save settings**, and add the new **Redirect URL** to the provider's app.

## Step 5: Show the button on your sign in form

Select your **Member Auth** or **Member Login** component in Framer and turn on the provider's button, **Google**, **Apple**, **GitHub**, or **Discord**, in the right sidebar. Publish your site so visitors see the new button.

## How accounts are matched

- A visitor who signs in with a provider for the first time gets a new account on your Free tier.
- A member who later signs in with another provider, using the same confirmed email address, keeps the same account, so they never end up with two.
- In **Manage**, **Members**, a small mark next to a member's name shows which provider they signed up with, and their details show every linked provider.

> Social sign in can create a new account even when **Allow new sign ups** is off in **Settings**, **Config**. If your site is invite-only, keep the social buttons off on your sign in form.

## Check that it works

Open your sign in page in a private window and click the provider's button. After you approve, you should come back to your site signed in.

## What to read next

- [Google](99-integrations/04-google.md)
- [Apple](99-integrations/06-apple.md)
- [How to add sign in and sign up](08-how-to-add-sign-in-and-sign-up.md)
