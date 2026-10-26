# How to Ask Members Profile Questions

Profile fields let you ask members for more than their email address, such as their company, their role, or a link to their portfolio. Members answer them on their Member Dashboard, and you can see the answers in **Manage** and send them to your other tools with webhooks.

## Before you start

Add a **Member Dashboard** with **Profile Form** turned on, because that is where members fill in their answers. You can read how in [How to add a member dashboard](14-how-to-add-a-member-dashboard.md).

## Video tutorial

[Add Profile Questions Video Tutorial]

## Step 1: Add a field

Click **Settings**, then **Fields**, and click **Add field**. A popup will open for the new field.

[Add Profile Field Popup Screenshot]

## Step 2: Set up the field

| Setting | What it does |
| --- | --- |
| **Label** | The question members see, for example Portfolio URL. |
| **Key** | The name the answers are stored under. It is made from the label as you type, for example `portfolio_url`, and you can change it until the field is first saved. |
| **Type** | The kind of answer, from the list below. |
| **Required** | Members must answer it before they can save their profile. A required checkbox must be ticked, like accepting terms. |
| **Placeholder** | The grey hint inside an empty box. Not shown for checkboxes and dropdowns. |
| **Show when** | Shows the field only after a certain answer to a dropdown or checkbox above it. |

| Type | Use it for |
| --- | --- |
| **Short text** | A name, a company, or a city. |
| **Long text** | A bio or a longer answer. |
| **Web address** | A website or portfolio link. |
| **Phone number** | A phone number. |
| **Dropdown** | One choice from a list you write, such as a role or a team size. Add one row per option under **Options**. |
| **Checkbox** | A yes or no answer. |
| **Number** | A count or an amount. |

> After the first save, a field's **Key** is locked, because members' answers are stored under it. Choose it carefully, and remember that you can still change the **Label** at any time.

## Step 3: Save the field

Click **Add field** at the bottom of the popup. The field is saved straight away and shows on your members' dashboards the next time they load it.

## Show a field only for some answers

**Show when** appears on a field when there is a dropdown or checkbox above it. For example, you can show "Agency name" only when "Role is Agency", so members only see the questions that apply to them.

## Reorder, edit, or delete fields

- Use the up and down arrows on a field's card to change the order members see. Each move saves straight away, and a field cannot move above the field it depends on.
- Click a field's card to change it in the same popup, then click **Save field**.
- To delete a field, open it, click **Delete field**, and confirm. Fields that depended on it become always shown, so they are not lost.

## Good to know

- A site can have up to 20 profile fields, and a dropdown can have up to 50 options.
- A card marked **needs a fix** has a problem, such as an empty label, and you need to open and fix it before you can save other fields.

## Check that it works

Sign in on your published site as a test member and open your dashboard. Your new question should show in the profile form, and after you click **Save profile**, the answer should show in that member's details in **Manage**, **Members**.

## What to read next

- [How to manage your members](18-how-to-manage-your-members.md)
- [How to send member events with webhooks](20-how-to-send-member-events-with-webhooks.md)
- [How to add a member dashboard](14-how-to-add-a-member-dashboard.md)
