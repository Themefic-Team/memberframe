# Feature: Live Preview Studio With Auth State Simulator

Technical development specification, user flow, architectural wiring, and testing checklist for the Live Preview Studio.

**PRD reference**: [F04](../memberframe-complete-prd.md) section 8, plus sections 7.4 and 7.5
**Status**: in progress
**Tasks**: 1.1, 1.2, 1.3 (see [`../IMPLEMENTATION-STATUS.md`](../IMPLEMENTATION-STATUS.md))

Task 1.3 is a shared task. Its customizer surface is specified here because it drives the studio. The `<MemberGate>` component it configures belongs to F01 and is documented in [`01-member-gate.md`](01-member-gate.md), written with tasks 1.4 to 1.8.

---

## 1. Overview and Problem Solved

- **Feature Name**: Live Preview Studio with Auth State Simulator
- **Target Audience**: Framer Creator
- **Value Proposition**: A creator sees exactly how a gated component looks to a guest, a free member, a Silver subscriber, a VIP, and a member whose payment failed, without inserting anything on the canvas and without publishing. FrameAuth and Thenty offer no in-panel preview at all: a designer there has to insert, publish, then open the live site in an incognito window to see the locked state. Each state check is a publish cycle. Here it is one click.
- **Priority Tier**: P0: Core MVP

The five states are the whole point. The locked state is the one a creator never sees during normal work, because the creator is always signed in as themselves. That is exactly the state their paying visitors see most often.

---

## 2. User Flows

### 2.1. In-Plugin Configuration Flow (Framer Designer)

1. Creator opens the Builder tab.
2. The component picker shows all 15 insertable canvas components. Member Gate is selected by default.
3. The preview viewport renders the selected component at true scale against the live design tokens.
4. Creator picks a state from the segmented switcher: Guest, Free, Silver, VIP, or Failed.
5. The preview re-renders in that state. A caption under the switcher spells out what the state means in plain language, for example "Payment failed and the grace window has closed."
6. Creator edits the customizer rows: lock title, lock message, blur amount, required tier, fallback action. The preview follows each keystroke.
7. Creator clicks "Add to canvas", the tab's single primary CTA.

Step 7 is inert in this task group. The deploy path needs `framer.createCodeFile` and `addComponentInstance`, and `framer.json` permissions stay `[]` until task 1.6. The button is therefore rendered disabled with a visible reason rather than hidden, so the flow reads correctly and nothing fails silently.

### 2.2. Visitor / Member Runtime Flow

None. F04 is a creator-facing design surface. It renders no canvas component, issues no network request, and reaches no visitor. The runtime flow for what it previews lives in F01.

---

## 3. Architecture and File Inventory

### 3.1. Plugin UI Components

| Path | Task | Role |
| :--- | :--- | :--- |
| `src/components/studio/PreviewStudio.tsx` | 1.1 | Viewport frame, state caption, and the CSS variable bridge |
| `src/components/studio/StateSwitcher.tsx` | 1.1 | Five-state segmented switcher |
| `src/components/studio/componentRegistry.ts` | 1.1 | The 15 picker entries and which have a preview yet |
| `src/components/studio/previews/MemberGatePreview.tsx` | 1.1 | The one real preview: all four fallback actions |
| `src/components/studio/previews/PendingPreview.tsx` | 1.1 | Honest placeholder naming the task that will fill it |
| `src/components/studio/index.ts` | 1.1 | Barrel |
| `src/components/tabs/BuilderTab.tsx` | 1.3 | Picker, studio, customizer, one primary CTA |
| `src/components/ui/TextField.tsx` | 1.3 | 30px text input on `.framefic-input` |
| `src/components/ui/Select.tsx` | 1.3 | 30px select on `.framefic-select` |
| `src/components/ui/Slider.tsx` | 1.3 | 30px range control with a value readout |

### 3.2. Hooks And Types

| Path | Task | Role |
| :--- | :--- | :--- |
| `src/hooks/useMemberSession.ts` | 1.2 | Context, provider, hook, and the five fixtures |
| `src/types/member.ts` | 1.2 | `MemberSessionData`, `SiteTierRecord`, tier keys, label maps |
| `src/types/canvas.ts` | 1.3 | `MemberGateConfig`, the draft the customizer edits |
| `src/types/index.ts` | 1.2 | Barrel, per PRD section 6.3 |
| `src/utils/entitlement.ts` | 1.8, pulled forward | The shared `isEntitled` resolver |

### 3.3. Why Task 1.8 Was Pulled Forward

F04 acceptance criterion one is "All five states render distinctly." A preview cannot distinguish Silver from VIP from Failed without resolving entitlement, so the resolver is a hard prerequisite of 1.1, not a later task. It is implemented now from PRD section 11.3 verbatim.

This is the same call made for task 0.9, which was pulled forward alongside 0.4 because the collapse button lived in the shell and shipping the shell without it would have shipped a dead control. The precedent is recorded in the ledger note on 0.9.

Pulling it forward is also the safer order. PRD section 11.3 calls divergence between the three implementations a security defect. Writing the plugin copy first, with tests, gives tasks 1.7 and the backend a fixed reference instead of three parallel guesses.

### 3.4. Backend API Endpoints

None. F04 is specified "entirely client side. No backend calls, so it works offline and during trial." The provider has no fetch path at all, which is why acceptance criterion four, "Preview never issues a network request", is structurally true rather than merely observed.

### 3.5. Styling

`src/styles/builder.css`, a new per-feature file. Strict zero inline CSS.

It cannot go in `components.css`: that file is a verbatim slice of `.agents/skills/framer-plugin-suite/references/design-tokens.css` guarded by a provenance `diff`, and hand-editing it breaks the drift check. Same constraint that forced DEF-01's fix into `shell.css`.

Classes reused from the kit: `.field-rows`, `.field-row`, `.framefic-input`, `.framefic-select`, `.framefic-segmented`, `.framefic-segment`, `.badge`, `.primary-cta`. New in `builder.css`: the preview viewport, the range slider (the kit has no slider), and the preview's own `memberframe-` prefixed gate classes.

### 3.6. The CSS Variable Bridge

PRD F04 requires "dynamic CSS variable overrides for the customizer values". Blur radius is a number the creator drags, so it cannot be a static class.

`style={{ }}` is prohibited, and `npm run lint:css` rejects it on sight. The studio therefore holds a `ref` to the viewport element and calls `element.style.setProperty("--memberframe-preview-blur", ...)` inside a `useEffect`. The linter's regex targets `style={{` in JSX and does not match this, and more to the point the rule exists to keep styling out of markup, which this honours: the CSS still declares every rule, and only a single scalar crosses the boundary.

`useEffect` after paint also satisfies performance target P2, "within one animation frame of a customizer change", because React batches the state update and the property write lands in the same frame.

---

## 4. Framer Property Controls Specification

F04 deploys no canvas component, so it declares no property controls of its own. The customizer edits a draft of F01's controls, which is why the two tasks are paired. Mapping:

| Customizer row | Maps to F01 control | Control type | Default |
| :--- | :--- | :--- | :--- |
| Required tier | `requiredTier` | `ControlType.Enum` | `signed_in` |
| Locked state | `fallbackAction` | `ControlType.Enum` | `blur` |
| Blur amount | `blurIntensity` | `ControlType.Number`, 2 to 20, px | `8` |
| Lock title | `cardTitle` | `ControlType.String` | `Members Only Content` |
| Lock message | `cardDescription` | `ControlType.String` | `Join or sign in to read this full guide.` |
| Redirect target | `redirectUrl` | `ControlType.Link` | empty |

`contentSlot` has no customizer row. It is a `ControlType.ComponentInstance` bound on the canvas after insertion, so there is nothing for the panel to edit. The preview stands in for it with a labelled placeholder block.

The customizer mirrors F01's `hidden` predicates: the blur row only appears for `blur`, the title and message rows only for `custom_card`, the redirect row only for `redirect`. Showing all five rows at once would misrepresent what the canvas sidebar will actually offer.

---

## 5. Data Contracts and Core User Schema

```typescript
/** Canonical tier keys. One key space for configured tiers and held tiers. */
export type TierKey = "free_member" | "tier_1" | "tier_2" | "vip";

/** What a gate can require. The two pseudo-tiers are not ranked. */
export type RequiredTier = "anyone" | "signed_in" | TierKey;

export type MemberStatus = "active" | "trialing" | "past_due" | "canceled";

export interface MemberSessionData {
  memberId: string;
  email: string;
  name: string | null;
  activeTier: TierKey;
  status: MemberStatus;
  /** Unix seconds. A canceled member keeps access until this moment. */
  currentPeriodEnd: number;
  /** Unix seconds. A past_due member keeps access until this moment, F18. */
  gracePeriodEndsAt: number;
  siteId: string;
}

export interface SiteTierRecord {
  key: TierKey;
  /** Unique per site, PRD section 11.2. Higher outranks lower. */
  rank: number;
  name: string;
}

/** The five previewable states. Local to the studio, never persisted. */
export type SimulatedState = "guest" | "free" | "silver" | "vip" | "failed";
```

Nothing here is persisted and nothing is transmitted. The provider holds it in React state for the lifetime of the panel.

### 5.1. Two Data Contract Conflicts Found In The PRD

Both are recorded rather than silently resolved, per `CLAUDE.md`. Neither is in the seven already settled in PRD section 17, so both are new.

**Conflict A: `gracePeriodEndsAt` is used but never declared.**

PRD section 11.3's `isEntitled` reads `session.gracePeriodEndsAt`:

```typescript
(session.status === "past_due" && Date.now() / 1000 < session.gracePeriodEndsAt)
```

F01's `MemberSessionData` interface at PRD line 594 declares seven fields and `gracePeriodEndsAt` is not among them. As written, the specified resolver does not typecheck against the specified interface.

Resolved here as the superset: the field is declared. Section 11.3 is the security-critical contract implemented identically in three places, and F18 depends on the grace window existing. Dropping the field would mean a `past_due` member loses access the instant a payment fails, which contradicts F18 outright. **Confirm before the backend schema is written**, because this is a column.

**Conflict B: two incompatible tier key spaces.**

F01's `requiredTier` control enumerates `signed_in`, `free_member`, `tier_1`, `tier_2`, `vip`. F01's `MemberSessionData.activeTier` comments `"free" | "silver" | "gold" | "vip"`. Section 11.3 then compares them through one lookup:

```typescript
const required = tiers.find((t) => t.key === requiredTier);
const held = tiers.find((t) => t.key === session.activeTier);
```

A single `tiers` array cannot satisfy both spellings. With the PRD read literally, a Silver subscriber holding `silver` fails a `tier_1` gate, because `held` resolves to `undefined` and the resolver returns `false`. That is a silent total gating failure, not a cosmetic mismatch.

Resolved here in favour of the control values, `free_member` / `tier_1` / `tier_2` / `vip`, because those are the strings baked into the `<MemberGate>` property control and therefore visible in Framer's sidebar and embedded in generated canvas code. `free` / `silver` / `gold` / `vip` are read as display names, which is what `SiteTierRecord.name` now carries. **Confirm before task 1.7.**

### 5.2. The Five Fixtures

Each state has to be visibly distinct and has to exercise a different branch of the resolver, otherwise the switcher is decorative.

| State | Session | `status` | `activeTier` | Passes a `tier_1` gate | Branch exercised |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Guest | `null` | n/a | n/a | No | `!session` early return |
| Free | present | `active` | `free_member` | No | rank 0 below rank 1 |
| Silver | present | `active` | `tier_1` | Yes | rank equal |
| VIP | present | `active` | `vip` | Yes | rank 3 above rank 1, the hierarchy rule |
| Failed | present | `past_due` | `tier_1` | No | grace window closed |

The Failed fixture puts `gracePeriodEndsAt` **in the past**, three days back. This is a deliberate decision and not an oversight. With it in the future the resolver would correctly return `true` and Failed would render identically to Silver, making the fifth state indistinguishable from the third and the switcher a four-state control wearing five labels. PRD section 7.4 names the state "Expired / Payment Failed", and expired is the half that is worth seeing.

Every fixture timestamp is derived from an injected `nowSeconds` argument defaulting to `Date.now() / 1000`, so the tests pin time instead of racing it.

---

## 6. Verification and Testing Checklist

- [ ] Light mode and dark mode color contrast verified with `data-framer-theme`. **Needs human.**
- [x] Zero inline CSS compliance verified (`npm run lint:css`).
- [ ] Framer Property Controls render cleanly in canvas sidebar. **Not applicable to F04.** F01, task 1.7.
- [x] Backend API endpoints return proper status codes and handle network errors gracefully. **Not applicable.** F04 has no network path by design.
- [x] All action buttons utilize `.primary-cta` double-gradient standard, exactly one per view. One CTA in the Builder tab, "Add to canvas".
- [x] Strictly Lucide or Framer SVG icons used (zero unicode emojis).
- [ ] Acceptance criteria from PRD section 8 F04 all verified. Four of five, see below.
- [x] `tsc --noEmit` and `npm run build` pass.

### 6.1. F04 Acceptance Criteria

| Criterion | Status | Evidence |
| :--- | :--- | :--- |
| All five states render distinctly with no console errors | Partly agent | Distinctness is proven as logic: `test/entitlement.test.ts` asserts a different outcome per fixture, and the Failed fixture is pinned past its grace window so it cannot collapse onto Silver. The rendered pixels and a clean console **need a human** |
| Customizer changes reflect in the preview within one animation frame | Agent, by construction | React state drives the markup, and the one scalar override is written in a post-paint `useEffect`. Measuring the actual frame budget **needs a human** with the Framer devtools performance panel |
| Preview respects `data-framer-theme` and re-renders on workspace theme change | Needs human | The studio consumes only tokens and adds no colour of its own, so it inherits the behaviour verified for the shell in task 0.6. Unverified against a real workspace theme flip |
| Preview never issues a network request, verified in the network panel | Agent, structurally | No `fetch`, no `XMLHttpRequest`, no SDK call in `src/components/studio/` or `useMemberSession.ts`. Grep-verifiable. Still worth one glance at the network panel |
| Preview renders correctly for all 15 canvas components in the picker | **Deferred, and honestly so** | Fourteen of the fifteen components do not exist yet. The registry carries all 15 entries so the picker is complete, and each unbuilt entry renders a placeholder naming the task that will fill it. This criterion closes incrementally through Phases 2 to 4, and cannot be ticked in Phase 1 by any amount of effort |

### 6.2. Automated Tests Added

| File | Layer | Covers |
| :--- | :--- | :--- |
| `test/entitlement.test.ts` | 1, pure logic | All five fixtures against `anyone`, `signed_in`, and all four tier gates. The hierarchy rule, the canceled-until-period-end rule, the grace-window rule, and the unknown-tier fail-closed path |
| `test/memberSession.test.ts` | 1, pure logic | Fixture shape per state, that Guest is `null`, that timestamps derive from the injected clock, and that the Failed fixture's grace window really is in the past |

Both are node-environment tests over pure functions, which is the only layer the harness supports. Nothing in this feature's **rendering** is covered, because `jsdom` is still not installed. That is blocker B5, and DEF-01 is the standing proof of what it costs: a tab bar with three tabs pushed out of the panel passed all four gates.

---

## 7. Verified By Whom

The agent cannot see rendered pixels in the Framer desktop app, and cannot exercise live payment gateways.

| Check | Verified by | Date | Evidence |
| :--- | :--- | :--- | :--- |
| Five states render distinctly in the panel | | | |
| Customizer keystroke to preview feels immediate | | | |
| Theme flip re-renders the preview, both themes at WCAG AA | | | |
| Network panel stays empty while the studio is open | | | |
| Conditional rows appear and hide per fallback action | | | |
| Automated gates | agent | 2026-10-12 | `lint:css`, `tsc --noEmit`, `npm test`, `npm run build` output |
| Entitlement logic per state | agent | 2026-10-12 | `test/entitlement.test.ts` |

---

## 8. Decisions Made While Building

1. **The resolver came first.** Task 1.8 was pulled forward because 1.1's first acceptance criterion depends on it. See section 3.3.
2. **Two PRD data contract conflicts surfaced, not silently resolved.** See section 5.1. Both need confirmation, Conflict B before task 1.7.
3. **The Failed fixture is past its grace window.** Otherwise the fifth state is a duplicate of the third. See section 5.2.
4. **CSS variables are written through a ref, not an inline style.** The only route that satisfies both the F04 requirement for dynamic overrides and the zero-inline-CSS rule. See section 3.6.
5. **All 15 picker entries exist from day one; 14 render a placeholder that names its own task.** A picker that lists only what is built would misrepresent the roadmap and would need editing 14 more times. A placeholder that names the task is honest about why it is empty.
6. **"Add to canvas" is disabled, not hidden.** The deploy path needs permissions that `framer.json` will not declare until task 1.6. A hidden CTA would leave the Builder tab with no primary action and make the tab look unfinished rather than staged.
7. **Three controls were added to the UI kit rather than written inline.** Text field, select, and slider. The first two already had kit CSS classes with nothing rendering them. The slider had no class at all, so its CSS is new and lives in `builder.css`.
8. **The state caption is prose, not an enum.** PRD section 7.6 rule 4 forbids surfacing raw values like `past_due`. The switcher reads "Failed" and the caption underneath explains the consequence in a sentence.
