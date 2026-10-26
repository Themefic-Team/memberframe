# GitHub

GitHub sign in is a good fit when your audience is developers, because most of them already have a GitHub account. You create a free OAuth app on GitHub and paste its ID and secret into MemberFrame.

## Before you start

You need a GitHub account. The app can belong to your personal account or to an organization.

## Video tutorial

[Add GitHub Sign In Setup Video Tutorial]

## Step 1: Copy the Redirect URL from MemberFrame

In the plugin, click **Settings**, then **Integration**, and click the **GitHub sign in** card under **Sign in**. Copy the **Redirect URL** with the copy button next to it.

## Step 2: Create the OAuth app on GitHub

1. On GitHub, open **Settings**, then **Developer settings**, then **OAuth Apps**, and click **New OAuth App**.
2. Type an application name that your members will recognize, and your site's address as the **Homepage URL**.
3. Paste the **Redirect URL** from MemberFrame into **Authorization callback URL**.
4. Click **Register application**.

[Add GitHub OAuth App Screenshot]

## Step 3: Copy the Client ID and a client secret

On the app's page, copy the **Client ID**. Then click **Generate a new client secret** and copy the secret straight away, because GitHub only shows it once.

## Step 4: Paste the values into MemberFrame

Back in the **GitHub sign in** popup, paste the **Client ID** and the **Client secret**, then click **Save settings**. Check that the switch on the card is on.

[Add GitHub Sign In Popup Screenshot]

## Step 5: Show the GitHub button

Select your **Member Auth** or **Member Login** component in Framer, turn on **GitHub** in the right sidebar, and publish your site.

## Check that it works

Open your sign in page on your published site in a private window and click the GitHub button. After you authorize the app, you should come back to your site signed in.

## What to read next

- [How to turn on social sign in](../09-how-to-turn-on-social-sign-in.md)
- [Google](04-google.md)
- [Discord](07-discord.md)
