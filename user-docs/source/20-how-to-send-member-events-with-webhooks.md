# How to Send Member Events with Webhooks

A webhook sends a message to another service when something happens to a member, such as a new sign up or a plan change. Use it to add new members to your CRM or mailing list, give them a role in your community, or start an automation in Zapier, Make, Zoho Flow, or n8n.

## Before you start

You need a webhook address from the service that will receive the messages. In Zapier this is a **Catch Hook**, in Make a **Custom webhook**, and in Zoho Flow a **Webhook** trigger. Each one gives you a URL to copy.

## Video tutorial

[Add Webhooks Video Tutorial]

## Step 1: Add a webhook

Click **Settings**, then **Integration**, and scroll down to **Webhooks**. Click **Add webhook**, and a popup will open for the new webhook.

[Add Webhook Popup Screenshot]

## Step 2: Set where to send

Under **Destination**, type a **Name** you will recognize, for example Zoho CRM, and paste the **URL** from your other service.

## Step 3: Choose the events

Under **Send when**, tick the events you want to send.

| Event | Sent when |
| --- | --- |
| **New member signs up** | A new account is created. |
| **Member updates their profile or status** | A member changes their profile, or their status changes. |
| **Member's plan changes** | A member moves to another tier, by buying, cancelling, or because you changed it. |
| **Member is deleted** | A member is deleted. |

## Step 4: Choose which members

Under **For members on**, keep **All plans** ticked to send events for everyone, or tick only the tiers you want.

## Step 5: Choose which fields to send

Under **Fields sent**, choose the format of the message.

- **Standard** sends the full member record with every profile field, which suits services where you map the fields yourself.
- **Choose fields** lets you pick exactly which values to send and the name each one has in your other service. Click **Add field**, choose a **MemberFrame value** such as **Email** or **Plan name**, and type its **Key in your service**. **Use Zoho CRM fields** fills in the names Zoho CRM expects.

Click **Preview a plan change** to see exactly what a message will look like.

[Add Webhook Fields Screenshot]

## Step 6: Save and send a test

Click **Add webhook** at the bottom of the popup, and a message will remind you to send a test. Click the new webhook's card to open it, then click **Send test**. A sample member will be sent to your service, so you can check that everything arrives where you expect before a real member joins.

## Edit, turn off, or delete a webhook

Click a webhook's card to change it, then click **Save changes**. The switch on the card turns it off or on. To delete it, open it, click **Delete**, and confirm, and events will stop going to that address at once.

## For developers: check that a message came from MemberFrame

Each webhook has a **Signing secret** in its popup, with a button to copy it. Every message carries a signature made with this secret, so your own server can check that the message really came from MemberFrame before it trusts it.

## Good to know

- A site can have up to 10 webhooks.
- If your service does not answer, MemberFrame tries again for about 9 hours.

## Check that it works

Open the webhook, click **Send test**, and look in your other service, such as your Zap's test step or your CRM. The sample member should be there with the fields you chose.

## What to read next

- [How to ask members profile questions](17-how-to-ask-members-profile-questions.md)
- [How to manage your members](18-how-to-manage-your-members.md)
- [Troubleshooting and FAQ](23-troubleshooting-and-faq.md)
