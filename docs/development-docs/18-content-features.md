# Feature: Soft Paywall, Upgrade to Download, and Member Bookmarks

Technical development specification, user flow, architectural wiring, and testing checklist for three content features: the metered and Read More paywall, the protected file vault, and member bookmarks.

**Plans**: [FP-07 Soft Paywall](../features-plan/7.%20Soft%20Paywall%20(Read%20More).md), [FP-12 Upgrade to Download](../features-plan/12.%20Upgrade%20to%20Download.md), [FP-10 Member Bookmarking](../features-plan/10.%20Member%20Bookmarking.md)
**PRD reference**: F07, F08, F10, F14 in section 8 of [memberframe-complete-prd.md](../memberframe-complete-prd.md); S5 in section 14
**Status**: built, 2026-10-17. Backend verified end to end against the running API; components not yet tried on a published Framer site
**Tasks**: 3.4, 3.5, 3.6, 5.5, 7.1 (see [`../IMPLEMENTATION-STATUS.md`](../IMPLEMENTATION-STATUS.md))

---

## 1. Overview and Problem Solved

- **Feature Names**: Soft Paywall (`<MeteredPaywall>`), Upgrade to Download (`<ProtectedDownload>`), Member Bookmarks (`<BookmarkButton>`, `<BookmarksTray>`)
- **Target Audience**: Framer creators who publish articles, sell files, or run resource libraries; their visitors and members
- **Value Proposition**:
  - **Soft Paywall**: visitors read a few articles free, or the opening of every article, before being asked to subscribe. The article stays in the page, so Google still ranks it, and Schema.org markup tells Google it is a legitimate paywall rather than cloaking.
  - **Upgrade to Download**: files are known to the page only by an opaque Asset ID. A download link is signed after the member's plan is checked, works for 60 seconds, and streams through the API, so no storage address ever reaches a browser. Competitors put the file URL on the button.
  - **Bookmarks**: members save pages and CMS items with one click and find them again in a drawer. The click feels instant and is never lost or doubled.
- **Priority Tier**: P1 for the paywall and downloads, P2 for bookmarks

---

## 2. User Flows

### 2.1. In-Plugin Configuration Flow (Framer Designer)

**Soft Paywall**
1. Builder, pick **Soft Paywall**, Add to canvas.
2. In Framer's properties panel, pick the article's frame in **Article Body** and set the component's height to Fit.
3. Choose **Paywall Type**: Free Articles Meter (with Free Articles and Reset Window) or Read More Teaser.
4. Choose **Full Access For**: Any Paid Plan (default), Any Signed In, or a tier and up. The list is the site's own tiers, written at deploy.
5. Optional: Free Paragraphs (where the preview stops), Preview Height (used when the body has fewer paragraphs), Blur Amount, Lock Title, Lock Message (`{period}` and `{limit}` are filled in), Unlock Button, Pricing Page, Sign In Page, SEO Paywall Markup and Content Type, Article ID (bind to a CMS slug when one page template serves many articles).
6. **Canvas Preview: Locked** shows the cut, frost, and lock card while designing.

**Upgrade to Download**
1. Manage, **Files**. Upload a file (or link one hosted elsewhere; Google Drive and Dropbox share links are converted to the file itself), name it, and choose **Who can download**.
2. Copy the file's Asset ID from its row.
3. Builder, pick **Protected Download**, Add to canvas, paste the Asset ID.
4. Optional: Download Text, Locked Text, File Type and Size (automatic, or your own), Plan Note, Icon, Button Style, Canvas Preview.
5. Manage, Files shows each file's download count. Edit changes the name, the saved file name, the plan, or a link's address; Delete removes the stored file.

**Bookmarks**
1. Builder, add **Bookmark Button** to a CMS card or a page. On a card, bind **Item Slug**, **Item Title**, and **Item Link** to the CMS fields; on a page, leave them empty to save that page.
2. Builder, add **Bookmarks Tray** to the navigation bar.
3. Optional: Icon Style (bookmark, heart, star), Filled Color, Show Label; Drawer Side, Empty Message, Max Visible, Count Badge, Search.

### 2.2. Visitor / Member Runtime Flow

**Soft Paywall, metered**
1. A signed-out visitor opens an article. The device meter counts it and the article shows in full, with a counter pill: "Article 1 of 3 free articles this month", "2 free articles remaining".
2. Re-opening an article already counted is free and shows its original position.
3. The article past the limit is cut after the chosen paragraphs, the last lines frosted, with a lock card: the creator's title and message, "Subscribe to continue reading" to the pricing page, and "Already a member? Sign in".
4. Signing in returns the reader to the article (MemberAuth reads the return key). A signed-in member below Full Access For is metered on the server, exactly, across devices; the device's count for the current cycle is folded in at the start of their server cycle, so signing in hands out no extra articles.
5. A member on Full Access For sees the article unmodified, with no pill.

**Soft Paywall, Read More**: every visitor without access sees the opening paragraphs and the lock card; a signed-in member below the plan sees "Upgrade to keep reading".

**Upgrade to Download**
1. Signed out: "Sign in to Download", with the plan under it. Pressing it goes to sign in, then back.
2. Signed in below the file's plan: "Upgrade to Download", "Included with the Gold plan and above", to the pricing page.
3. On the plan: "Download Source Files", "ZIP, 42 MB". Pressing it shows "Preparing your download" (a second press does nothing), the browser saves the file, and "Your download has started" shows for a moment.

**Bookmarks**
1. A member clicks the ribbon: it fills and pulses at once, the tray badge goes up by one, and the server is updated in the background.
2. If the update fails, the ribbon empties again and "Could not update your bookmarks. Try again." shows under it.
3. A signed-out visitor's click opens "Sign in or create an account to save this item to your bookmarks." with Sign in and Not now. After signing in and coming back, the item saves itself.
4. The tray opens a drawer: search, each saved item with when it was saved, and a remove button. Escape, the backdrop, and the close button shut it, and focus returns to the tray button.

---

## 3. Architecture and File Inventory

- **Plugin UI Components**: `src/components/manage/FilesPanel.tsx` (Manage, Files); `ManageTab.tsx` gains the Files segment; `componentRegistry.ts` and `BuilderTab.tsx` list and deploy the four components.
- **Canvas Code Components**: `src/canvas-components/MeteredPaywall.tsx`, `ProtectedDownload.tsx`, `BookmarkButton.tsx`, `BookmarksTray.tsx`. `MemberGate.tsx` gains F08 markup for Frosted Blur. `MemberAuth.tsx` reads `memberframe:return-to:<site>` after sign in, after a pending checkout.
- **Plugin services**: `src/services/assetsService.ts`; `apiClient.upload` sends a file as the raw request body with a ten minute deadline; generator descriptors in `canvasComponentCodeGenerator.ts`.
- **Backend API Endpoints** (`memberframe-backend/src/routes/content.ts`):

| Method | Path | Who | Purpose |
|---|---|---|---|
| GET | `/api/member/bookmarks` | member | saved items |
| PATCH | `/api/member/bookmarks` | member | `{ action: "add" \| "remove", item }`, answers the full list |
| POST | `/api/member/meter` | member | count one article: `{ slug, limit, period, deviceReads }` |
| GET | `/api/assets/:assetId` | visitor | name, type, size, plan, and `access`: granted, upgrade, sign_in |
| POST | `/api/assets/sign-download-url` | member | `{ assetId }` to `{ signedUrl, filename, expiresInSeconds }` |
| GET | `/api/assets/download/:token` | the link | streams the file, `Content-Disposition: attachment` |
| GET, POST, PATCH, DELETE | `/api/site/assets`, `/api/site/assets/upload` | creator | list, upload (raw body), link, edit, delete |

- **Backend services**: `services/bookmarkService.ts`, `services/meterService.ts`, `services/assets/assetService.ts`, `assets/storage.ts` (local disk or S3 compatible), `assets/s3Presign.ts` (SigV4, no SDK), `assets/downloadLink.ts` (HMAC tokens), `assets/remoteUrl.ts` (linked file address checks).
- **Tables** (`prisma/migrations/20261017000000_bookmarks_meter_assets`): `bookmarks` (unique per member and slug), `meter_cycles` (one row per member), `assets`.
- **Server settings**: `ASSET_STORAGE` (`local` or `s3`), `ASSET_STORAGE_DIR`, `ASSET_MAX_BYTES` (250 MB), `ASSET_LINK_SECONDS` (60), `ASSET_SIGNING_SECRET` (set the same value on every server behind a load balancer), `ASSET_S3_ENDPOINT`, `ASSET_S3_BUCKET`, `ASSET_S3_REGION`, `ASSET_S3_ACCESS_KEY_ID`, `ASSET_S3_SECRET_ACCESS_KEY`.
- **Copies held by tests**: the appearance block (all nine components), `isEntitled` (gate, paywall, plugin), the schema block (gate, paywall), the meter rule (paywall and API, the same scenarios in both suites).

### 3.1. Decisions and conflicts

- **C33, the download's plan lives on the file, not the component.** PRD F10 gives `<ProtectedDownload>` an `allowedTiers` control. A rule in published page code is one any visitor can edit, so the plan is set on the file in Manage, Files, enforced on every sign, and the component shows the server's answer.
- **C34, downloads stream through the API.** The plan's example returns a storage presigned URL, which names the bucket and the object; PRD S5 says the raw bucket path never appears in a client response. The signed link is MemberFrame's own `/api/assets/download/<token>`, and the API streams the file. A storage presigned URL is only ever used by the server.
- **C35, meter and schema code live in the component.** Tasks 3.5 and 3.6 name `utils/meteredStorage.ts` and `utils/schemaInjector.ts`. Code on a published site cannot import from this repository, so both are marked blocks inside the components, executed by the tests the same way as the appearance block.
- **"Any Paid Plan"** is every tier above the site's lowest rank. A member whose tier the ladder does not know counts as unpaid, which fails toward the meter.
- **The device fingerprint is a random id**, not a browser fingerprint: enough to tell devices apart, nothing to track a person with.
- **Bookmark Button and Bookmarks Tray draw their icons** rather than import them: Framer's bundled icon set is older than this repository's (the `Sparkles` incident), and the tray's drawer is rendered under `document.body` with `react-dom`'s portal, so no transformed navigation bar can trap it.

---

## 4. Framer Property Controls Specification

**`<MeteredPaywall>`**: `contentSlot` Article Body; `mode` Paywall Type; `freeQuotaCount` Free Articles (1 to 100, stepper); `quotaPeriod` Reset Window (Every 7 Days, Every 30 Days); `unlimitedTier` Full Access For (site tiers); `articleId` Article ID; `previewParagraphs` Free Paragraphs; `previewHeight` Preview Height; `blurIntensity` Blur Amount (2 to 20 px); `showCounterPill` Show Counter; `cardTitle` Lock Title; `cardDescription` Lock Message; `ctaLabel` Unlock Button; `showSignInLink` Sign In Link; `pricingPath`; `loginPath`; `seoMarkup` SEO Paywall Markup; `schemaType` Content Type; `canvasPreview`; style, Theme, Colors, Typography, Layout, Labels.

**`<ProtectedDownload>`**: `assetId` Asset ID; `buttonText` Download Text; `lockedButtonText` Locked Text; `showFileMeta`; `fileMetaLabel` File Meta; `showNote` Plan Note; `iconType` Icon (Download Arrow, Document, ZIP Archive, Code); `buttonStyle`; `loginPath`; `pricingPath`; `canvasPreview`; `accentColor` Button Color; `borderRadius`; shared appearance and Labels.

**`<BookmarkButton>`**: `itemSlug` Item Slug; `itemTitle` Item Title; `itemUrl` Item Link; `iconShape` Icon Style (Bookmark Ribbon, Heart, Star); `activeFillColor` Filled Color; `showLabel`; `labelText` Button Label; `loginPath`; `canvasPreview`; shared appearance and Labels.

**`<BookmarksTray>`**: `drawerSide` Drawer Side; `emptyStateText` Empty Message; `maxItems` Max Visible (10 to 200); `showBadge` Count Badge; `showSearch`; `showLabel`; `triggerLabel`; `loginPath`; `canvasPreview`; shared appearance and Labels.

**`<MemberGate>`** gains `seoMarkup` and `schemaType`, shown for Frosted Blur only.

---

## 5. Data Contracts and Core User Schema

```typescript
interface BookmarkItem { itemSlug: string; title: string; url: string; savedAt: number }   // ms

interface MeterAnswer {
  allowed: boolean; alreadyRead: boolean; count: number; limit: number;
  remaining: number; position: number | null; cycleStart: number; resetsAt: number;
}

// Device storage, localStorage `mf_metered_v1:<siteKey>`: "v1.<base64 of XOR'd JSON>.<FNV-1a checksum>"
interface DeviceMeter { deviceId: string; periodDays: number; slugs: string[]; cycleStart: number }

// GET /api/assets/:assetId
interface PublicAsset {
  asset: { id: string; name: string; fileName: string; mimeType: string; sizeBytes: number;
           requiredTier: string; requiredTierName: string };
  access: "granted" | "upgrade" | "sign_in";
}

// POST /api/assets/sign-download-url
// 200 { signedUrl, filename, expiresInSeconds: 60 }
// 401 { reason: "unauthenticated" }   403 { reason: "tier_upgrade_required", requiredTier, requiredTierName }
// 404 { reason: "asset_not_found" }   400 { reason: "site_mismatch" } when a body siteId is not this site
```

A download token is `base64url({ a: assetId, s: siteId, m: memberId, e: expiresAt }).HMAC-SHA256`. Asset ids are `ast_` plus 20 characters from an unambiguous alphabet.

Session storage keys shared between components: `memberframe:return-to:<site>` (written by the four content components, read by MemberAuth), `memberframe:pending-bookmark:<site>` (Bookmark Button).

---

## 6. Verification and Testing Checklist

### Automated

- **Backend** `test/content.test.ts`: S3 signature equals AWS's published example; a link is refused one second after expiry, after its expiry is edited, and under another secret; private, loopback, link-local and metadata addresses are refused for linked files; Drive and Dropbox links become the file; asset ids and saved file names; the meter's count, re-reads, exact cycle reset (30 and 7 days), device reads folded into a new cycle, bounded storage; bookmark links refuse `javascript:`, protocol-relative and spaced paths.
- **Plugin** `test/softPaywall.test.ts` (meter, storage tamper check, pluralised counter copy, counter optional but the meter not, schema block identical in both components, valid JSON-LD pointing at the real class, no script break-out, gate markup only for Frosted Blur, `inert` on frosted text, generated file and site tiers); `test/bookmarks.test.ts` (sync rule driven against a fake server: instant fill, add-remove-add resolves to one bookmark, any click sequence settles where the last click left it, failure and sign-in revert, tray dialog behaviour); `test/protectedDownload.test.ts` (no storage strings in the component, double-click lock, server decides, generated file, Files tier list and labels). The appearance parity, gate parity, and icon tests now cover the four new files.
- Gates: `npm run lint:css`, `npm run lint:design`, `npx tsc --noEmit`, `npm test`, `npm run build`; backend `npx tsc --noEmit`, `npx vitest run`.

### End to end, run against the local API on 2026-10-17

| Check | Result |
|---|---|
| Upload a file through the service, as Silver | stored, `application/zip` inferred |
| Asset info as a guest, and as a Gold member | `sign_in`, `granted` |
| Sign as a guest, an unknown asset, another site's id | 401, 404, 400 |
| Sign as Gold, then download through the link | 200, 60 seconds, `attachment; filename="test-kit.zip"`, bytes identical |
| Download through a tampered link | 404 |
| Sign as a free member | 403 `tier_upgrade_required`, Silver |
| Bookmark as a guest | 401 |
| Three identical saves at once | one bookmark |
| Save with a `javascript:` link | 400 |
| Meter /a, /b, /a, /c, /d with a limit of 3 | 1, 2, 1 (re-read), 3, refused |

### Manual, on a published Framer site

1. Paywall, Free Articles 2: article A shows "Article 1 of 2", B "Article 2 of 2, Last free article", C is cut with the lock card. Sign in as a paid member on C: the paywall goes and the article shows whole.
2. Read More: every signed-out visit shows the teaser. View the page source: the whole article is there, and the JSON-LD script is in the head. Run the URL through Google's Rich Results Test.
3. Download as a guest, as Free, as Silver: sign in, upgrade, download. In the network tab, the signed URL is MemberFrame's own; open it again after 61 seconds and it says the link expired.
4. Bookmark a card, watch the badge, open the tray, remove the item, and check the card's ribbon empties. Press Escape with the tray open. Click a bookmark while signed out, sign in, and come back: it is saved.

---

## Bookmark Design Controls, 2026-10-18

Added on request so the button and the tray can match a site's design. Every default is the look a placed instance already had, so nothing on a published site changes until a creator touches a control.

**`<BookmarkButton>`**

| Control | Type | Default | Effect |
| :--- | :--- | :--- | :--- |
| Button Style | Enum: Outline, Soft, Icon Only | Outline | Soft is a tint of Filled Color with no border; Icon Only drops background, border, shadow, and padding |
| Icon Size | Number 12 to 48 px | 20 | The icon, through `--mf-bookmark-icon` |
| Icon Position | Segmented: Left, Right | Left | Shown only with Show Label |
| Save Animation | Boolean | On | The pulse on save |

**`<BookmarksTray>`**

| Control | Type | Default | Effect |
| :--- | :--- | :--- | :--- |
| Drawer Width | Number 280 to 640 px | 400 | Never wider than the screen |
| Backdrop | Segmented: Dim, Blur, None | Dim | Blur adds a 6px backdrop blur over the dim |
| Badge Color | Optional colour | unset, the accent | Sanitized by `mfSafeColor` |
| Saved Date | Boolean | On | The "Saved 3 days ago" line under each item |
| Button Style | Enum: Outline, Soft, Icon Only | Outline | The same three as the button |
| Icon | Enum: Bookmark Ribbon, Heart, Star | Bookmark Ribbon | The button's three shapes, so the two match |
| Icon Size | Number 12 to 48 px | 18 | Through `--mf-tray-icon` |

Tests: `test/bookmarkCustomization.test.ts`. Needs human verification: each style in both themes, and the drawer at 280px and 640px.

## A Button in the Navigation Bar, 2026-10-20

A Bookmark Button with Item Slug empty saves the page it is on. In a shared navigation bar it saved the first page the visitor opened on every page. Framer moves between pages with `history.pushState` and never remounts the bar, and the button read the page once, at mount. The tray then listed several items with the site's title and no way to tell them apart.

- **Follows the page:** `mfOnLocationChange` wraps `pushState` and `replaceState` once per window, and listens to `popstate`. The button re-renders on each navigation, so its filled state is for the page shown. The item is also built again at the click.
- **The title, in order:**
  1. Item Title.
  2. The page's first `h1` outside `header` and `nav`.
  3. `document.title`, unless the same title was seen on another path. That is the site-wide title Framer gives pages without an SEO title of their own, and it names only `/`.
  4. The last path segment in words: `/article/artificial-intelligence` becomes "Artificial Intelligence".
- **A bound Item Slug with no title:** the slug in words, not the listing page's title.
- **The tray:** each item's meta line also shows its path, for example "Saved today · /article/artificial-intelligence".
- **Bookmarks saved before this fix** keep the wrong page and title. Remove them from the tray.
- **Saved too soon after a navigation (2026-10-20, later the same day):** Framer swaps the page first and sets its title a moment later, so a quick click took the previous page's title.
  - The history wrapper records the title of the page being left (`__mfNav`). A title still equal to it is treated as stale and never used: the button uses the shown `h1` (hidden breakpoint copies are skipped) or the path in words.
  - It then watches for up to 5 seconds and sends the real title once Framer sets it (`watchTitle`, `retitle`). The server keeps the newest title for a slug.
- **Repair:** on a saved page, a bookmark titled with the site-wide title (one seen on another path, or carried by another saved page) or with the path in words is re-sent with the page's title. Bookmarks saved wrongly before this fix correct themselves on the visitor's next visit.
