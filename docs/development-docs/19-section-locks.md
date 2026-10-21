# Feature: Section Locks

Lock any section of a page to a rule the creator writes, with the same logic as page locks. The creator picks the rule for a section in Framer's own right sidebar.

**PRD reference**: [F01](../memberframe-complete-prd.md) section 8 (gating), section 11.3 (entitlement)
**Status**: awaiting review
**Tasks**: unscheduled, requested 2026-10-17 after page locks were fixed

---

## 1. Overview and Problem Solved

- **Feature Name**: Section Locks
- **Target Audience**: Framer Creator, and the visitors and members of their site
- **Value Proposition**: Page locks decide who may open a page. Section locks decide who sees each part of it. The creator writes each rule in the plugin, picks it on any section from a dropdown in Framer's sidebar, and can change who sees it later without republishing.
- **Priority Tier**: P1, Creator Enhancement

### 1.1. History, All On 2026-10-17

| Version | Why it was replaced |
| :--- | :--- |
| Ten fixed code overrides (`withSilverTier`, ...) and a MemberGate slot | Hardcoded tiers, a layout-changing blur wrapper, content off the page. Hidden, never used |
| Generated overrides, one pair per tier, with show/hide logic inside | Static: the rules were the tiers, not the creator's own |
| Layer tagged by renaming it `Lock: <rule>`, with a "Lock selected layer" button | Needed a Stack around components (Framer publishes a component under its variant's name) and a rename the creator found confusing |

### 1.2. The Design

1. A **rule** is a name, who sees the section, and what everyone else gets. Rules are site settings, next to page locks.
2. **Save locks** also writes `MemberLocks.tsx` into the project: one code override per rule, named after it (`Gold article` becomes `GoldArticle`).
3. In Framer the creator selects a section, opens **Code overrides** in the right sidebar, chooses File **MemberLocks**, and picks the rule. Framer's sidebar is the only place a plugin can put choices next to a layer; plugins cannot add their own controls there, and the plugin API cannot attach an override itself, so the creator picks it.
4. The override only marks the layer: it adds `data-mf-lock="<rule>"` and a `mf-lock-<slug>` class, keeping the layer's own class and props. Any layer works, components included.
5. The **Route Shield**, already in the site's head for page locks, hides every marked layer before the first paint, then shows, blurs, or keeps hiding each per its rule once the one shared session check answers. The rules come from the settings, so a change applies on the next page load without a republish.

A layer named `Lock: <rule>` still works (the previous version), so nothing tagged that way breaks.

---

## 2. User Flows

### 2.1. In-Plugin Configuration Flow (Framer Designer)

One-time: the Route Shield script is in Site Settings, Custom Code, End of head (page locks need it too), and the tiers exist in Manage, Tiers.

1. Settings, Page Locks, **Section Locks**, **Add section lock**.
2. **Name** it, for example `Experience`. The badge and the hint show its override name.
3. **Who sees it**: Any signed-in member, Signed-out visitors only, `<Tier>` members or higher, or Everyone without `<Tier>`.
4. **Everyone else**: Hidden, or Blurred, not clickable.
5. **Save locks**. The rules are saved and MemberLocks is written.
6. In Framer, select the section, then right sidebar, **Code overrides**, **+**, File **MemberLocks**, Override **Experience**.
7. Publish.

Later changes to who sees a lock, or switching it off: Save locks only. Renaming a lock changes its override name, so it has to be picked again on each section.

### 2.2. Visitor / Member Runtime Flow

| Visitor | `Gold members or higher` | `Everyone without Gold` | `Any signed-in member`, blur |
| :--- | :--- | :--- | :--- |
| Signed out | hidden | shown | blurred |
| Free member | hidden | shown | shown |
| Gold member | shown | hidden | shown |
| Lapsed membership | hidden | shown | blurred |
| API unreachable | hidden | shown | blurred |
| Still checking | hidden | hidden | hidden |
| Lock switched off | shown | shown | shown |
| Marked with a lock that no longer exists | hidden | hidden | hidden |

Signing in or out on the page re-checks every lock with no reload. Framer's menu navigation keeps the locks, since they are a stylesheet.

---

## 3. Architecture and File Inventory

- **Plugin UI**: `src/components/settings/SectionLocksEditor.tsx`, rendered by `PageLocksPanel.tsx`
- **Plugin save**: `src/components/tabs/SettingsTab.tsx` saves the rules with the page locks, then writes MemberLocks through `writeCodeFile` in `src/services/framerCanvasService.ts`
- **Plugin service**: `src/services/sectionLocks.ts`: names, slug, override names, the MemberLocks code, "Who sees it" options
- **Generated in the creator's project**: `MemberLocks.tsx`, replaced on every save
- **Backend settings**: `memberframe-backend/src/lib/siteSettings.ts`, `sectionLocks`, validated, unique by slug
- **Backend enforcement**: `memberframe-backend/src/routes/shield.ts`, the section lock block
- **Permissions**: `createCodeFile` and `setCodeFileContent`, already declared

---

## 4. Framer Property Controls Specification

None. The choice is the override, in Framer's Code overrides.

| Rule field | Values | Default |
| :--- | :--- | :--- |
| Name | Letters, digits, spaces, `-` `_` `.`, up to 60, unique by slug | `Section lock N` |
| Who sees it | `members` or `others`, of `signed_in` or a tier key | Any signed-in member |
| Everyone else | `hide` or `blur` | `hide` |
| Enabled | toggle; off shows the section to everyone | on |

---

## 5. Data Contracts and Core User Schema

```typescript
interface SectionLockRule {
  name: string;
  enabled: boolean;
  audience: "members" | "others";
  requiredTier: string; // "signed_in" or a tier key
  lockedAction: "hide" | "blur";
}
```

What one override renders, for the rule `Gold article`:

```typescript
React.createElement(Component, {
  ...props,
  className: `${props.className} mf-lock-gold-article`,
  "data-mf-lock": "Gold article",
});
```

---

## 6. Edge Cases and Error Handling

- **Hidden, not secret.** A locked section is in the page's HTML. Content that must never reach a non-member belongs on a locked page or in a protected download.
- **A name in a selector.** Names are restricted to `[A-Za-z0-9 _.-]` on both sides, so they sit in quoted CSS selectors with no escaping.
- **A lock is renamed.** Its override name changes; Framer shows the old override as missing on sections that used it. Pick the lock again on those sections.
- **A lock is deleted.** Sections that still use its override are hidden (fail closed) until the override is removed or changed.
- **MemberLocks could not be written** (not on the canvas, permission refused). The rules are saved; the panel says the file was not updated.
- **The canvas and Framer preview** do not run custom code, so they always show everything.

---

## 7. Testing Checklist

### Automated

- [x] Backend settings: defaults, tidy names, unsafe names refused, duplicates by slug refused, round trip
- [x] Shield: hidden while checking; each visitor type; blur; API down; cached session; sign in on the page; switched-off lock shows
- [x] Plugin: override names, MemberLocks compiled with TypeScript and an override run (keeps the layer's class, adds the tag), name rules match the server, Who sees it options
- [x] Real Chrome, generated Shield: a layer tagged by attribute, by class only, and by name; unknown lock hidden; paused lock shown; untagged untouched; a shown layer keeps its own display

### Human, in Framer (the agent cannot check these)

- [ ] Save locks creates MemberLocks, and Code overrides lists each lock by name
- [ ] An override on a frame and on a component reaches the published HTML (data-mf-lock or the class)
- [ ] A section locked to Gold shows for a Gold member and hides when signed out
- [ ] Changing who sees a lock and saving changes the live site with no republish

---

## Panel Cleanup, 2026-10-18

The Page Locks view was trimmed on request: it had more prose than controls.

- **Route Shield**: one subtitle (where to paste, and that both kinds of lock need it) and the script well with Copy script. The three-step card and the "Recommended" badge are gone; the badge was wrong, the script is required.
- **Page Locks** (was "Locked Routes & Rules") and **Section Locks**: one-line subtitles. Field explanations live in each row's InfoTip (design rule section 8), including that a locked section is still in the page code.
- **Section Locks** with none yet shows the kit `<EmptyState>` with one action, Add section lock, instead of a blank list; the five-step "Lock A Section" guide card is gone.
- CSS removed with them: `.section-title-row`, `.shield-code-card`, `.shield-code-desc`, `.shield-quick-steps`, `.shield-steps-*`.

Needs human verification: the view at 360px in both themes.

## Blurred Sections: Visible, With a Way In (2026-10-20)

- **The bug:** a section set to "Blurred, not clickable" was blank on the published site, keeping its space but showing nothing. The `MemberLocks` overrides wrapped the layer in a plain function component, which drops React's `ref`. Framer's appear and scroll effects hold a layer by its ref, so the layer stayed at its starting state (`opacity: 0`, moved down) and the blur had nothing to show.
- **The fix:** every override is now `React.forwardRef` and passes the ref on, as Framer's own overrides do.
  - The plugin rewrites an older `MemberLocks.tsx` when it opens (`staleSectionLocksFile`, in the seal guard's pass), so projects get the fix without a Save locks click.
  - The creator republishes to put it live.
- **The card:** over each blurred section of a members' lock, the Route Shield draws a centred card.
  - **A visitor:** "Members only", "Sign in to see this.", a **Sign in** button to the login page. The current page is remembered in `memberframe:return-to:<siteKey>`, so sign in returns here.
  - **A member below the required tier:** "Standard members only" (the tier's name), "Upgrade your plan to see this.", **See plans** to the pricing page (`PaymentSettings.pricingPath`).
  - **A lock for everyone else** (`audience: others`) blurs with no card: there is nothing to sign in to.
- **How the card is placed:**
  - It lives in `<body>`, laid over the section's box, never inside it. The section is React's, and a node added there before hydration is a mismatch React removes.
  - It is placed again in an animation frame on any DOM change, resize, scroll, load, and three times while appear animations settle. It is written only when the box moved.
  - A tall section's card is sticky, so it stays in view while scrolling.
- **Still cosmetic:** a blurred section's content is in the page and readable in its source, as a hidden one's is. Section locks decide what a visitor sees, not what the page sends. Content that must never reach a non-member belongs in a component that loads it from the API for entitled members only, such as Protected Download.
