# How to Let Members Save Bookmarks

Bookmarks let members save pages and posts to read later. The Bookmark Button saves one item, and the Bookmarks Tray is a slide-out drawer that lists everything the member has saved. Saved items are stored on the member's account, so they follow the member to every device.

## Video tutorial

[Add Bookmarks Video Tutorial]

## Step 1: Add the Bookmark Button

In the plugin, click **Builder**, pick **Bookmark Button**, and click **Add to canvas**. Place it on each page or card that members can save, for example inside a blog card in a CMS collection list.

[Add Bookmark Button Screenshot]

## Step 2: Tell the button what it saves

Select the button and fill in these settings in Framer's right sidebar.

- **Item Slug** is the unique name of the item. In a CMS list, connect it to the item's Slug field so every card saves its own post. Leave it empty on a normal page to save the page itself.
- **Item Title** is the name shown in the tray. In a CMS list, connect it to the item's Title field.
- **Item Link** is where the tray links to. In a CMS list, connect it to the item's page link.

## Step 3: Style the button

| Setting | What it does |
| --- | --- |
| **Icon Style** | **Bookmark Ribbon**, **Heart**, or **Star**. |
| **Filled Color** | The icon's color once the item is saved. |
| **Button Style** | **Outline**, **Soft**, or **Icon Only**. |
| **Icon Size**, **Icon Position** | The size of the icon, and whether it sits **Left** or **Right** of the label. |
| **Show Label**, **Button Label** | Shows words next to the icon, and what they say. |
| **Save Animation** | Plays a small animation when an item is saved. |
| **Sign In Page** | Where a signed-out visitor goes when they click save. |
| **Canvas Preview** | Shows the button **Not Saved** or **Saved** while you design. |

## Step 4: Add the Bookmarks Tray

Click **Builder**, pick **Bookmarks Tray**, and click **Add to canvas**, then place it in your navigation bar so members can open it from any page.

[Add Bookmarks Tray Screenshot]

| Setting | What it does |
| --- | --- |
| **Drawer Side**, **Drawer Width** | Whether the drawer slides out from the right or left, and how wide it is. |
| **Backdrop** | What happens behind the open drawer: **Dim**, **Blur**, or **None**. |
| **Empty Message** | What the drawer says when nothing is saved yet. |
| **Max Visible** | How many saved items to list. |
| **Count Badge**, **Badge Color** | A number on the tray button that shows how many items are saved. |
| **Search**, **Saved Date** | A search box in the drawer, and the date each item was saved. |
| **Button Style**, **Icon**, **Icon Size**, **Show Label**, **Button Label** | How the button that opens the drawer looks. |
| **Sign In Page** | Where a signed-out visitor goes. |
| **Canvas Preview** | Shows the drawer **Closed** or **Open** while you design. |

> Both components size themselves to fit their content. Keep their width set to **Fit** in Framer so a button never stretches across a card.

## Check that it works

Sign in on your published site as a test member, save a post with the Bookmark Button, and open the Bookmarks Tray. The post should be in the list, and clicking it should open the post.

## What to read next

- [How to add a member dashboard](14-how-to-add-a-member-dashboard.md)
- [How to read and export your reports](21-how-to-read-and-export-your-reports.md)
- [How to add and style a component](05-how-to-add-and-style-a-component.md)
