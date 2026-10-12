# Feature: Zero-Code Visual Canvas Gating

Technical development specification, user flow, architectural wiring, and testing checklist for `<MemberGate>`, the component that gates a Framer frame without a code override.

**PRD reference**: [F01](../memberframe-complete-prd.md) section 8
**Status**: in progress
**Tasks**: 1.4, 1.5, 1.6, 1.7, 1.8 (see [`../IMPLEMENTATION-STATUS.md`](../IMPLEMENTATION-STATUS.md))

Task 1.3 built the customizer that feeds this feature and is recorded in
[`04-live-preview-studio.md`](04-live-preview-studio.md), because its panel work belongs to F04. Task 1.8
landed with 1.1 for the same reason and is covered in both docs: section 5.4 here records the second copy
of the resolver, which is the part F01 owns.

---

## 1. Overview and Problem Solved

- **Feature Name**: Zero-Code Visual Canvas Gating
- **Target Audience**: Framer Creator to configure, Site Visitor and Member at runtime
- **Value Proposition**: a creator gates a video lesson, a resource list, or a whole page section by
  dropping one component on the canvas and connecting a frame to its Content Slot. No code override is
  attached to the frame, so nothing breaks when Framer changes its override API. FrameAuth requires an
  override per gated frame, which is the friction this removes.
- **Priority Tier**: P0: Core MVP

---

## 2. User Flows

### 2.1. In-Plugin Configuration Flow (Framer Designer)

1. Creator opens the Builder tab. "Member Gate" is the default picker entry.
2. Creator sets the required tier, the locked state, and whichever of the three conditional fields that
   locked state reveals. The Live Preview Studio updates as they type.
3. Creator clicks "Add to canvas". The plugin generates a `.tsx` file carrying the creator's values as its
   property control defaults, writes it to the project with `framer.createCodeFile`, and inserts an
   instance with `framer.addComponentInstance`.
4. Framer opens the new instance on the canvas with the properties sidebar populated.
5. Creator drags the frame they want protected into the `Content Slot` control and, if they want, changes
   the tier in the sidebar. The sidebar and the panel offer the same seven controls with the same names.

Clicking "Add to canvas" a second time overwrites the existing `MemberGate.tsx` and inserts another
instance, rather than creating a second file. One component file per project, many instances. The second
set of panel values becomes the default for instances inserted from then on and does not disturb instances
already on the canvas, because Framer stores each instance's props on the node.

### 2.2. Visitor and Member Runtime Flow

1. Visitor loads a published page holding a gate. The gate mounts in its `checking` state, which renders
   the locked treatment, never the content.
2. The gate asks `GET /api/member/session` once per page, with credentials, and caches the answer at
   module scope for 60 seconds, so ten gates on one page make one request.
3. `200` resolves entitlement through `isEntitled`. `401` is a guest. `429`, `5xx`, and a network failure
   all resolve to locked.
4. An entitled member sees the protected frame rendered unmodified. Nothing is overlaid, nothing is
   filtered, no wrapper changes its layout.
5. A visitor who is not entitled sees the configured locked state: a frosted blur teaser, nothing at all,
   a redirect, or the lock card.
6. A later sign-in does not reveal the content by itself. The cache expires, or the page reloads, and the
   gate resolves again.

---

## 3. Architecture and File Inventory

### 3.1. Files

| Path | Task | Role |
| :--- | :--- | :--- |
| [`src/canvas-components/MemberGate.tsx`](../../src/canvas-components/MemberGate.tsx) | 1.7 | The authored component. Deployed to the creator's project verbatim |
| [`src/services/canvasComponentCodeGenerator.ts`](../../src/services/canvasComponentCodeGenerator.ts) | 1.4 | Reads the authored source and swaps in the creator's config block |
| [`src/services/framerCanvasService.ts`](../../src/services/framerCanvasService.ts) | 1.5 | Create or update the code file, then insert the instance |
| [`src/config/backend.ts`](../../src/config/backend.ts) | 1.4 | The API base URL, which PRD section 10.1 requires to live here |
| [`framer.json`](../../framer.json) | 1.6 | The first four permissions |
| [`src/types/framer-canvas.d.ts`](../../src/types/framer-canvas.d.ts) | 1.7 | Minimal declarations for the `framer` runtime module |
| [`src/utils/entitlement.ts`](../../src/utils/entitlement.ts) | 1.8 | The plugin's copy of the resolver |
| [`src/components/tabs/BuilderTab.tsx`](../../src/components/tabs/BuilderTab.tsx) | 1.3, 1.5 | Customizer, and now the live "Add to canvas" action |
| [`src/utils/framerMock.ts`](../../src/utils/framerMock.ts) | 1.5 | Widened with the four canvas calls |

### 3.2. Why The Authored Component Is A Real File, Not A String

The deployed component could have been a template literal inside the generator. It is a real `.tsx` file
imported with Vite's `?raw` suffix instead, for three reasons that are all gates rather than preferences:

1. `tsc --noEmit` typechecks it. A template literal is a string, so a missing brace in it reaches the
   creator's published site and breaks their page. This is the only code in the repo that runs on someone
   else's website, so it is the code that least deserves to be unchecked.
2. `npm run lint:css` scans it. The linter reads `.tsx` and `.ts` files line by line with no awareness of
   template literals, so the zero-inline-CSS rule now covers the deployed output as well as the panel.
3. The diff is readable. A change to the gate shows up as a change to a component rather than as a change
   to an escaped string.

`?raw` returns the file unmodified and untransformed, which is what the canvas needs: Framer compiles the
`.tsx` itself.

### 3.3. The `framer` Module Shim

`MemberGate.tsx` imports `addPropertyControls`, `ControlType`, and `RenderTarget` from `framer`. That
package is not and should not be installed: it is supplied by the Framer runtime on the canvas, not by
this repo, and the repo's own dependency is `framer-plugin`, a different library for a different surface.

So `src/types/framer-canvas.d.ts` declares the pieces of the `framer` module this component touches. The
shim buys the typecheck in section 3.2, and it carries a risk worth stating plainly: a shim cannot be wrong
in a way the compiler notices. If Framer's `RenderTarget` is not shaped the way the shim claims, nothing
here fails and the gate misbehaves on the canvas. That is why the first row of section 7 is a check in the
Framer desktop app, and why the shim is deliberately a handful of declarations rather than a convenience
copy of a whole API.

### 3.4. The Config Block And Why It Is Marked

The generator does not template the component. It replaces exactly one marked block:

```tsx
// @memberframe-config-start
const CONFIG: GateConfig = { ... };
// @memberframe-config-end
```

Everything else in the file is byte-identical between the repo and the creator's project. A generator that
interpolated values at twelve sites would have twelve ways to emit broken code. This one has a single
anchor pair, and it throws if either marker is missing or appears twice.

Property control defaults and the component's own prop defaults both read from `CONFIG`, so the panel, the
sidebar, and the rendered component cannot disagree about what the creator configured.

### 3.5. Styling

All canvas styling is one `cssContent` string injected through `<style>`, per PRD section 9.3 requirement 1.
Class names are prefixed `memberframe-`.

The blur radius is a number the creator drags, so it cannot be a static class. It is emitted as a CSS
custom property on a per-instance scope:

```
[data-memberframe-gate="<instance id>"] { --memberframe-gate-blur: 8px; }
```

`useId` supplies the instance id, so two gates on one page with different blur settings do not fight.

The canvas cannot use the plugin's design tokens: `design-tokens.css` is loaded by the plugin panel and
does not exist on a published site. So the gate's palette is declared inside `cssContent` as custom
properties on the component root, with a `prefers-color-scheme` block, and every rule reads those
properties. No rule body holds a hex value. That is the same shape the panel uses, with a different
declaration site.

---

## 4. Framer Property Controls Specification

All seven controls from PRD section 8 F01, unchanged in name, type, and default.

| Control Title | Control Type | Default Value | Description |
| :--- | :--- | :--- | :--- |
| Protected Frame | `ComponentInstance` | none | The frame to gate. Accepts any Framer frame or component |
| Access Tier | `Enum` | `signed_in` | Minimum tier that passes. Hierarchical, so a VIP passes a Silver gate |
| Locked State | `Enum` | `blur` | Frosted blur, hide completely, page redirect, or lock card |
| Redirect Target | `Link` | none | Hidden unless Locked State is page redirect |
| Lock Title | `String` | `Members Only Content` | Hidden unless Locked State is lock card |
| Lock Message | `String` | `Join or sign in to read this full guide.` | Hidden unless Locked State is lock card |
| Blur Amount | `Number`, 2 to 20, unit px | `8` | Hidden unless Locked State is frosted blur |

Each default is read from `CONFIG`, so a creator who customizes in the panel gets those values in the
sidebar, and a creator who customizes nothing gets F01's defaults.

`requiredTier` omits `anyone`, matching F01's own option list. A gate set to "Anyone" gates nothing, so it
is offered in neither surface. The resolver still accepts the value, because F07 and F09 need an ungated
branch.

---

## 5. Data Contracts and Core User Schema

### 5.1. Conflicts Found While Building This Feature

Five more contradictions surfaced in tasks 1.4 to 1.7. C1 and C2 are in
[`04-live-preview-studio.md`](04-live-preview-studio.md) section 5.1 and are still open. These are new.

| # | Conflict | Sources | Resolved as | Needs confirmation |
| :-- | :--- | :--- | :--- | :--- |
| C3 | Task 1.6 names the four permissions `createCodeFile`, `CodeFile.setFileContent`, `addComponentInstance`, `setParent`. `CodeFile.setFileContent` is not a permission string: the SDK maps that method key to the permission `setCodeFileContent`, and `framer.json` takes permissions | PRD section 15.4 task 1.6 vs `framer-plugin` 3.10.3 `PermissionMap` | `framer.json` declares `addComponentInstance`, `createCodeFile`, `setCodeFileContent`, `setParent`. `framer.isAllowedTo` is called with the method keys, which is the opposite namespace | No. The SDK is the authority and it is checkable. Recorded because the wrong string fails silently |
| C4 | F01 says the runtime hook "checks the local JWT and cached tier entitlement". Section 14.1 S2 says member sessions use HTTP-only cookies and forbids a JWT in `localStorage` | PRD section 8 F01 vs section 14.1 S2 | S2 wins. The gate reads no token anywhere. It calls `GET /api/member/session` with `credentials: "include"` and lets the browser send the HTTP-only cookie | No. S2 is the security requirement, and F01's sentence describes an implementation S2 forbids |
| C5 | `isEntitled` takes the site's tier table and compares ranks. `GET /api/member/session` returns `MemberSessionData`, which carries no tier table, and the canvas component cannot read the plugin's copy | PRD section 11.3 vs section 10.4 | The gate ships with the default four-tier ladder and uses it when the session carries none. **Recommendation: add `tiers` to the `/api/member/session` response.** It is the only call the gate makes | **Yes, before the backend schema is written.** Same deadline as C1 |
| C6 | Section 9.3 requirement 3 mandates `IS_LOCKED` and the lock-state marker in every component. `CLAUDE.md` forbids building F19 licensing before the core workflow | PRD section 9.3 vs `.agents/rules/` phase order | Both honoured. The static declarations, the marker comments, the frosted lock banner, and the trial watermark are in the component, because they are what F19's patcher rewrites and adding them later means editing 15 files. The 1-instance duplicate registry from the reference template is **not** included: that is enforcement behaviour and belongs to F19 | No |
| C7 | The reference master template uses `style={{ }}` for its own dynamic colour and radius props | `canvas-component-template.md` section 1 vs `.agents/rules/framer-sdd-standards.md` and PRD section 9.3 requirement 1 | The rule wins. Dynamic values are CSS custom properties inside `cssContent`. Precedence puts the references above the PRD but not above the rules, and the rule is unconditional | No |

C5 is the one that matters. A creator who renames Silver to "Pro" is fine, because the key is what gets
compared, but a creator who adds a fifth tier or re-ranks the ladder gets a gate resolving against a table
the backend does not agree with. It fails closed, so no content leaks, and gates will be shut that should
be open.

### 5.2. The Session Contract The Gate Consumes

```typescript
interface MemberSessionData {
  memberId: string;
  email: string;
  name: string | null;
  activeTier: "free_member" | "tier_1" | "tier_2" | "vip";
  status: "active" | "trialing" | "past_due" | "canceled";
  currentPeriodEnd: number;    // Unix seconds, UTC
  gracePeriodEndsAt: number;   // Unix seconds, UTC. Conflict C1
  siteId: string;
}
```

Declared a second time inside `MemberGate.tsx` rather than imported, because the deployed file cannot
import from this repo. Section 5.4 explains how the two copies are held together.

### 5.3. The Five Error Cases

PRD section 10.6 requires every call site to handle all five. The gate's column is "Required Canvas
Behavior", and all five of its rows mean locked:

| Case | Gate behaviour |
| :--- | :--- |
| `200` | Resolve `isEntitled`. Render content only if it returns true |
| `401` | Guest. Locked state, lock card CTA reads "Sign in to unlock" |
| `403` | Locked state, CTA reads "Upgrade to unlock" |
| `429` | Locked state. The module-scope cache holds the failure for its TTL, so no retry storm |
| `5xx` or network failure | Locked state. No crash, no blank frame |

The gate mounts in `checking`, which renders the same locked treatment. That is what satisfies the
section 16.4 line "Disabling JavaScript or blocking the API leaves gated content locked, never revealed":
no code path reveals content before entitlement resolves true.

### 5.4. Two Copies Of The Resolver, Held Together By A Test

PRD section 11.3: `isEntitled` is "implemented identically in the plugin, the canvas components, and the
backend. Divergence between the three is a security defect." The canvas copy cannot import the plugin's,
so this repo now holds two copies by necessity.

`test/memberGateParity.test.ts` reads both files from disk, extracts each `isEntitled` body, strips
comments, collapses whitespace, and asserts the two are the same text. An edit to one copy that is not
mirrored in the other fails `npm test`. The test also pins the status list, both time comparisons, and the
`>=` rank comparison individually, so a change that happens to normalize to the same length still fails.

The third copy, the backend's, is out of repo and cannot be checked from here. The test's header says so.

---

## 6. Verification and Testing Checklist

### 6.1. F01 Acceptance Criteria

| PRD criterion | Status | Evidence |
| :--- | :--- | :--- |
| A frame in `Content Slot` renders unmodified for an entitled member | Needs human | The entitled branch renders `contentSlot` with no wrapper, which is readable in the source, but "unmodified" is a visual claim about Framer's own layout |
| Each of the four fallback actions produces its distinct visual result | Needs human | Four branches exist and the selection logic is unit tested. Distinctness is pixels |
| `redirectUrl` is hidden in the sidebar unless `fallbackAction` is `redirect` | Needs human | The `hidden` predicate is in the generated controls and asserted present by test. Only Framer can show that the sidebar honours it |
| Tier comparison is hierarchical: a VIP passes a `tier_1` gate | Agent, done | `test/entitlement.test.ts`, plus the parity test proving the canvas copy compares the same way |
| A canceled member with `currentPeriodEnd` in the future still passes | Agent, done | `test/entitlement.test.ts`, including the boundary second |
| Gate renders its locked state, not a crash or blank frame, when the API is unreachable | Agent, partly | The five cases in section 5.3 are unit tested through the extracted resolver, and `checking` renders locked. The real unreachable-API render needs a published site |
| Zero inline CSS, verified by the linter | Agent, done | `npm run lint:css`, 0 violations, and the linter now reads the deployed component too |
| Light and dark contrast verified at WCAG AA against `data-framer-theme` | Needs human | Note that `data-framer-theme` does not exist on a published site. The gate uses `prefers-color-scheme`, the published-site equivalent. That reading of the criterion is worth confirming |

### 6.2. Standing Checklist

- [x] Zero inline CSS compliance verified (`npm run lint:css`).
- [x] `tsc --noEmit` and `npm run build` pass.
- [x] Strictly Lucide or Framer SVG icons used, zero unicode emoji.
- [x] Exactly one `.primary-cta` in the Builder tab.
- [ ] Light mode and dark mode colour contrast verified.
- [ ] Framer Property Controls render cleanly in the canvas sidebar.
- [ ] Backend API endpoints return proper status codes. The backend does not exist, blocker B1.
- [ ] F01 acceptance criteria all verified, see section 6.1.

---

## 7. Verified By Whom

| Check | Verified by | Date | Evidence |
| :--- | :--- | :--- | :--- |
| `framer` module shim matches the real runtime, section 3.3 | | | |
| Deploy path: create, insert, and the sidebar opens populated | | | |
| Second "Add to canvas" updates the file rather than duplicating it | | | |
| All seven controls appear in the sidebar with the right `hidden` behaviour | | | |
| Four locked states each render distinctly | | | |
| Entitled member sees the frame unmodified | | | |
| Light and dark contrast at WCAG AA on a published site | | | |
| Gated content stays locked with JavaScript disabled | | | |
| Automated gates | agent | 2026-10-12 | command output in the commit message |

---

## 8. Build Decisions

1. **The authored component is a real typechecked file, not a string.** Section 3.2. It is the only code
   here that runs on a stranger's website.
2. **One marked config block, not interpolation.** Section 3.4. One anchor pair has one failure mode.
3. **Module-scope session cache with a 60 second TTL.** PRD P4 forbids a request per gated element. Ten
   gates on a page make one request, and a failed request stays failed for the TTL, which is also what
   "no retry storm" asks for on a 429.
4. **The gate mounts locked.** There is no loading state that shows content. This is what makes the
   section 16.4 JavaScript-disabled line true by construction rather than by observation.
5. **`RenderTarget` guards the redirect.** A `redirect` gate that ran in the editor would navigate the
   creator's canvas away mid-edit. The same guard renders a visible placeholder for the `hide` state,
   which would otherwise be an unselectable zero-size component.
6. **The service returns an outcome, it does not notify.** `deployMemberGate` returns a tagged union and
   the Builder tab decides what the creator sees. That keeps the whole deploy path testable against the
   mock with no DOM.
7. **`setParent` is declared and implemented but not yet called by the panel.** Task 1.6 is the task that
   declares it, and `framer.json` permissions are static, so it cannot be added later without a manifest
   change. The reparenting path is exercised by test and the panel passes no parent, because inventing
   placement behaviour that cannot be verified in Framer would be guessing.
8. **Creator strings are serialized, never concatenated.** Every value entering generated code goes
   through `JSON.stringify`, and the enum and numeric fields are validated against their allowed values
   before emission. A lock title containing a quote is a syntax error in a naive generator, and the creator
   would see a broken published page rather than a validation message. U+2028 and U+2029 are the one thing
   `JSON.stringify` passes through raw that matters here, because they are invisible and they terminate a
   line for an older parser, so they are removed during sanitization rather than escaped: no lock title
   needs one. `test/canvasCodeGenerator.test.ts` decodes each emitted literal and asserts it round trips,
   including for a value that tries to close the string and append a second assignment.
9. **A redirect target is restricted to a relative path, a fragment, or an explicit http(s) URL.** The gate
   hands this value to `window.location.assign`, which executes a `javascript:` URL in some browsers, and
   `redirectUrl` is exactly the kind of field a creator pastes from somewhere else. Anything unrecognised
   becomes empty, which renders the lock card and stays put.
10. **The canvas shows the content, the panel shows the locked states.** On a canvas or thumbnail render the
   gate makes no request, never navigates, and renders the protected frame with a small "Gated" badge. A
   creator cannot arrange a frame they cannot see, and previewing the locked states is exactly what the F04
   Live Preview Studio exists for. This is the division of labour between the two features.
11. **The lock card CTA is text, not a control.** "Sign in to unlock" has nowhere to go until task 2.5
   authors `<MemberAuth>`. A button that does nothing on a visitor's site is worse than a label, and the
   same decision was already taken for the panel's preview in task 1.1.
