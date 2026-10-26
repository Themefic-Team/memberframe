# Apple

Sign in with Apple lets visitors on iPhone, iPad, Mac, and the web sign in with their Apple Account. Apple's setup has a few more parts than the other providers, so this page takes you through each one in order.

## Before you start

You need a paid Apple Developer account, and your site's domain, for example yoursite.com.

## Video tutorial

[Add Apple Sign In Setup Video Tutorial]

## Step 1: Copy the Redirect URL from MemberFrame

In the plugin, click **Settings**, then **Integration**, and click the **Apple sign in** card under **Sign in**. Copy the **Redirect URL** with the copy button next to it.

## Step 2: Create an App ID and a Services ID

1. Sign in at developer.apple.com and open **Certificates, Identifiers & Profiles**, then **Identifiers**.
2. Create an **App ID**, or pick one you already have, and turn on **Sign In with Apple** for it.
3. Create a **Services ID**, for example `com.yoursite.memberframe`, and turn on **Sign In with Apple** for it too. This Services ID is what MemberFrame calls the **Services ID**.

[Add Apple Services ID Screenshot]

## Step 3: Configure the Services ID

Next to **Sign In with Apple** on the Services ID, click **Configure**. Choose your App ID, add your site's domain, and paste the **Redirect URL** from MemberFrame into **Return URLs**. Save your changes.

## Step 4: Create a key

1. Open **Keys** and create a new key with **Sign in with Apple** turned on, linked to your App ID.
2. Download the key file, which ends in `.p8`, and note its **Key ID**.
3. Find your **Team ID** in your Apple Developer account's **Membership details**.

> Apple lets you download the `.p8` file only once, so keep it somewhere safe.

## Step 5: Paste the values into MemberFrame

Back in the **Apple sign in** popup, fill in the fields, then click **Save settings** and check that the switch on the card is on.

| Field | What to paste |
| --- | --- |
| **Services ID** | The identifier of your Services ID. |
| **Team ID** | The ten-character ID from **Membership details**. |
| **Key ID** | The ID of the key you created. |
| **Private key** | The whole contents of the `.p8` file. Open it in a text editor and copy everything. |

[Add Apple Sign In Popup Screenshot]

## Step 6: Show the Apple button

Select your **Member Auth** or **Member Login** component in Framer, turn on **Apple** in the right sidebar, and publish your site.

## Check that it works

Open your sign in page on your published site in a private window and click the Apple button. After you approve, you should come back to your site signed in.

## What to read next

- [How to turn on social sign in](../09-how-to-turn-on-social-sign-in.md)
- [Google](04-google.md)
- [Discord](07-discord.md)
