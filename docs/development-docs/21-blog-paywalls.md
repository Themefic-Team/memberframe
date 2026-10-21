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
3. Required tier, Redirect to (`/login`, or `/pricing` to sell the plan), **Save locks**.

**Section Lock, part of every post**
1. Split the post in the CMS: an `Intro` field, free, and the `Content` field, locked.
2. On the detail page, put the Content text in a frame, and a "Subscribe to keep reading" card under it.
3. Settings, Section Locks: `Blog Body`, Any signed-in member, Blurred; `Blog Upsell`, Signed-out visitors only, Hidden. **Save locks**.
4. Code overrides, File MemberLocks: `BlogBody` on the content frame, `BlogUpsell` on the card. Publish.

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
