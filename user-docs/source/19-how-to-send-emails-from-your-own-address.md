# How to Send Emails from Your Own Address

MemberFrame emails your members their sign-in codes, confirmation codes, password reset links, and magic links. By default these come from MemberFrame, and with custom SMTP they come from your own email address and your site's name instead. SMTP is the standard way email servers send mail, and most email providers offer it.

## Before you start

You need the SMTP details from your email provider: the server address, the port, a username, and a password. Many providers, such as Gmail, ask you to create an app password or an API key for this instead of using your normal password.

## Video tutorial

[Add Custom SMTP Video Tutorial]

## Step 1: Open the Custom SMTP popup

Click **Settings**, then **Config**, and scroll down to **Email**. Click the **Custom SMTP** card, and a popup will open.

[Add Custom SMTP Popup Screenshot]

## Step 2: Fill in your server details

| Setting | What it does |
| --- | --- |
| **Host** | Your provider's SMTP server, for example `smtp.gmail.com` or `smtp.sendgrid.net`. |
| **Security** | **STARTTLS** suits most providers. **SSL/TLS** is the older choice on port 465. **None** is not encrypted. |
| **Port** | Set for you when you choose **Security**. Change it only if your provider tells you to. |
| **Username** | Often your full email address, or a word like `apikey`. Leave it empty if your server needs no sign in. |
| **Password** | Your password, app password, or API key. It is stored encrypted and never shown again. |
| **From name** | The sender name members see, usually your site's name. |
| **From address** | An address your SMTP server is allowed to send from, for example `hello@yoursite.com`. |
| **Reply-to** | Optional. Where members' replies go, if not the **From address**. |

## Step 3: Send a test email

Type your own email into **Test address** and click **Send test email**. The test goes through your server only, with no fallback, so you see the real result, and a message will tell you whether it was sent.

## Step 4: Save and turn it on

Click **Save and turn on** at the bottom of the popup. From now on, member emails will come from your address. To stop using your server, turn off the switch on the **Custom SMTP** card, and MemberFrame will send the emails again. The switch saves straight away, and turning it back on keeps the details you saved.

> If an email ever fails, the popup shows **Last email failed** with the reason, so you can fix the details and save again.

## Check that it works

Open your sign in page on your published site and request an email code for a test member. The email should arrive from your **From name** and **From address**.

## What to read next

- [How to add sign in and sign up](08-how-to-add-sign-in-and-sign-up.md)
- [How to manage your members](18-how-to-manage-your-members.md)
- [Troubleshooting and FAQ](23-troubleshooting-and-faq.md)
