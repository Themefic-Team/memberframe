# Google

Google sign in lets visitors join and sign in with their Google account in one click. You create a free OAuth client in Google Cloud, which is the app Google shows when someone signs in, and paste its ID and secret into MemberFrame.

## Before you start

You need a Google account that can use the Google Cloud Console at console.cloud.google.com.

## Video tutorial

[Add Google Sign In Setup Video Tutorial]

## Step 1: Copy the Redirect URL from MemberFrame

In the plugin, click **Settings**, then **Integration**, and click the **Google sign in** card under **Sign in**. Copy the **Redirect URL** with the copy button next to it.

[Add Google Sign In Popup Screenshot]

## Step 2: Set up your app in Google Cloud

1. Open the Google Cloud Console and create a project, or pick one you already have.
2. Open **APIs & Services**, then **OAuth consent screen**. Google may show this as **Google Auth Platform**.
3. Fill in your app name and a support email, choose **External** so anyone with a Google account can sign in, and save.

[Add Google Consent Screen Screenshot]

## Step 3: Create the OAuth client

1. Open **Credentials** (or **Clients** in Google Auth Platform) and create an **OAuth client ID**.
2. Choose **Web application** as the type, and give it a name.
3. Under **Authorized redirect URIs**, click **Add URI** and paste the **Redirect URL** from MemberFrame.
4. Click **Create**, then copy the **Client ID** and the **Client secret**.

[Add Google OAuth Client Screenshot]

## Step 4: Paste the values into MemberFrame

Back in the **Google sign in** popup, paste the **Client ID**, which ends in `apps.googleusercontent.com`, and the **Client secret**. Click **Save settings**, and check that the switch on the card is on.

## Step 5: Publish your app in Google

While your Google app is in testing, only the test users you add in Google can sign in. When you are ready for everyone, open the consent screen settings in Google and publish the app.

## Step 6: Show the Google button

Select your **Member Auth** or **Member Login** component in Framer, turn on **Google** in the right sidebar, and publish your site.

## Check that it works

Open your sign in page on your published site in a private window and click the Google button. After you choose your account, you should come back to your site signed in.

## What to read next

- [How to turn on social sign in](../09-how-to-turn-on-social-sign-in.md)
- [GitHub](05-github.md)
- [Apple](06-apple.md)
