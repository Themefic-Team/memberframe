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
2. Saving a lock (its popup's **Save lock**, its card's toggle, or a confirmed delete) also writes `MemberFrameLocks.tsx` into the project: one code override per rule, named after it (`Gold article` becomes `GoldArticle`).
3. In Framer the creator selects a section, opens **Code overrides** in the right sidebar, chooses File **MemberFrameLocks**, and picks the rule. Framer's sidebar is the only place a plugin can put choices next to a layer; plugins cannot add their own controls there, and the plugin API cannot attach an override itself, so the creator picks it.
4. The override only marks the layer: it adds `data-mf-lock="<rule>"` and a `mf-lock-<slug>` class, keeping the layer's own class and props. Any layer works, components included.
5. The **Route Shield**, already in the site's head for page locks, hides every marked layer before the first paint, then shows, blurs, or keeps hiding each per its rule once the one shared session check answers. The rules come from the settings, so a change applies on the next page load without a republish.

A layer named `Lock: <rule>` still works (the previous version), so nothing tagged that way breaks.

---

## 2. User Flows

### 2.1. In-Plugin Configuration Flow (Framer Designer)

One-time: the Route Shield script is in Site Settings, Custom Code, End of head (page locks need it too), and the tiers exist in Manage, Tiers.

1. Settings, Page Locks, **Section Locks**, **Add section lock**. The lock's form opens in a popup (2026-10-25).
2. **Name** it, for example `Experience`. The badge and the hint show its override name.
3. **Who sees it**: Any signed-in member, Signed-out visitors only, `<Tier>` members or higher, or Everyone without `<Tier>`.
4. **Everyone else**: Hidden, or Blurred, not clickable.
5. **Add lock**, in the popup's footer. The rules are saved and MemberFrameLocks is written.
6. In Framer, select the section, then right sidebar, **Code overrides**, **+**, File **MemberFrameLocks**, Override **Experience**.
7. Publish.

Later changes to who sees a lock: open its card, **Save lock**. Switching it off: the card's toggle, saved at once. Renaming a lock changes its override name, so it has to be picked again on each section.

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
- **Plugin save**: `src/components/tabs/SettingsTab.tsx` saves the rules with the page locks, then writes MemberFrameLocks through `writeCodeFile` in `src/services/framerCanvasService.ts`
- **Plugin service**: `src/services/sectionLocks.ts`: names, slug, override names, the MemberFrameLocks code, "Who sees it" options
- **Generated in the creator's project**: `MemberFrameLocks.tsx`, replaced on every save
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
- **MemberFrameLocks could not be written** (not on the canvas, permission refused). The rules are saved; the panel says the file was not updated.
- **The canvas and Framer preview** do not run custom code, so they always show everything.

---

## 7. Testing Checklist

### Automated

- [x] Backend settings: defaults, tidy names, unsafe names refused, duplicates by slug refused, round trip
- [x] Shield: hidden while checking; each visitor type; blur; API down; cached session; sign in on the page; switched-off lock shows
- [x] Plugin: override names, MemberFrameLocks compiled with TypeScript and an override run (keeps the layer's class, adds the tag), name rules match the server, Who sees it options
- [x] Real Chrome, generated Shield: a layer tagged by attribute, by class only, and by name; unknown lock hidden; paused lock shown; untagged untouched; a shown layer keeps its own display

### Human, in Framer (the agent cannot check these)

- [ ] Saving a lock creates MemberFrameLocks, and Code overrides lists each lock by name
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

## 8. Exact Tiers (2026-10-22)

Every lock used to mean one thing: "this tier **or higher**". A creator can now name exact tiers, for example Standard and VIP but not Premium.

| Where | New choice | Stored as |
| :--- | :--- | :--- |
| Page locks, Required tier | **Only chosen tiers…**, then a tick per tier | `requiredTier: "only:standard,vip"` |
| Section locks, Who sees it | **Only chosen tiers…** / **Everyone except chosen tiers…**, then the ticks | `audience` with `requiredTier: "only:…"` |
| Soft Paywall, Full Access For | **Chosen Tiers**, then **Full Access Tiers** (a list of the site's tiers) | `unlimitedTier: "chosen"` with `fullAccessTiers` |

**Rules:**
- **Membership, not rank:** a member matches when their tier is in the list. A higher tier does not count unless it is ticked.
- **The status rules are unchanged:** active and trialing members count; a past-due member counts in grace; a cancelled member counts until their paid period ends.
- **Fails closed:** a tier deleted after being ticked matches nobody. The panel shows it as "(deleted tier)" so it can be unticked. An empty list matches nobody, so the panel keeps at least one tick.
- **When conditions combine, all must match** (product owner, 2026-10-22). The tiers are the only condition today.
- **Fallbacks are unchanged:** a page redirects; a section hides or blurs with its card; the paywall shows its teaser and card.

**Where it is enforced:**
- `isEntitled` (server, plugin, MeteredPaywall) and the Route Shield's `checkEntitled`.
- `entitlementParity` keeps the copies identical.
- `readRequiredTier` (`lib/siteSettings.ts`) lowercases, checks, and deduplicates the keys, at most 20. Anything unusable becomes `signed_in`.

**Plugin files:**
- `services/tierChoice.ts`: the `only:` helpers.
- `components/settings/TierChecklist.tsx`: the ticks.
- `PageLocksPanel.tsx`, `SectionLocksEditor.tsx`, `services/sectionLocks.ts`.

## 9. One "Who Is It For" List Everywhere (2026-10-22)

Page locks, section locks, and the Soft Paywall said the same thing three ways: "Standard or higher" against "Standard members or higher" against "Standard", and "Any signed in member" against "Any Signed In". They now share one list (`services/accessChoices.ts`), with the same words and order, in two groups:

| Group | Choices |
| :--- | :--- |
| **Who gets in** | Any signed-in member · Any paid plan · *Tier* members or higher (one per paid tier) · Only chosen tiers… |
| **Who is kept out** | Signed-out visitors only · Everyone without *Tier* (one per paid tier) · Everyone except chosen tiers… |

- **Page locks** (now "Who can open it") use both groups.
  - A page lock gains `audience: "others"` (stored only when set), the same pair a section lock has. A "Join" page members never see is now possible.
  - On it, the Route Shield shows a likely guest the page at once, moves a member on to After sign in, and opens the page if the check fails, since the visitor then counts as signed out.
- **Section locks** use both groups. "Any paid plan" is new there.
- **The Soft Paywall** uses only **Who gets in**: Full Access For means "who reads in full", and "everyone except Premium reads in full" would hand the article to free visitors.
  - The generator writes the paywall's options with the same words. Free is left out, since "Free or higher" is any signed-in member.
  - The control for exact tiers is now called **Chosen Tiers**.
- **`any_paid`** joins `isEntitled` and the shield's `checkEntitled`: any tier above the lowest. The paywall's own copy of that rule went.
- **The picker** shows the two groups as headings (`Select` accepts an option `group`).
- **The ticks for exact tiers** (`TierChecklist`) are tiles in a two-column grid, inside a panel headed "Tiers let in" or "Tiers kept out".
  - Each tile has a check box and the tier name. A ticked tile takes the selected background and border.
  - The head shows a count ("2 of 4 selected"). Under the tiles, one line says what the ticks mean.
  - The last tick is locked, since an empty list matches nobody. A deleted tier shows struck through, so it can be unticked.

### 9.1. The Section Card, Redesigned (2026-10-22)

The card over a blurred members' section (`shield.ts`, `GATE_CSS`, `makeGate`) is now:
- A lock in a soft brand-coloured circle.
- A title that names the plans: "Standard members only", "Standard or VIP members only" for exact tiers, "Paid members only", or "Members only".
- One line:
  - for a visitor: "Sign in to your account to read this section."
  - for a member whose plan is too low: "Your current plan does not include this. Upgrade to unlock it."
- A brand button with an arrow: **Sign in**, or **See plans**.
- For a visitor, when the site's sign-up page is not the sign-in page: "New here? **Create an account**" (`SIGNUP_PATH`). Both links remember the page, so the visitor returns to it.

**The look:**
- The card is 340px wide, with 16px corners, a layered shadow, and light colours whatever the page, so it reads over any blur.
- A light veil behind the card lifts the blur a little.
- The card fades in, except for visitors who asked for reduced motion.

## 10. Locked Sections Out of the Live Page (2026-10-22)

Once the session check has answered, every tagged layer this visitor may not see has its content taken out of the live page by the Route Shield:
- a hidden lock
- a blurred lock
- a layer tagged for a rule that does not exist

Text is scrambled in place, and images, videos, and frames lose their sources, alt text, and titles. Before that, a visitor could untick `display: none` or the blur in the browser's tools and read the section. The real values stay in the script's memory and come back when the member gets access.

**How it works** (`memberframe-backend/src/routes/shield.ts`):
- `lockedRoots`, `redactNode`, `restoreNode`, and `syncRedaction` do the work.
- Nodes are changed in place, only once React has hydrated them, for the reasons in `21-blog-paywalls.md` section 10.
- A `MutationObserver` on the body (text, child lists, media attributes) and timers at 0.8, 2, and 5 seconds keep up with React.
- A blurred lock still looks like blurred text, with its sign-in card over it.

**The limit, as for the paywall:** the page's HTML source still has what Framer wrote there.

**Tests:** `memberframe-backend/test/shieldRedaction.test.ts`.

---

## Renamed To MemberFrameLocks, 2026-10-25

The creator asked for the code override file to be called MemberFrameLocks, so Framer's Code overrides list reads File **MemberFrameLocks**. `SECTION_LOCKS_FILE_NAME` in `src/services/sectionLocks.ts` is now `MemberFrameLocks.tsx`.

A layer keeps pointing at the file its override was picked from, and the plugin API cannot re-point it. So a project that already has `MemberLocks.tsx` keeps it: Save locks writes the same overrides to both files (`sectionLocksFilesToWrite`), and opening the plugin creates `MemberFrameLocks.tsx` once for such a project, so the next layer is locked from the new file. A new project only ever gets MemberFrameLocks. Once every layer in a project is re-picked from MemberFrameLocks, the creator can delete MemberLocks in Framer; the plugin never deletes it, because that would unlock the layers still using it.

- [x] Tests: the name, which files a save writes (none for nothing, both for an older project), and the file's own instructions, in `test/sectionLocks.test.ts`.
- [ ] Needs human verification: in Framer, Code overrides lists File MemberFrameLocks after a lock is saved; in a project with MemberLocks, layers picked from it stay locked after a save.
