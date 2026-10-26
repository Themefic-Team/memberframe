# Discord

Discord sign in suits gaming and community audiences, because your members can join with the account they already use every day. You create a free application on Discord and paste its ID and secret into MemberFrame.

## Before you start

You need a Discord account.

## Video tutorial

[Add Discord Sign In Setup Video Tutorial]

## Step 1: Copy the Redirect URL from MemberFrame

In the plugin, click **Settings**, then **Integration**, and click the **Discord sign in** card under **Sign in**. Copy the **Redirect URL** with the copy button next to it.

[Add Discord Sign In Popup Screenshot]

## Step 2: Create the application on Discord

1. Open discord.com/developers/applications and click **New Application**.
2. Give it a name that your members will recognize, and create it.
3. On **General Information**, copy the **Application ID**.

## Step 3: Add the redirect and copy the secret

1. Open **OAuth2** in the menu on the left.
2. Under **Redirects**, click **Add Redirect** and paste the **Redirect URL** from MemberFrame, then save your changes.
3. Under **Client Secret**, click **Reset Secret** and copy the new secret.

[Add Discord OAuth2 Screenshot]

## Step 4: Paste the values into MemberFrame

Back in the **Discord sign in** popup, paste the **Application ID** and the **Client secret**, then click **Save settings**. Check that the switch on the card is on.

## Step 5: Show the Discord button

Select your **Member Auth** or **Member Login** component in Framer, turn on **Discord** in the right sidebar, and publish your site.

## Good to know

If a visitor's Discord email address is not confirmed and an account with that email already exists on your site, the sign in is refused to keep that account safe. The visitor can confirm their email in Discord, or sign in another way.

## Check that it works

Open your sign in page on your published site in a private window and click the Discord button. After you authorize the app, you should come back to your site signed in.

## What to read next

- [How to turn on social sign in](../09-how-to-turn-on-social-sign-in.md)
- [GitHub](05-github.md)
- [Google](04-google.md)
