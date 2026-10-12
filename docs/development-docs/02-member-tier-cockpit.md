# Feature: In-Plugin Member and Tier Cockpit

Technical development specification, user flow, architectural wiring, and testing checklist for the Manage tab: the members table, the row action flyout, and the tier editor.

**PRD reference**: [F02](../memberframe-complete-prd.md) section 8
**Status**: in progress
**Tasks**: 2.2, 2.3 (see [`../IMPLEMENTATION-STATUS.md`](../IMPLEMENTATION-STATUS.md))

Task 2.7, the Home tab, carries F02 in its ledger row because PRD section 15.4 puts it there. Its content
is panel chrome rather than member administration, so it is documented in
[`00-plugin-shell.md`](00-plugin-shell.md) section 9 with the attribution noted.

---

## 1. Overview and Problem Solved

- **Feature Name**: In-Plugin Member and Tier Cockpit
- **Target Audience**: Framer Creator
- **Value Proposition**: every competitor sends the creator to an external web dashboard to change a price
  or move a member between tiers. This does it in the panel, next to the canvas the member is paying to
  see. The creator never context switches to answer "did Maya's payment go through".
- **Priority Tier**: P0: Core MVP

---

## 2. User Flows

### 2.1. In-Plugin Configuration Flow (Framer Designer)

1. Creator opens Manage. The segmented control defaults to Members.
2. The table loads page one, 25 rows, server side. Search filters by email and name, debounced at 300ms.
   Tier filter pills and status badges sit above the rows.
3. Clicking a row opens the action flyout: change tier, grant VIP, revoke access, send magic link.
4. Revoke access asks for confirmation in the flyout before it acts. Nothing else does, because nothing
   else is destructive.
5. Switching the segment to Tiers lists the site's tiers with their ranks and prices, and opens an editor
   on any of them. The Tiers segment carries the tab's one primary CTA, "Create tier". The Members segment
   has no primary CTA, per PRD section 7.3.

### 2.2. Visitor and Member Runtime Flow

None. F02 is creator-facing only and deploys nothing to the canvas. A member feels it indirectly: a tier
change here is what unlocks a gate for them on the next session check.

---

## 3. Architecture and File Inventory

### 3.1. Files

| Path | Task | Role |
| :--- | :--- | :--- |
| `src/components/tabs/ManageTab.tsx` | 2.2 | Segmented control, owns which segment is showing |
| `src/components/manage/MembersTable.tsx` | 2.2 | Search, filter pills, rows, pagination |
| `src/components/manage/MemberRow.tsx` | 2.2 | One row, badge, click target |
| `src/components/manage/MemberFlyout.tsx` | 2.2 | The four row actions, including the confirm step |
| `src/components/manage/TierEditor.tsx` | 2.3 | Tier list and the editing form |
| `src/components/manage/memberFilters.ts` | 2.2 | Pure query, label, and pluralization helpers |
| `src/components/manage/tierValidation.ts` | 2.3 | Pure draft validation, including rank uniqueness |
| `src/utils/money.ts` | 2.3 | Minor-unit parsing and formatting |
| `src/hooks/useDebouncedValue.ts` | 2.2 | The 300ms search debounce |
| `src/services/siteService.ts` | 2.2, 2.3 | The PRD section 10.3 calls, through the API client |
| `src/types/site.ts` | 2.2, 2.3 | `SiteMemberRecord`, `SiteTierRecord`, `SiteGatewayConfig` |
| `src/styles/manage.css` | 2.2, 2.3 | Table, pills, flyout, tier rows |

### 3.2. The Logic Is Pure And The Components Are Thin

`jsdom` is still not installed (blocker B5), so no test in this repo renders a component. That is a
constraint on where logic may live, not an excuse for not testing it.

Everything with a decision in it was pulled into a pure module: the search query builder, the filter
predicate, the label maps, the pluralizer, the money parser, and the whole of tier validation. Those are
unit tested properly. What remains in the `.tsx` files is markup and event wiring, which is the part a
human has to look at anyway.

This is why `tierValidation.ts` exists as a separate file from `TierEditor.tsx`. The rank uniqueness rule
is the single most consequential piece of logic in F02, because PRD section 11.2 makes `rank` the thing
hierarchical entitlement compares, and a duplicate rank makes the comparison ambiguous. It is not going to
live inside a submit handler.

### 3.3. Money Is Integer Minor Units, And Parsing It Is Not A One-Liner

PRD section 11.2: "All money stored as integer minor units. Floating point currency produces rounding
errors." The creator types `9.99` into a text field and the backend must receive `999`.

`parseMinor` works on the decimal string and never produces a float: split on the separator, pad the
fraction, assemble an integer.

**The stated reason for that is usually wrong, and this one was too at first.** The familiar argument is
that `Math.round(parseFloat("1.005") * 100)` yields 100 rather than 101. True, and not the reason, because
a three-decimal value is refused here before any conversion happens, and at two decimal places the
rounding absorbs the representation error so the float route agrees. The first version of this document
made that overstated claim and the tests caught it.

The reason that survives is that `parseFloat` accepts things that are not prices: `"1e5"` becomes 100000,
`"9.99abc"` becomes 9.99, `"Infinity"` becomes Infinity, `"0x10"` becomes 0. Each is a silently wrong
price on a monthly charge. `test/money.test.ts` pins every case and also asserts that `parseFloat` really
does accept it, so the comparison is not a straw man.

**Over-precise input is refused, not reshaped.** This also started out wrong. Truncating was the first
implementation, and a test showed what it costs: `"1,999"` means one thousand nine hundred ninety nine on
a US keyboard and one point nine nine nine on a German one, and truncating silently priced it at 1.99.
That is a 1000x mispricing with nothing on screen to show it happened. Rounding is no better: `"0.999"`
becoming 1.00 charges a cent the creator did not type. Both forms are genuinely ambiguous without knowing
the creator's locale, so `parseMinor` refuses and they retype. This also brings it in line with
`tierValidation.ts`, whose own regex already allowed at most two decimal places.

Two-digit minor units are assumed by default. That is correct for USD, EUR, GBP, and INR, which is the
whole of PRD section 10's `defaultCurrency` union, and wrong for JPY and KWD. The exponent is a parameter
so the assumption is visible rather than buried, and section 5.1 records it as C12.

Two-digit minor units are assumed. That is correct for USD, EUR, GBP, and INR, which is the whole of PRD
section 10's `defaultCurrency` union, and wrong for JPY and KWD. The function takes the exponent as a
parameter defaulting to 2 so the assumption is visible rather than buried, and section 5.1 records it.

### 3.4. The Table With No Backend

The backend does not exist (blocker B1) and no task builds creator authentication (C10 in
[`00-api-client.md`](00-api-client.md)), so every `/api/site/members` call resolves `unauthorized` today.

The table is built fully and driven entirely by props, so it will light up unchanged when the API arrives.
Its four states are all implemented and all reachable by passing props:

| State | What shows |
| :--- | :--- |
| Loading | A row-shaped placeholder, not a spinner, so the layout does not jump |
| Empty | `.empty-state` with exactly one action, "Create your first tier", which is F02's own wording and switches the segment to Tiers |
| Error | A `Banner` with a retry action. The panel stays usable, per PRD section 10.6 |
| Signed out | A `Banner` explaining that the connection is not configured yet, which is what a creator sees today |

The empty state having a tier action rather than a member action is F02's instruction, and it is right: a
site with no tiers cannot have members, so the next step is a tier.

---

## 4. Framer Property Controls Specification

Not applicable. F02 deploys nothing to the canvas.

---

## 5. Data Contracts and Core User Schema

### 5.1. Conflicts Found While Building This Feature

| # | Conflict | Sources | Resolved as | Needs confirmation |
| :-- | :--- | :--- | :--- | :--- |
| C8 | `SiteTierRecord` is declared twice with different shapes. PRD section 11.3's resolver uses a tier table with `key`, `rank`, and `name`. F02 declares `SiteTierRecord` with ten fields including `id`, `siteId`, three prices, `currency`, and `isActive` | PRD section 8 F02 vs section 11.3 | F02's ten-field version is the entity and keeps the name. The resolver's parameter narrows to `TierRankRecord`, a `Pick` of `key` and `rank`, because rank comparison is all it reads. The full record is assignable to it, so callers pass real tiers unchanged | No. F02's is a superset and the narrowing is mechanical |
| C9 | F02's `SiteTierRecord.key` is typed `string` and commented `"tier_1" \| "tier_2" \| "vip" \| custom`, so creators may define custom tier keys. F01's `requiredTier` property control is a fixed `Enum` of five options, so a custom key cannot be selected on a gate | PRD section 8 F02 vs section 8 F01 | Phase 1 ships the four fixed keys. The gate's `Enum` options are **generated per creator**, so the natural fix is for the code generator to emit the site's actual tier keys once `GET /api/site/tiers` exists, which also resolves C5 | **Yes, before custom tiers are offered in the UI.** Until then the tier editor accepts only the four known keys, and says so |
| C12 | Minor units are assumed to have two decimal places | PRD section 11.2 and section 10 `defaultCurrency` vs ISO 4217 | `parseMinor` and `formatMinor` take the exponent as a parameter, defaulting to 2. Correct for USD, EUR, GBP, and INR, which is the whole of the supported currency union. JPY has 0 and KWD has 3 | Only if a zero-decimal or three-decimal currency is ever added |

C9 is the interesting one. The generator writing a per-creator component file is not just a way to carry
customizer defaults: it is the mechanism by which a site's own tier ladder can reach a property control
that is otherwise a hardcoded list. That is worth knowing before anyone designs custom tiers.

### 5.2. Entities

`SiteMemberRecord` and `SiteTierRecord` are copied from F02 unchanged, with the `key` field narrowed to
`TierKey` per C9 and both `status` fields pointing at the existing `MemberStatus` so the member table and
the entitlement resolver cannot disagree about what a status is.

```typescript
export interface SiteMemberRecord {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  tier: TierKey;
  status: MemberStatus;
  createdAt: string;        // ISO 8601
  lifetimeSpend: number;    // Minor units
  currency: CurrencyCode;
  gateway: GatewayId;
}
```

### 5.3. What A Row Action Sends

| Action | Call | Confirmation |
| :--- | :--- | :--- |
| Change tier | `PATCH /api/site/members/:id` with `{ tier }` | None |
| Grant VIP | `PATCH /api/site/members/:id` with `{ tier: "vip" }` | None |
| Revoke access | `PATCH /api/site/members/:id` with `{ status: "canceled" }` | **Yes, in the flyout** |
| Send magic link | `POST /api/site/members/:id/magic-link` | None |

Grant VIP is a change tier with a fixed argument rather than its own endpoint, because PRD section 10.3
has no grant route and inventing one would be a contract change for a shortcut button.

---

## 6. Verification and Testing Checklist

### 6.1. F02 Acceptance Criteria

| PRD criterion | Status | Evidence |
| :--- | :--- | :--- |
| Member search filters by email and name, debounced at 300ms | Agent, partly | `useDebouncedValue` is tested with fake timers at the 299ms and 300ms boundaries, and `matchesQuery` is tested against both fields. That the rendered input is wired to it needs a human |
| Tier filter pills and status badges use token colors, never hardcoded hex | Agent, done | `manage.css` carries no hex. Badges reuse the kit's existing `.badge-*` classes |
| Changing a member tier reflects within 2 seconds and shows a toast under 45 characters | Agent, partly | Every toast string in the feature is asserted under 45 characters. The 2 second round trip needs a backend |
| Revoke access requires a confirmation step before acting | Needs human | The flyout holds a two-step state and the service is not called in step one. Proving it on screen needs a render |
| Tier `rank` drives hierarchical entitlement and cannot be duplicated across tiers | Agent, done | `tierValidation.ts`, rejecting a duplicate rank against siblings, with the editing tier excluded from its own check |
| Empty member list renders `.empty-state`, never a blank area | Needs human | The branch exists and returns `EmptyState`. Pixels need a human |
| Table remains usable at 360px with no horizontal page scroll | Needs human | `manage.css` gives the table a fixed grid and ellipsis truncation rather than a min-width. Only a render proves it |

### 6.2. Standing Checklist

- [x] Zero inline CSS compliance verified (`npm run lint:css`).
- [x] `tsc --noEmit` and `npm run build` pass.
- [x] Lucide icons only, zero unicode emoji.
- [x] Exactly one `.primary-cta` across both segments, and it is on Tiers.
- [x] No raw enum value reaches a user-facing string, asserted by test.
- [x] Counts are pluralized properly, asserted by test.
- [ ] Light and dark colour contrast verified.
- [ ] Usable at 360px with no horizontal scroll.
- [ ] A real member list from a real backend. Blocker B1.

---

## 7. Verified By Whom

| Check | Verified by | Date | Evidence |
| :--- | :--- | :--- | :--- |
| Table at 360px, no horizontal scroll | | | |
| Search feels responsive, debounce is not perceptible as lag | | | |
| Revoke access cannot act without the confirm step | | | |
| Empty state renders with one action | | | |
| Flyout is keyboard reachable and closes on Escape | | | |
| Light and dark contrast at WCAG AA | | | |
| A real member list, a real tier write | | | |
| Automated gates | agent | 2026-10-12 | command output in the commit message |

---

## 8. Build Decisions

1. **Every decision is in a pure module, every component is markup.** Section 3.2. With no DOM test
   environment, logic inside a component is logic nothing can check.
2. **Rank uniqueness is validated against siblings with the edited tier excluded.** Otherwise editing a
   tier without changing its rank reports a collision with itself, which is the obvious bug in this rule.
3. **Money parsing never touches a float, and over-precise input is refused rather than reshaped.**
   Section 3.3. Both halves of this were corrected after the tests disagreed with the first version: the
   float argument as usually stated is weaker than it sounds, and truncation silently misprices `"1,999"`
   by a factor of a thousand.
4. **The minor-unit exponent is a parameter.** It defaults to 2 and is correct for every currency the PRD
   supports, so the assumption is visible instead of load bearing and invisible.
5. **Revoke is the only action with a confirm step.** F02 asks for one there. Adding confirmations to the
   other three would train the creator to dismiss them.
6. **Grant VIP reuses the tier endpoint.** No new contract surface for a shortcut.
7. **The empty state points at tiers, not members.** F02's own wording, and correct: members cannot exist
   before a tier does.
8. **The table's four states are all built now, with no data to show.** They are prop driven, so the
   backend arriving is a wiring change rather than a UI change.
