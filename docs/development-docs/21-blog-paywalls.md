# Feature: Blog Paywalls

Three ways to put a paywall on CMS blog posts, each a distinct feature, and the one new piece that makes the Soft Paywall work on a CMS post: its **linked mode**, with the post body tagged by the `PaywallArticle` override.

**PRD reference**: [F07, F08](../memberframe-complete-prd.md) (soft paywall, SEO), F01 section 8 (gating)
**Status**: awaiting review
**Tasks**: unscheduled, requested 2026-10-18

---

## 1. Overview and Problem Solved

- **Feature Name**: Blog Paywalls (Page Lock, Section Lock, Soft Paywall)
- **Target Audience**: Framer Creator, and the visitors and members of their site
- **Value Proposition**: A creator with a CMS blog wants some posts, or part of every post, kept for members. Page Lock and Section Lock already did two of the three jobs and only needed explaining. The third, a metered or teaser paywall on a CMS post, was impossible.
- **Priority Tier**: P1, Creator Enhancement

### 1.1. Why The Soft Paywall Could Not Do It

`<MeteredPaywall>` takes the article through **Article Body**, a `ControlType.ComponentInstance` slot. Framer connects such a slot to a top-level frame on the canvas, outside every page. A CMS post's body is a Rich Text bound to the current item, inside the detail page, so it can never be the slot's content: a frame outside the page has no current item. On /about the creator could build the article as a top-level frame; on /blog/:slug there is no way to.

### 1.2. The Three Features

| Feature | Locks | Free part | Counts free reads | Where it is set |
| :--- | :--- | :--- | :--- | :--- |
| **Page Lock** | Every post under a path | None | No | Settings, Page Locks, Locked Routes |
| **Section Lock** | Chosen layers of the post template | Whatever is left unlocked | No | Settings, Page Locks, Section Locks, then Code overrides |
| **Soft Paywall** | The article, after its opening paragraphs | Opening paragraphs, or whole articles up to a quota | Yes, per article, weekly or monthly | The component in Framer's sidebar. Slotted on an ordinary page, linked on a CMS post |

### 1.3. The Linked Soft Paywall

1. The Soft Paywall is **linked** whenever Article Body is empty. It is placed below the post on the CMS detail page and styled like any component: Accent, Corner Radius, Theme, Colors, Typography (Framer's font picker, so the site's fonts), Layout, Labels, and every paywall control.
2. **Add to canvas** for the Soft Paywall also writes `MemberArticle.tsx`, holding one override, `PaywallArticle`. The creator gives it to the post body. It only adds two classes, `memberframe-gated-body` (the JSON-LD's `cssSelector`) and `mf-paywall-article`, keeping the layer's own class and props.
3. On the published site the component finds the tagged layer nearest above it (or the first on the page). While the post is not open it writes one style block that cuts the layer at the preview, fades its last lines with a **mask** (so it suits any background with no colour setting), and frosts them with a backdrop blur. It sets `inert` on the layer while locked, and renders its own lock card below it, and the counter pill.
4. The style block is in the first render, whose phase is "checking", so the server-rendered page already hides the rest of a post. An entitled member sees the cut until the session check opens it, as in slotted mode.
5. On the canvas, where overrides never run, linked mode shows a short setup note and the lock card itself, so it can be designed in place.
6. With no tagged layer on the page it renders nothing on the live site, rather than a card under a post anyone can read.

Limit: one linked article per page. A page with two tagged layers pairs each component with the nearest one above it.

### 1.4. History: The Article Paywall, Built And Removed

The first answer to 1.1 was an **Article Paywall**: rules written in the plugin (Settings, Page Locks, Article Paywalls), saved to site settings, and turned into a `MemberPaywalls.tsx` file with one code override per rule that rendered the Soft Paywall around the layer it was applied to. It worked on a published site on 2026-10-18.

A code override cannot show controls in Framer's sidebar, so its lock card could not be styled, and linked mode was built to fix that. Linked mode does everything the Article Paywall did and adds the design controls, so two features doing one job only confused creators. The Article Paywall was removed the same day, plugin and backend. The free-article cap it raised from 10 to 100 stays, in the component, the generator, and the meter endpoint.

**For a project that used it**: the `MemberPaywalls` file stays in the project and keeps working, but the plugin no longer updates it. Replace each `MemberPaywalls` override with `MemberArticle`, `PaywallArticle`, place a Soft Paywall below the post, then delete the file from Assets.

### 1.5. Conflicts

- **Overrides do not run on the canvas.** Framer runs code overrides only in preview and on the published site, so the canvas shows the post whole. Linked mode answers it by showing the lock card on the canvas instead.

---

## 2. User Flows

### 2.1. In-Plugin Configuration Flow (Framer Designer)

One-time for all three: tiers in Manage, Tiers; a gateway in Manage, Payments; /login and /pricing pages (Builder, Predefined Pages).

**Page Lock, every post members only**
1. Settings, Page Locks. Paste the Route Shield script into Site Settings, Custom Code, End of head, once.
2. **Add locked page**, Protected path **Blog, every item (/blog/:slug)**. That locks every post and leaves `/blog`, the list, open. Picking **Blog (/blog)** instead locks the list and every post, since a path covers the pages under it.

   The Shield matches a `:name` segment as any one segment (`pathMatches` in `routes/shield.ts`). Before 2026-10-18 it compared paths literally, so a `/blog/:slug` rule, which the picker offered, locked nothing; `test/shieldBehaviour.test.ts` now covers it. The picker labels pages from their path when Framer named them after it (it read "/blog (/blog)"), sorts them by path, and leaves the sign in, sign up, reset, and 404 pages out of what can be locked, since a locked sign in page redirects to itself.
3. Who can open it, Redirect to (`/login`, or `/pricing` to sell the plan), **Add lock** in the popup.

**Section Lock, part of every post**
1. Split the post in the CMS: an `Intro` field, free, and the `Content` field, locked.
2. On the detail page, put the Content text in a frame, and a "Subscribe to keep reading" card under it.
3. Settings, Section Locks: `Blog Body`, Any signed-in member, Blurred; `Blog Upsell`, Signed-out visitors only, Hidden. **Add lock** in each lock's popup.
4. Code overrides, File MemberFrameLocks: `BlogBody` on the content frame, `BlogUpsell` on the card. Publish.

**Soft Paywall on a CMS post, metered or teaser, designed on the canvas**
1. Builder, Soft Paywall, **Add to canvas**. This also writes MemberArticle.
2. Open the CMS detail page. Drag the Soft Paywall into the page, directly below the post body. Width Fill, Height Fit. Leave Article Body empty.
3. Style it in the right sidebar: Theme, Colors, Typography, Layout, Labels, Accent, Corner Radius. Set Paywall Type, Free Articles (1 to 100), Reset Window, Full Access For, Free Paragraphs, and the card texts there too.
4. Select the post body (the Rich Text, or the stack holding it), Code overrides, **+**, File **MemberArticle**, Override **PaywallArticle**.
5. Publish, and test in a private window. Every later change is a sidebar edit and a publish.

**Soft Paywall on an ordinary page** (unchanged): build the article as a top-level frame, connect it in Article Body.

### 2.2. Visitor / Member Runtime Flow

Soft Paywall, metered, 3 a month:
1. Posts one to three open in full, each with the counter pill. Reopening one is free.
2. The fourth shows its opening paragraphs, the rest faded and frosted, and the lock card: Subscribe goes to /pricing, Sign in to /login and back.
3. A member with the full-access plan reads every post with no pill. A signed-in member below it sees "Upgrade to keep reading".

Read More teaser: every visitor without access sees the opening paragraphs and the lock card on every post.

---

## 3. Architecture and File Inventory

- **Canvas component**: `src/canvas-components/MeteredPaywall.tsx`. Linked mode (1.3): `linked`, `linkedArticle`, `articleElement`, `linkedCss`, and the `is-linked` styles. Free Articles goes to 100 (`METER_MAX_QUOTA`); above 10 the pill drops its dots.
- **Plugin service**: `src/services/articleTag.ts`: `ARTICLE_TAG_FILE_NAME`, `articleTagCode`, and the two class names, held to the component's by a test.
- **Generated code file**: `MemberArticle.tsx`, written by `BuilderTab.handleAddToCanvas` after a Soft Paywall deploy.
- **Plugin copy**: the Soft Paywall's Builder description; the Page Lock path hint.
- **Backend**: `src/routes/content.ts` meter accepts a limit up to 100. No settings.
- **Tests**: `test/linkedPaywall.test.ts` (the override, the shared class names, the first-render cut, the mask, `inert`, the canvas card, the empty-page case); `test/softPaywall.test.ts` (the cap).
- **Styling**: in the component's own stylesheet. Zero inline CSS in the plugin.

---

## 4. Framer Property Controls Specification

The Soft Paywall's own controls, unchanged (see `18-content-features.md` and `00-canvas-appearance.md`), except Free Articles, now 1 to 100. Article Body left empty selects linked mode.

---

## 5. Data Contracts and Core User Schema

No new stored data. The override adds classes only:

```typescript
// MemberArticle.tsx, generated
export function PaywallArticle(Component: React.ComponentType<any>): React.ComponentType<any>
// adds className "memberframe-gated-body mf-paywall-article" and data-mf-article
```

---

## 6. Verification and Testing Checklist

- [x] `test/linkedPaywall.test.ts`, `test/softPaywall.test.ts`.
- [x] Zero inline CSS and design lint.
- [x] The removed Article Paywall was seen working on a published site, which proved the meter and card on a CMS post.
- [ ] Needs human verification, linked mode: the lock card styled in the sidebar matches on the live site; the tagged Rich Text is cut, faded, and frosted; Framer passes the override's classes to the Rich Text's element.

## 7. Simpler Setup, and the Invisible Article (2026-10-20)

This section supersedes the Article Body parts of sections 1 to 4.

### 7.1. The bug

On a published page, the tagged article was blank for every visitor. Signed out, the card showed with empty space above it; signed in, the whole article was empty.
- The layer rendered with `opacity:0; transform: translateY(150px)`, the starting state of its Framer appear animation, which never ran.
- `PaywallArticle` wrapped the layer in a plain function component, which drops React's `ref`, and Framer's appear and scroll effects need it.
- **The fix:** the override is now `React.forwardRef` and passes the ref on. The plugin rewrites an older `MemberArticle.tsx` when it opens (the seal guard's pass), so a republish puts the fix live.

### 7.2. Setup: place it below the article

The paywall finds its article itself, in this order:
1. A shown layer with the `PaywallArticle` override (optional).
2. The nearest shown Framer text block (`RichTextContainer`) above it with at least two paragraphs. A heading block is skipped, and so are hidden copies kept for other breakpoints. It is looked for again on resize.

The found article gets `data-mf-paywall-article`, an attribute React does not manage, and the `memberframe-gated-body` class the SEO markup points at. The cut CSS targets the attribute and the override's class. A tagged article is cut from the first paint; a found one once the page's scripts run.

The cut after Free Paragraphs is measured again once web fonts and the page finish loading.

### 7.3. The sidebar

| Kept | Removed, and what it is now |
| :--- | :--- |
| Paywall Type, with a one-line description | **Article Body**: the article is found (7.2) |
| Full Access For, with the site's own plans | **Article ID**: always the page path |
| Free Articles, Reset Window, Show Counter (meter only) | **Preview Height**: a fixed 320px, for an article with no more paragraphs than Free Paragraphs |
| Free Paragraphs | **Blur Amount**: a fixed 8px |
| Lock Title, Lock Message (meter), Unlock Button | **Sign In Link**: always shown to a signed-out visitor |
| Canvas Preview | **Pricing Page, Sign In Page**: from the site's settings (Payments pricing page, Auth sign-in page), written into the component when it is added |
| Accent Color, Corner Radius, Theme, Colors, Typography, Layout, Spacing, Labels | **SEO Paywall Markup, Content Type**: always on, as an Article |

The teaser's card words ("Keep reading", "Join to unlock the rest of this article.") are in Labels, as before.

**Existing instances:** values in the removed controls are ignored. An instance that used Article Body now finds its article instead. Re-add the component to get the new sidebar.

### 7.4. Chosen Tiers (2026-10-22)

**Full Access For** gains **Only chosen tiers…** (since 2026-10-22 the list is the same as the locks', `19-section-locks.md` section 9).
- It reveals **Chosen Tiers**: a list of the site's tiers, written by the generator the same way as Full Access For's options.
- The paywall turns the picks into `only:a,b`. Members on exactly those tiers read everything; everyone else meets the meter or the teaser.
- None picked means nobody has full access.
- See `19-section-locks.md` section 8.

## 8. No Code Override, Several Paywalls per Page (2026-10-22)

**The override is no longer needed or written.**
- The Builder stopped writing `MemberArticle.tsx` when the Soft Paywall is added, and its card says "No code override needed."
- A project that already has the file keeps it, still kept current by the seal guard. A layer that has the override is still preferred within the paywall's range.
- Remove it from any layer that is not an article body. On this site that is the Home page's article card component.

**How a paywall finds its article (`findArticle`):**
- The nearest shown Framer text block above it with two or more paragraphs, which skips a heading block.
- Only blocks after the previous paywall on the page count, and none another paywall has marked.
- With no such block, the paywall renders nothing on the published site.

**Several paywalls on one page:**
- Each instance makes an id after mount and marks its article `data-mf-paywall-article="<id>"`. Its cut, frost, `inert`, and open state, and its CSS, apply to that article alone.
- The class-wide `.mf-paywall-article` rule is gone. It could cut every tagged layer at one paywall's height.
- Meters on one page share the page's count. Only the first paywall on the page shows the counter pill.

**Trade-off:** an article is cut once the page's scripts run, not in the first paint, so its full text can show for a moment while the page loads. The text was always in the page source, as the SEO paywall markup requires.

## 9. Any Page: the Layer Right Above (2026-10-22)

**The rule:** the Soft Paywall locks the layer right above it in its stack. That layer can be a CMS post body, a text block, a stack, a section, a grid, or a CMS list, on any page. The rule is visible in Framer's Layers panel.

**How `findArticle` picks, in order:**
1. A layer with the old PaywallArticle override, in range.
2. **The layer right above** (`layerAbove`).
   - It walks out of the wrappers Framer puts round a component: its container, and a breakpoint's variant.
   - It then takes the nearest shown previous sibling, skipping `style`, `script`, `link`, `template`, and copies hidden for another breakpoint.
   - It never climbs out of a stack that holds other layers. A paywall first in its stack takes nothing from the section before it.
   - A layer that is, or holds, another paywall is skipped, and so is one another paywall has marked.
3. The text search from section 8: the nearest text block with two or more paragraphs, after the previous paywall.

A copy of the paywall hidden for another breakpoint takes nothing, and never leads the counter pill. A paywall removes only its own mark.

**Free Preview** (was Free Paragraphs; same prop, `previewParagraphs`):
- In a text block it counts paragraphs. In anything else it counts the visible items of the stack, grid, or list (`previewUnits`), looking through wrappers that hold a single layer.
- The cut falls below the lowest of the first N, since grid cards sit side by side, plus a 56px peek. With N items or fewer: 320px.

**The cut CSS:**
- It adds `position: relative` only when the layer is static, read before the mark. A layer Framer places absolutely keeps its place.

**SEO markup:**
- It is added once a layer is protected.
- The type is `Article` for a text block and `WebPage` otherwise (`WebPage` was added to `MF_SCHEMA_TYPES`).

**Sidebar clean-up (every control now does something):**
- **Canvas Preview removed.** Open and Locked drew the same thing. The canvas always shows the lock card.
- **The "Paywall card" placeholder box removed from the canvas.** It never shows on the site, and it made the component look taller than it is. The placement tip is in the Paywall Type description and on the Builder card.
- **The Read More Teaser gets Lock Title and Lock Message** (`teaserCardTitle`, `teaserCardDescription`), shown only in that mode. "Read More title" and "Read More text" left Labels.
  - An older instance's Labels value is still used when the new field is left at its default (`teaserWords`).
- **The unused "Checking" label removed.**

The Builder card reads "Place it right below what it protects, on any page", with placement "Any page or CMS page".

**Tests:** `test/linkedPaywall.test.ts`, "any page: the layer right above" (a fake page tree) and "the sidebar, every setting doing something".

### 9.1. The Layer Keeps Its Design (2026-10-22)

**The bug:** a Photography section, a heading above a card grid, was squeezed when locked. The cards' rows shrank and the images overlapped.
- The cut was a `max-height` on the layer. Framer grids and stacks fit their rows and items into the height they get, so the whole layout squeezed.
- Free Preview was then measured on the squeezed layout, which cut it shorter still.
- A text block never showed this, so it only appeared once any layer could be protected.

**The fix:** the layer keeps its designed size and layout. The paywall only hides what is below the cut:
- `clip-path: inset(0 0 calc(100% - cut) 0)` hides it, also from clicks.
- The fade mask ends at the cut, in pixels, and the frost `::after` sits right above the cut.
- `margin-bottom` is the layer's own bottom margin minus the hidden height, which pulls what follows (the lock card) up to the cut.
- The layer's height and the cut are measured on the real layout. They are measured again when fonts or the page load, and when the layer resizes (a `ResizeObserver`: images loading, a new breakpoint). The cut never changes the layer's own size, so the observer cannot feed itself.

**Free Preview on a section:**
- With no more parts than Free Preview, the last part is opened (`previewUnits(layer, wanted)`). A heading plus a grid counts as the heading followed by the grid's cards.
- Free Preview 2 keeps the heading and the first row of cards. Free Preview 1 keeps the heading.

### 9.2. Below Paywall: Show or Hide (2026-10-22)

**The setting:** Below Paywall (`belowPaywall`), Show or Hide, default Show.
- **Show:** only the layer above is locked, and the rest of the page stays visible, as before.
- **Hide:** while the paywall is not open (locked, or still checking), the layers after it in its stack are hidden too. A visitor without access sees only the free preview and the lock card. On a Home page with a content column, that hides the sections below the paywall. The newsletter column and the footer are in other stacks and stay.

**How:**
- `ownSlot(root)` is the paywall's place in its stack: the outermost of Framer's wrappers round it. `layerAbove` now takes the layer before that slot.
- `layersBelow(root)` takes every element after the slot, except `style`, `script`, `link`, and `template`.
  - Copies hidden for another breakpoint are included, so hiding a layer never makes it drop out of the list on the next look.
- Each one is marked `data-mf-paywall-below="<id>"`. The paywall's cut CSS adds `display: none !important` for that id, so they open together with the paywall. A paywall removes only its own marks.
- The content stays in the page source, as the SEO paywall markup requires. Off on the canvas.

### 9.3. Fixes From the Test Site's Home Page (2026-10-22)

The published Home page had:
- Hero > Articles > Featured: Title, Featured large, a 4-card grid, a "View all" row, then the paywall.
- Latest: a column beside Featured.
- Categories: Photography, Travel, Tech, and the newsletter.
- The footer: three breakpoint copies, each a `footer` element.

Two rules from 9 and 9.2 did nothing there.

**1. The layer right above was the "View all" row,** so nothing visible was cut.
- `layerAbove` now skips up to three small layers: under 120px tall (`MF_MIN_LAYER_PX`), unless a text block of two or more paragraphs.
- It takes the first layer of some height. Here that is the grid.
- The skipped layers (`layersBetween`) are hidden while the paywall is not open, since they come after the cut.

**2. Below Paywall: Hide only looked inside the paywall's own stack,** where the paywall was last.

It now takes everything on the page after the paywall that starts at or below it (`layersBelow`):
- It walks from the paywall's slot up to the page root (`data-framer-root`, `#main`, or `body`) and takes the next siblings at each level.
- It keeps a layer that starts above the paywall: a column beside it, here Latest.
- It keeps a fixed or sticky layer: the navigation bar, the "Remix" badges.
- It keeps a footer (`footer`, or a layer named Footer). The wrappers round a footer are opened, and what else they hold is hidden.
- It takes copies hidden for another breakpoint, so a breakpoint change never shows them.

**How it is applied:**
- Marks are set again on resize, with the old marks removed first, so every layer is measured where it really is.
- All of them carry `data-mf-paywall-below="<id>"`. The cut CSS hides them only while the paywall is not open.

**Tests:** `test/linkedPaywall.test.ts` models this Home page in its fake page tree.

### 9.4. Breakpoint Wrappers, and the Glass Card (2026-10-22)

**The bug:** on the test site, Free Preview 2 cut through the middle of the first row of cards instead of below it.
- Framer wraps each CMS card in a breakpoint wrapper, `.ssr-variant { display: contents }`. Such a wrapper has no box, so `getClientRects()` returns nothing and the paywall took every card for a hidden copy.
- The grid had "no items", and the cut fell back to 320px.

**The fix:**
- `mfBoxless` spots a `display: contents` element.
- `mfLayersIn(parent)` lists a parent's layers as the Layers panel does. It looks through boxless wrappers and leaves out markup and hidden copies.
- `ownSlot`, `layerAbove` (through `layersBefore`), `layersBetween`, and `previewItems` all use it.
- `layersBelow` decides for what a boxless wrapper holds, never for the wrapper.
- `mfApart` keeps a wrapper and what is inside it from counting as two layers.

**The glass card:**
- The card's surface is the Background colour at 78% over `backdrop-filter: blur(20px) saturate(170%)`, with a light inner edge and a softer border.
- On the published site it rises over the bottom of the locked layer (`--mf-meter-overlap`, at most 96px and at most 40% of the preview, none when nothing is locked), so the frosted content shows through. On the canvas it sits in place.

**The frosted edge:**
- 120px of the next item shows past the free ones (`MF_PEEK_PX`).
- It fades out over the last 200px (`MF_FADE_PX`).
- The frost is up to 240px tall.

### 9.5. The Frost Band, and Glass Settings (2026-10-22)

**The bug:** on the test site the locked cards ended at a hard line, with no fade and no blur. The fade was a `mask-image`, and the blur an `::after`, both on the creator's layer, which Framer had animated with `will-change: transform`. Neither showed. The clip did.

**The fix:** nothing on the creator's layer but the clip and the pulling-up margin. The frost is the paywall's own element, `.mf-meter-frost`, inside its root, which is now `display: flow-root`:
- It is placed from the layer's box and the root's box: its bottom edge sits on the cut, and it is as wide and as far left as the layer. A stack's gap between the layer and the paywall does not matter.
- It is measured after the cut is set, and again whenever the layer resizes.
- It blurs what is behind it (`backdrop-filter`) and is masked so the blur grows towards the bottom.
- Its gradient fades into the page's own colour, read by `mfBackdropColor`, which walks up from the layer past transparent backgrounds and uses white if none is set.
- It is up to 260px tall (`MF_FROST_PX`) and 75% of the preview at most.

The card rises over it through `--mf-card-shift` (the cut edge minus the overlap: 96px at most, and 40% of the preview).

**Glass** (sidebar, a Blur popover):

| Setting | Range | Default |
|---|---|---|
| Content Blur, the frost | 0 to 30px | 10 (`CONFIG.blurIntensity` when unset) |
| Card Blur | 0 to 40px | 16 |
| Card Opacity, the card's Background colour behind the glass | 30 to 100% | 80% |

Card Opacity 100 with Card Blur 0 gives a solid card.

## 10. Locked Content Out of the Live Page (2026-10-22)

**The bug:** a visitor could untick `display: none`, `clip-path`, or the blur in the browser's tools and read what the paywall or a section lock covered. CSS hides content; it does not remove it.

**The fix** (the paywall here; section locks in the Route Shield, `19-section-locks.md` section 10, with the same algorithm):
- While the paywall is **locked**, the content is taken out of the live page:
  - everything past the free part of the protected layer (from `freeHeight`, the bottom of the last free paragraph or item)
  - every layer hidden with the paywall (`data-mf-paywall-below`)
- **Text is scrambled in place:** letters and digits are swapped for random ones; spaces and punctuation are kept, so the frosted part still looks like text.
- **Media is stripped:** images, videos, and frames lose `src`, `srcset`, `poster`, `alt`, `title`, and `aria-label`. An image gets a blank pixel; a frame gets `about:blank`.
- **The real values stay in memory** (a `WeakMap`, `mfRedactTree` in the `@memberframe-redact` block) and come back on access, or when the paywall goes. Nothing is redacted while the paywall is still checking, so a member never sees scrambled text first.

**Why in place, not removed:** the nodes are React's. React updates and removes them later (another breakpoint, the next CMS item on client navigation), and a node taken out of the page makes that throw.

**Why only after hydration:** text changed before React has taken a node over is a hydration mismatch, which makes React rebuild the page. React marks the nodes it has taken over with `__reactFiber$…` keys, and only those nodes are touched. Passes run again on React's writes (a `MutationObserver` on text, child lists, and the media attributes, not on style or class), and at 0.8, 2, and 5 seconds while hydration completes.

**The limit:** Framer writes each page's HTML on its server, with every layer in it. View Page Source, the network response, or a visitor with JavaScript turned off still has the original content. Only content that is never in the page (served by the MemberFrame server after the check) is secret. Such content would need its own server-delivered component; not built.

**Tests:** `test/paywallRedaction.test.ts`; `memberframe-backend/test/shieldRedaction.test.ts`.
