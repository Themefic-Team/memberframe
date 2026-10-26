# How to Lock Part of a Page

A section lock hides or blurs chosen layers on a page, such as the body of a lesson or a members-only banner, while the rest of the page stays open to everyone. You create the lock in the plugin, then pick it on the layer in Framer.

## Before you start

Add the Route Shield to your site, as shown in [How to lock a page](10-how-to-lock-a-page.md), because section locks only work on your live site once it is there.

## Video tutorial

[Add Lock Part of a Page Video Tutorial]

## Step 1: Add a section lock

Click **Settings**, then **Page locks**, and scroll down to **Section Locks**. Click **Add section lock**, and a popup will open.

[Add Section Lock Popup Screenshot]

## Step 2: Name the lock

Type a **Name** that describes what it protects, for example Lesson Body. The name becomes the lock's name in Framer, so Lesson Body shows as `LessonBody`, and the info icon next to the label shows exactly where to find it.

> Choose the name with care. Renaming a lock later means picking it again on every layer that uses it.

## Step 3: Choose who sees the section

Pick an option from **Who sees it**. It offers the same choices as a page lock, such as **Any signed-in member**, **Gold members or higher**, or **Signed-out visitors only**.

## Step 4: Choose what everyone else sees

Pick an option from **Everyone else**.

- **Hidden** means visitors without access do not see the section, and the space closes up.
- **Blurred, not clickable** means they see the section blurred, so they know something is there, but they cannot click it.

## Step 5: Save the lock

Click **Add lock** at the bottom of the popup. MemberFrame saves the lock and writes a file called **MemberFrameLocks** into your Framer project, with one entry for each of your section locks.

## Step 6: Pick the lock on a layer in Framer

1. In Framer, select the layer you want to protect.
2. In the right sidebar, find **Code Overrides** and click the plus button.
3. Choose the file **MemberFrameLocks**, then choose your lock's name, for example **LessonBody**.
4. Publish your site.

[Add Code Overrides Screenshot]

Later changes to who sees a lock take effect on your live site as soon as you save them in the plugin, without publishing again.

## Edit, turn off, or delete a lock

Click a lock's card to change it, then click **Save lock**. The switch on the card turns the lock off or on and saves straight away. To delete a lock, open it, click **Delete lock**, and confirm, and the sections that use it will no longer be hidden from anyone.

## A tip for teasers

Use two locks to tease members-only content. Set the content to **Any signed-in member** and **Blurred, not clickable**, and set a "Subscribe to read" card to **Signed-out visitors only** and **Hidden**. Members will see the content, and visitors will see the blurred content with your card.

## Good to know

- Locked layers look normal on the Framer canvas, because Framer does not run these locks while you design. Test them in Framer's **Preview** or on your published site.
- The text of a blurred or hidden section is still in the page's code. For content that must stay private, lock the whole page or share it as a protected download.
- A site can have up to 50 section locks.

## Check that it works

Open the page on your published site in a private window. The section should be hidden or blurred, and after you sign in as a member with access, it should show normally.

## What to read next

- [How to lock a page](10-how-to-lock-a-page.md)
- [How to add a soft paywall](12-how-to-add-a-soft-paywall.md)
- [Troubleshooting and FAQ](23-troubleshooting-and-faq.md)
