# How to Lock a Page

A page lock keeps a page for the members you choose, and sends everyone else to another page, such as your sign in page or your pricing page. A lock on a path also locks every page under it, so one lock can protect a whole course, a members area, or every post in a blog.

## Before you start

Create your tiers in **Manage**, **Tiers** if you want to lock a page to a paid tier. A lock for "any signed-in member" works with the Free tier alone.

## Video tutorial

[Add Lock a Page Video Tutorial]

## Step 1: Add the Route Shield to your site

Page locks and section locks are enforced by a small script on your site called the Route Shield, so you add it once before you rely on any lock.

1. In the plugin, click **Settings**, then **Page locks**, and click **Copy script** under **Route Shield**.
2. In Framer, open **Site Settings**, then **General**, and scroll to **Custom Code**.
3. Paste the script into **End of head tag**.
4. Publish your site.

[Add Route Shield Screenshot]

> Without the Route Shield, locks do nothing on your live site. You only need to add it once, and every lock you create later works without pasting it again.

## Step 2: Add a locked page

Under **Page Locks**, click **Add locked page**. A popup will open where you set up the lock.

[Add Page Lock Popup Screenshot]

## Step 3: Choose the page

Pick the page from **Protected path**. The list shows your Framer pages by their address, and choosing a page also locks every page under it, so `/courses` locks `/courses/lesson-1` too.

To lock an address that is not in the list, choose **Custom path** and type it, starting with a slash, for example `/members`.

Your sign in, sign up, reset, and 404 pages are left out of the list, because a locked sign in page would send visitors back to itself.

## Step 4: Choose who can open it

Pick an option from **Who can open it**. The options are split into two groups, so you can say either who gets in or who is kept out.

| Option | Who can open the page |
| --- | --- |
| **Any signed-in member** | Every member, on any tier, including Free. |
| **Any paid plan** | Every member on a paid tier. |
| **Gold members or higher** | Members on that tier or any tier with a higher level. There is one option for each paid tier. |
| **Only chosen tiers…** | Exactly the tiers you tick in the list that appears. |
| **Signed-out visitors only** | Only visitors who are not signed in. |
| **Everyone without Gold** | Everyone except members on that tier or higher. |
| **Everyone except chosen tiers…** | Everyone except the tiers you tick. |

## Step 5: Choose where everyone else goes

Pick a page from **Redirect to**. Your sign in page is a good choice for members-only pages, and your pricing page is a good choice when you want to sell the tier. Choose **Custom redirect** to type an address yourself.

## Step 6: Save the lock

Click **Add lock** at the bottom of the popup. The lock is saved straight away and starts working on your live site, without publishing again.

## Edit, turn off, or delete a lock

Each lock shows as a card with its address. Click the card to change it in the same popup, then click **Save lock**. The switch on the card turns the lock off or on and saves straight away. To delete a lock, open it, click **Delete lock**, and confirm, and anyone will be able to open that page again.

## Locking a blog or other CMS collection

- Choose **Blog, every item** (`/blog/:slug`) to lock every post and leave the list page `/blog` open, so visitors can still browse your titles.
- Choose **Blog** (`/blog`) to lock the list page and every post.

## Check that it works

Open the locked page on your published site in a private window. You should be sent to your **Redirect to** page, and after you sign in as a member with the right tier, the page should open.

## What to read next

- [How to lock part of a page](11-how-to-lock-part-of-a-page.md)
- [How to add a soft paywall](12-how-to-add-a-soft-paywall.md)
- [Troubleshooting and FAQ](23-troubleshooting-and-faq.md)
