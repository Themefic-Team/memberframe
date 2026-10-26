# How to Share a Protected Download

A Protected Download is a download button that only the right people can use. You can share a file with members on certain tiers, such as templates or e-books for paying members, or with anyone who knows a password. The real file address is never shown to visitors.

## Before you start

Keep the MemberFrame plugin open while you upload the file, because the plugin secures the file for you a moment after you add it.

## Video tutorial

[Add Protected Download Video Tutorial]

## Step 1: Add the button

In the plugin, click **Builder**, pick **Protected Download**, and click **Add to canvas**. Place the button where you want it on the page.

## Step 2: Add your file

Select the button and, in Framer's right sidebar, drop your file into **File**. You can also type a **File Name**, which is the name the visitor's download is saved under.

[Add Protected Download File Screenshot]

## Step 3: Choose who can download it

Pick an option from **Access**.

- **Members** lets you choose **Who Can Download**: **Any signed-in member**, **Any paid plan**, a tier and higher, or **Only chosen tiers…** with the tiers you tick in **Chosen Tiers**.
- **Password** lets anyone with the password download the file. Type it into **Password**.

## Step 4: Wait for the file to be secured

With the plugin open, MemberFrame secures the file within about a second. The **File** and **Password** boxes clear, the button shows the file's name and size, and a message says **Secured 1 download file. Publish to update your live site.**

[Add File Secured Screenshot]

> If you close the plugin before this happens, the canvas shows **Open MemberFrame to secure this file before publishing**, and on your live site the button reads "This file is not ready yet". Open the plugin again and the file will be secured.

## Step 5: Publish

Publish your site so the button works on your live site. Later changes to the file, the access rule, or the password are secured the same way, and leaving **Password** empty keeps the password you saved before.

## Style the button

| Setting | What it does |
| --- | --- |
| **Download Text** | The button's label for people who can download. |
| **Locked Text** | The button's label for everyone else. |
| **File Type and Size**, **File Meta** | Small details under the button, such as "ZIP, 12 MB". |
| **Plan Note** | A short note about which tier the file needs. |
| **Icon** | **Download Arrow**, **Document**, **ZIP Archive**, or **Code**. |
| **Button Style** | **Filled** or **Outline**. |
| **Sign In Page**, **Pricing Page** | Where the locked button sends signed-out visitors and members on a lower tier. |
| **Canvas Preview** | Shows the button **Unlocked** or **Locked** while you design. |
| **Button Color**, **Corner Radius** | The button's color and how rounded it is. |

## What your visitors will see

| Access | Who | What they see |
| --- | --- | --- |
| Members | Signed out | A button to sign in, which brings them back to the page afterwards. |
| Members | On a lower tier | A button to upgrade, which goes to your pricing page. |
| Members | Allowed | A download button with the file type and size. |
| Password | Anyone | A password box and a download button. A wrong password shows "Incorrect password. Try again." |

Every download link is made after the visitor's access is checked and works for only 60 seconds, so a copied link cannot be shared.

## Check that it works

Open the page on your published site in a private window and click the button while signed out. You should be asked to sign in, and after you sign in as a member with access, the file should download.

## What to read next

- [How to lock a page](10-how-to-lock-a-page.md)
- [How to read and export your reports](21-how-to-read-and-export-your-reports.md)
- [Troubleshooting and FAQ](23-troubleshooting-and-faq.md)
