# MemberFrame Implementation Status

The task ledger. One row per numbered task in [`memberframe-complete-prd.md`](memberframe-complete-prd.md) section 15.

**Read this first in every session.** It is the single source of truth for what is done. The PRD says what to build; this says where we are.

Last updated: 2026-10-15

---

## How To Use This File

**Status values**: `todo`, `in progress`, `awaiting review`, `done`, `blocked`.

**The loop**, also in [`../CLAUDE.md`](../CLAUDE.md):

```
read the row -> read the PRD section -> write the development doc -> code
  -> npm run lint:css && npx tsc --noEmit && npm run build
  -> set status to "awaiting review"
  -> the agent PROPOSES a commit message and stops
  -> the user reviews and commits
  -> next session, the agent backfills the SHA from git log and sets "done"
```

**The agent does not commit.** The user reviews every change before it enters history. See `CLAUDE.md`.

**Rules for this file:**

- `awaiting review` means the code is written and the gates passed, but nothing is committed yet.
- A row goes to `done` only once a commit exists. **No SHA means not done.**
- Never mark `done` on the strength of code being written. Written is not verified.
- Rows whose verification needs a human (rendered pixels, live gateways) stay `awaiting review` until that person signs section 7 of the feature's development doc.
- `git log --oneline | grep task` cross-checks this file. A `done` row with no matching commit is a defect in the record: report it, do not quietly fix it.

---

## Progress

| Phase     | Scope                                             | Tasks  | Done   |
| :-------- | :------------------------------------------------ | :----- | :----- |
| 0         | Scaffold from the clean slate                     | 12     | 12     |
| 1         | Foundation and core gating (weeks 1 to 2)         | 16     | 0      |
| 2         | Global payments, paywalls, LMS (weeks 3 to 4)     | 18     | 0      |
| 3         | B2B, CMS, member self-service (weeks 5 to 6)      | 11     | 0      |
| 4         | Community, localization, packaging (weeks 7 to 8) | 15     | 0      |
| **Total** |                                                   | **72** | **12** |

69 tasks come from PRD section 15. Tasks 0.10 to 0.12 were added on 2026-10-11 and are marked `added` below.

**A second track opened on 2026-10-12.** The fourteen feature plans in [`docs/features-plan/`](features-plan/) are delivered feature by feature rather than task by task, and they are tracked in their own table under [Feature Plans](#feature-plans) below. The phase tables stay authoritative for the PRD's own 72 tasks. FP-02, email and password authentication, is the first one delivered and sits at `awaiting review`.

**Phase 0 is closed.** Rows 0.4 to 0.9 were backfilled to `done` against `cd5c248` on 2026-10-12. `done` here means a commit exists, not that a human has seen the rendered panel: the Framer-side checks for 0.2 and 0.4 to 0.7 are still open in [`qa-review/phase-0-qa-review.md`](qa-review/phase-0-qa-review.md).

**Caveat on 0.7**: `cd5c248` shipped the tab bar with defect DEF-01, where three of the four tabs overflowed out of the panel. The one-rule fix in `src/styles/shell.css` is written and gate-green but **not yet committed**, so the row is `done` on an SHA that does not contain its own fix. The follow-up commit closes this.

**Phase 1 shows 0 done and that is accurate.** All sixteen rows, 1.1 to 1.8 and 2.1 to 2.8, sit at `awaiting review` with the work unstaged in the tree. `done` requires a commit, and `git log` is the second ledger: a row claiming `done` with no matching SHA is a defect in the record, so the count stays at 0 until the user commits. Phase 1 is now feature complete against PRD section 15.4 and its **exit criteria are not met**, because they end with "a visitor signs in by OTP, pays through Stripe, and the gate unlocks on the published site", and all three of those need the backend. The QA script for the phase is [`qa-review/phase-1-qa-review.md`](qa-review/phase-1-qa-review.md), written on 2026-10-12 and unsigned.

---

## Phase 0: Scaffold From The Clean Slate

PRD section 15.2. Brings `src/` to a working shell without building any feature.

| #    | Task                                                     | Output                          | Status | Commit    |
| :--- | :------------------------------------------------------- | :------------------------------ | :----- | :-------- |
| 0.1  | Fix the lint script path defect                          | `package.json`                  | done   | `68fee92` |
| 0.2  | Copy the reference design tokens into the project        | `src/styles/design-tokens.css`  | done   | `4c4d5f5` |
| 0.3  | Create `docs/development-docs/`                          | directory plus README index     | done   | `68fee92` |
| 0.4  | Build the four-part shell                                | `src/components/shell/*`        | done   | `cd5c248` |
| 0.5  | Build the shared UI kit                                  | `src/components/ui/*`           | done   | `cd5c248` |
| 0.6  | Wire the theme hook                                      | `src/hooks/useFramerTheme.ts`   | done   | `cd5c248` |
| 0.7  | Add the four empty tabs                                  | `src/components/tabs/*`         | done   | `cd5c248` |
| 0.8  | Add the SDK mock                                         | `src/utils/framerMock.ts`       | done   | `cd5c248` |
| 0.9  | Add the collapse toggle                                  | `src/App.tsx`                   | done   | `cd5c248` |
| 0.10 | Write `CLAUDE.md` so the rules load each session (added) | `CLAUDE.md`                     | done   | `68fee92` |
| 0.11 | Write this ledger (added)                                | `docs/IMPLEMENTATION-STATUS.md` | done   | `68fee92` |
| 0.12 | Create the five sub-agents in Claude Code format (added) | `.claude/agents/*.md`           | done   | `68fee92` |

**Exit criteria**: panel opens in Framer with zero console errors, all four tabs navigate, theme switches cleanly, `npm run lint:css` passes, `tsc --noEmit` passes, `npm run build` succeeds.

**Note on 0.2**: the reference file at `.agents/skills/framer-plugin-suite/references/design-tokens.css` is 2642 lines and holds both token layers and component classes. Only the token layers (reference lines 1 to 256, sections 1 and 2 plus the forced-dark block) were copied, because PRD section 6.3 lists `design-tokens.css` and `components.css` as separate files. The component classes land in `components.css` when task 0.4 and 0.5 need them. The copy is byte-identical below its provenance header, so drift is a one-line `diff`.

**Note on 0.4 to 0.7**: all four share one development doc, [`development-docs/00-plugin-shell.md`](development-docs/00-plugin-shell.md), because they are one coherent piece of chrome rather than four features. Section 8 of that doc records seven decisions made while building, including a genuine **specificity defect in the reference token CSS**: the light layer outranks the forced-dark layer, so "workspace light plus creator picks Dark" would resolve to light. The workaround lives in `useFramerTheme`, which writes the override attribute to both `<html>` and `<body>`, leaving the copied CSS byte-identical to the reference. The defect is in the reference, not in this repo, and is still there.

**Note on 0.9**: pulled forward and done alongside 0.4. The collapse control lives in the header, so finishing the shell without wiring it would have shipped a dead button. Three lines in `App.tsx`.

**Note on 0.8**: `vitest` 5.0.3 is installed as a dev dependency, which closes blocker B5 for layer 1 of the triad. No `jsdom`, no testing library, no coverage provider: layer 2 component rendering is a separate decision and was not smuggled in. `tsconfig.json` `include` moved from `["src"]` to `["src", "test"]`, so `npm run build` now typechecks the tests. The mock is typed by `Pick`ing from the real `framer` type rather than copied from the reference sample, because **the reference sample has drifted from SDK 3.10.3 in three places**: it returns a project `slug`, a user `email`, and a `Publish` object missing three required fields. None of the three exists in the SDK. Full reasoning in [`development-docs/00-test-harness.md`](development-docs/00-test-harness.md) section 8.

**Blocker found by 0.8**: PRD section 13 sources the telemetry field `userEmail` from `framer.getCurrentUser()`, and `telemetry-and-tracking.md` shows the same. **The SDK's `User` interface has no email and no other call exposes one.** That is a gap in the F20 data contract and in the creator-account model of PRD section 12, because a creator identified only by a hashed id cannot be emailed about a failed payment. Three candidate resolutions are in `00-test-harness.md` section 8.2. The mock deliberately does not fake the field. **Needs a product decision.**

---

## Phase 1: Foundation And Core Gating

PRD section 15.4. **Goal**: a creator can configure a tier, gate a frame, and take a Stripe payment.

### Week 1

| #   | Task                                                       | Feature  | Files                                                                            | Status           | Commit |
| :-- | :--------------------------------------------------------- | :------- | :------------------------------------------------------------------------------- | :--------------- | :----- |
| 1.1 | Build the Live Preview Studio with the five-state switcher | F04      | `components/studio/PreviewStudio.tsx`, `StateSwitcher.tsx`                       | awaiting review  |        |
| 1.2 | Build the simulated session context                        | F04      | `hooks/useMemberSession.ts`, `types/member.ts`                                   | awaiting review  |        |
| 1.3 | Build the Builder tab customizer using `.field-row`        | F01, F04 | `components/tabs/BuilderTab.tsx`, `types/canvas.ts`, `ui/{TextField,Select,Slider}.tsx` | awaiting review  |        |
| 1.4 | Build the canvas code generator service                    | F01      | `services/canvasComponentCodeGenerator.ts`, `services/index.ts`, `config/backend.ts` | awaiting review  |        |
| 1.5 | Build the Framer canvas service wrapper                    | F01      | `services/framerCanvasService.ts`, `components/tabs/BuilderTab.tsx`, `utils/framerMock.ts` | awaiting review  |        |
| 1.6 | Declare the first `framer.json` permissions                | F01      | `framer.json`: `addComponentInstance`, `createCodeFile`, `setCodeFileContent`, `setParent` | awaiting review  |        |
| 1.7 | Author `<MemberGate>` with all seven property controls     | F01      | `canvas-components/MemberGate.tsx`, `types/framer-canvas.d.ts`                   | awaiting review  |        |
| 1.8 | Implement the shared `isEntitled` resolver                 | F01      | `utils/entitlement.ts`                                                           | awaiting review  |        |

**Note on 1.1 to 1.3**: one development doc, [`development-docs/04-live-preview-studio.md`](development-docs/04-live-preview-studio.md). Task 1.3 spans F01 and F04 because the customizer edits a draft of F01's property controls; the component itself is documented in `01-member-gate.md` with tasks 1.4 to 1.8.

**Note on 1.4 to 1.7**: one development doc, [`development-docs/01-member-gate.md`](development-docs/01-member-gate.md). The deploy path is `BuilderTab` to `generateMemberGateCode` to `deployMemberGate`, and the component it writes is authored as a real typechecked `.tsx` file rather than a template string, so `tsc --noEmit` and `npm run lint:css` both cover the code that ends up on a creator's published site. Reasoning in section 3.2 of that doc.

**Note on 1.8, corrected by 1.7**: pulled forward and done alongside 1.1, the same call made for 0.9. F04's first acceptance criterion is that all five simulated states render distinctly, and nothing can tell Silver from VIP from a failed payment without resolving entitlement, so the resolver is a prerequisite of 1.1 rather than a later task. Covered by `test/entitlement.test.ts`.

The earlier version of this note said tasks 1.4 and 1.7 "must import it, never reimplement it". **That is not possible for 1.7 and the note was wrong.** `MemberGate.tsx` is deployed into the creator's Framer project, where it can import only `react`, `framer`, and `lucide-react`, so it cannot reach `src/utils/entitlement.ts` and must carry its own copy. That is what PRD section 11.3 describes when it says the resolver is "implemented identically in the plugin, the canvas components, and the backend". The copies are held together by `test/memberGateParity.test.ts`, which extracts both function bodies, normalizes away comments and spacing, and fails if they differ. Verified to fail: changing `>=` to `>` in the canvas copy breaks three of its assertions. Task 1.4 does import the plugin's copy and must continue to. **The backend's third copy is out of repo and nothing in this repository can check it**, which is the remaining hole in section 11.3's guarantee.

**Two new PRD conflicts found by 1.2. Both need a decision**, and neither is among the seven already resolved in PRD section 17. Full write-up in [`04-live-preview-studio.md`](development-docs/04-live-preview-studio.md) section 5.1.

| # | Conflict | Resolved as | Confirm before |
| :-- | :--- | :--- | :--- |
| C1 | PRD section 11.3's `isEntitled` reads `session.gracePeriodEndsAt`, but the `MemberSessionData` interface in F01 never declares it. The specified resolver does not typecheck against the specified interface | Field declared. Section 11.3 is the security-critical contract and F18 cannot exist without a grace window | The backend schema is written. This is a column |
| C2 | Two incompatible tier key spaces. F01's `requiredTier` control uses `free_member` / `tier_1` / `tier_2` / `vip`, while `MemberSessionData.activeTier` is commented `free` / `silver` / `gold` / `vip`. Section 11.3 compares them through one lookup, which no single tier table can satisfy. Read literally, a Silver subscriber fails a Silver gate | The control values win, because they are embedded in generated canvas code and visible in Framer's sidebar. The others are display names and now live on `SiteTierRecord.name` | Task 1.7 |

C2 is the more dangerous of the two. It fails closed rather than open, so it is not a security hole, but it is a silent total gating failure: the lookup misses, `held` is `undefined`, and every gate stays shut with no error anywhere. `test/entitlement.test.ts` pins that behaviour so it cannot regress unnoticed.

**Five more conflicts found by 1.4 to 1.7. One needs a decision, four are resolved and recorded only so the resolution is not re-litigated.** Full write-up in [`01-member-gate.md`](development-docs/01-member-gate.md) section 5.1.

| # | Conflict | Resolved as | Confirm before |
| :-- | :--- | :--- | :--- |
| C3 | Task 1.6 lists `CodeFile.setFileContent` as a `framer.json` permission. It is not one. The SDK maps that **method key** to the **permission** `setCodeFileContent`, and the two namespaces are not interchangeable | `framer.json` declares `addComponentInstance`, `createCodeFile`, `setCodeFileContent`, `setParent`. `framer.isAllowedTo` is called with the method keys. `getCodeFiles` is unprotected and is deliberately not declared | Nothing. The SDK is the authority and it is checkable. Recorded because the wrong string fails silently |
| C4 | F01 says the runtime hook "checks the local JWT and cached tier entitlement". PRD section 14.1 S2 forbids a JWT in `localStorage` and puts the session in an HTTP-only cookie | S2 wins. The gate reads no token anywhere and calls `GET /api/member/session` with `credentials: "include"`. A test asserts the component's code contains no `localStorage`, `sessionStorage`, or `document.cookie` | Nothing. S2 is the security requirement |
| C5 | `isEntitled` compares ranks from the site's tier table. `GET /api/member/session` returns no tier table, and the canvas component cannot read the plugin's | The gate falls back to the default four-tier ladder. **Recommended fix: add `tiers` to the `/api/member/session` response**, since it is the only call the gate makes | **The backend schema is written.** Same deadline as C1 |
| C6 | PRD section 9.3 requirement 3 mandates `IS_LOCKED` and the lock-state marker in every component. `CLAUDE.md` puts F19 licensing after the core workflow | Both honoured. The static declarations, the markers, the Pro-Lock banner, and the trial watermark are in the component, because they are what F19's patcher rewrites. The 1-instance duplicate registry is **not**: that is enforcement behaviour and belongs to F19 | Nothing |
| C7 | The reference master template uses `style={{ }}` for its own dynamic values | The rule wins, unconditionally. Dynamic values are CSS custom properties inside `cssContent`. Precedence puts the references above the PRD but not above `.agents/rules/` | Nothing |

C5 is the one to look at. It fails closed, so no content leaks, but a creator who adds a fifth tier or re-ranks the ladder gets gates that stay shut when they should open. Renaming a tier is safe, because keys are what get compared.

### Week 2

| #   | Task                                                     | Feature | Files                                        | Status  | Commit |
| :-- | :------------------------------------------------------- | :------ | :------------------------------------------- | :------ | :----- |
| 2.1 | Build the API client with the five-case error contract   | All     | `services/apiClient.ts`, `config/backend.ts` | awaiting review |        |
| 2.2 | Build the Manage tab with the members and tiers segments | F02     | `components/tabs/ManageTab.tsx`, `manage/{MembersTable,MemberRow,MemberFlyout,memberFilters}`, `services/siteService.ts`, `hooks/useDebouncedValue.ts`, `types/site.ts`, `styles/manage.css` | awaiting review |        |
| 2.3 | Build the tier editor with rank uniqueness validation    | F02     | `components/manage/TierEditor.tsx`, `manage/tierValidation.ts`, `utils/money.ts` | awaiting review |        |
| 2.4 | Build the Settings tab with the gateway key vault        | F03     | `components/tabs/SettingsTab.tsx`, `settings/{GatewayVault.tsx,gatewayKeys.ts}`, `styles/settings.css`, `ui/TextField.tsx` | awaiting review |        |
| 2.5 | Author `<MemberAuth>` with OTP and Google SSO            | F05     | `canvas-components/MemberAuth.tsx`, generator generalised, `studio/componentRegistry.ts` | awaiting review |        |
| 2.6 | Wire Stripe checkout session creation                    | F03     | `services/checkoutService.ts`                | awaiting review |        |
| 2.7 | Build the Home tab with the hero card and quick start    | F02     | `components/tabs/HomeTab.tsx`, `App.tsx`     | awaiting review |        |
| 2.8 | Write development docs for F01 through F05               | Rule    | `development-docs/{00-api-client,01,02,03,05}-*.md`, `00-plugin-shell.md` section 9 | awaiting review |        |

**2.1 was `blocked` and is now `awaiting review`, which needs explaining.** The backend still does not exist. What was blocked was never the authoring: PRD section 10.1 puts "request shapes, error handling, retry, degraded UI" in this repository and persistence in the other one, so the client is this repo's to write against the contract. What is blocked is **verification**. Not one of the five PRD section 10.6 cases has been observed against a server, and the tests prove only that this module maps a 403 to `forbidden`.

The practical consequence runs through every Week 2 surface: with no backend and no creator token (conflict C10), every `/api/site/*` call resolves `unauthorized`, so the Manage tab and the gateway vault render their signed-out states and nothing else. Each surface is prop driven and fully built, so the API arriving is a wiring change rather than a UI change.

**Note on 2.5**: the generator was generalised from one function into a descriptor plus a shared core, because `<MemberAuth>` is the second component and the marker handling, the config swap, and the F19 lock-state assertion are identical for all fifteen. Doing it at the second is where the shape is visible and the abstraction is still cheap. `<MemberAuth>` is deployable but has no panel customizer, so the registry gained a `deployable` flag separate from `previewReady`: collapsing the two would have forced a choice between refusing to insert a component that exists and claiming a preview that does not. **No task in the plan builds its panel preview or customizer.**

**Note on 2.7**: PRD section 15.4 attributes the Home tab to F02. Its content is panel chrome rather than member administration, so it is documented in [`00-plugin-shell.md`](development-docs/00-plugin-shell.md) section 9 instead of the F02 doc.

**Note on 2.8**: met. Five feature docs exist for F01 through F05, plus a new `00-api-client.md` for the cross-cutting client, whose ledger Feature column reads "All" and which would otherwise have to be documented five times. All are `in progress` rather than `done`, which is accurate: each carries an unticked human verification table.

**Seven more conflicts found in Week 2, two needing a decision.** Full write-ups in [`00-api-client.md`](development-docs/00-api-client.md) section 5.1, [`02-member-tier-cockpit.md`](development-docs/02-member-tier-cockpit.md) section 5.1, [`03-tri-gateway-payments.md`](development-docs/03-tri-gateway-payments.md) section 5.1, and [`05-member-auth.md`](development-docs/05-member-auth.md) section 5.1.

| # | Conflict | Resolved as | Confirm before |
| :-- | :--- | :--- | :--- |
| C8 | `SiteTierRecord` is declared twice with different shapes: three fields in section 11.3's resolver, ten in F02 | F02's is the entity and keeps the name. The resolver narrows to `TierLadderEntry`, a `Pick` of what rank comparison actually reads. Renamed in both copies of `isEntitled` together, so the parity test still passes | Nothing. F02's is a superset |
| C9 | F02 types `SiteTierRecord.key` as `string` and intends custom tier keys. F01's `requiredTier` control is a fixed `Enum` of five, so a custom key can never be selected on a gate | Phase 1 offers the four known keys and the tier editor says so. **The fix already exists in the architecture**: the gate's component file is generated per creator, so the generator can emit the site's own tier keys as the `Enum` options once `GET /api/site/tiers` exists, which also resolves C5 | **Before custom tiers are offered in the UI** |
| C10 | F02 needs a creator session token for every `/api/site/*` call. **No task in the 72-task plan builds the exchange**, and creator identity first appears at tasks 4.4 and 4.7, in Phase 2 | The client injects `getCreatorToken`, Week 2 supplies `null`, and every affected surface renders its signed-out state. Where the token is stored is a security decision, and it is refused here rather than buried in an infrastructure file | **Yes. A task needs adding to Phase 1, or 2.2 to 2.4 need moving to Phase 2.** This is a schedule defect, not a code defect |
| C11 | F05 is member sign-in by OTP, and PRD section 10.4 lists no OTP endpoint. The only OTP routes are in section 10.2, which serves the plugin panel: its send route takes a `framerUserId` a visitor cannot have, and its verify route returns a token in the body where F05 requires an HTTP-only cookie | `<MemberAuth>` calls `POST /api/member/send-otp` and `POST /api/member/verify-otp`, declared in the component as **proposals rather than quotations** | **Yes, before the backend routes are written** |
| C12 | Minor units are assumed to have two decimal places | The exponent is a parameter defaulting to 2. Correct for USD, EUR, GBP, and INR, which is the whole supported union, and wrong for JPY and KWD | Only if a zero-decimal or three-decimal currency is added |
| C13 | F03's key prefix list gives `pk_live_` and `pk_test_` as the Stripe markers. Those are **publishable** prefixes, and the vault also asks for a secret key, which begins `sk_` or `rk_` | The list is treated as incomplete. All three prefixes are recognised, and a secret pasted into the publishable field is caught by field rather than by validity | Nothing, but the PRD line is worth correcting |
| C14 | F03's `SiteGatewayConfig` carries three `*Encrypted` secret fields on the interface the client uses, and the same feature requires that a secret is never in a client response | The client type splits in two: a write shape that holds plaintext only while saving, and a read shape with **no field that can hold a secret** | Nothing. The acceptance criterion outranks the illustrative interface |

C10 is the one to act on. It is not a code problem and no amount of care here fixes it: three Week 2 surfaces need an authenticated creator, and nothing in the plan authenticates one.

**Exit criteria**: a creator creates a tier, gates a frame with `<MemberGate>`, a visitor signs in by OTP, pays through Stripe, and the gate unlocks on the published site. Linter and typecheck pass. Five development docs exist.

**QA script**: [`qa-review/phase-1-qa-review.md`](qa-review/phase-1-qa-review.md). 20 automated checks, 48 manual cases QA-101 to QA-148, and a sign-off block. Two of the seven exit criteria above are closed by machine, four are blocked on the backend, and one, gating a frame, has never run against Framer.

---

## Phase 2: Global Payments, Paywalls, And LMS

PRD section 15.5. **Goal**: all three gateways live, metering and SEO shipped, licensing and telemetry in place.

### Week 3

| #   | Task                                                         | Feature | Files                                         | Status | Commit |
| :-- | :----------------------------------------------------------- | :------ | :-------------------------------------------- | :----- | :----- |
| 3.1 | Integrate Lemon Squeezy routing and key validation           | F03     | `services/checkoutService.ts`, Settings vault | todo   |        |
| 3.2 | Integrate Razorpay with UPI, including the INR currency path | F03     | `services/checkoutService.ts`                 | todo   |        |
| 3.3 | Implement geolocation routing with a manual override         | F03     | `services/gatewayRouter.ts`                   | todo   |        |
| 3.4 | Author `<MeteredPaywall>` with the counter pill              | F07     | `canvas-components/MeteredPaywall.tsx`        | done   |        |
| 3.5 | Build encrypted client-side read tracking                    | F07     | meter block in `MeteredPaywall.tsx`, server meter in the API | done   |        |
| 3.6 | Build the Schema.org JSON-LD injector                        | F08     | schema block in `MeteredPaywall.tsx` and `MemberGate.tsx` | done   |        |
| 3.7 | Implement the grace period banner and `past_due` handling    | F18     | `canvas-components/shared/GraceBanner.tsx`    | todo   |        |

### Week 4

| #    | Task                                                              | Feature | Files                                                                    | Status | Commit |
| :--- | :---------------------------------------------------------------- | :------ | :----------------------------------------------------------------------- | :----- | :----- |
| 4.1  | Author the LMS trio                                               | F11     | `CourseProgress.tsx`, `LessonChecklist.tsx`, `VideoProgressListener.tsx` | todo   |        |
| 4.2  | Add origin-validated `postMessage` handlers for all three players | F11     | `utils/playerBridge.ts`                                                  | todo   |        |
| 4.3  | Implement the Pro-Lock engine and `enforceLockState`              | F19     | `hooks/useLicense.ts`, `utils/lockPatcher.ts`, backend `services/license/`, `middleware/license.ts` | awaiting review |        |
| 4.4  | Implement the trial ticker banner and eligibility flow            | F19     | `components/billing/TrialStickyBanner.tsx`, `TrialStatusModal.tsx`, backend `services/license/trialService.ts` | awaiting review |        |
| 4.5  | Implement the 1-instance limit and duplicate protection           | F19     | not built, by decision: 19-pro-lock-and-trial.md 1.4                     | skipped |        |
| 4.6  | Implement the trial watermark in every canvas component           | F19     | the license block in five canvas components, `routes/license.ts`        | awaiting review |        |
| 4.7  | Build the account sheet with checkout for the three plans         | F19     | `components/billing/*` (BEAF clone), backend `billingService.ts`, `platformWebhook.ts` | awaiting review |        |
| 4.8  | Implement telemetry sync with the mode guardrail                  | F20     | `hooks/useSiteTelemetry.ts`                                              | todo   |        |
| 4.9  | Implement 2kB differential compression                            | F20     | `utils/compression.ts`, `services/storageService.ts`                     | todo   |        |
| 4.10 | Implement bot defense on the auth surface                         | F21     | `canvas-components/MemberAuth.tsx`, Settings                             | todo   |        |
| 4.11 | Write development docs for F07, F08, F11, F18 to F21              | Rule    | `docs/development-docs/*`                                                | todo   |        |

**Exit criteria**: a buyer in India completes UPI checkout. The meter blocks at article 4. JSON-LD validates in Google's Rich Results Test. The trial counts down, the watermark appears, the 1-instance limit blocks a second insert, and purchasing removes the watermark from existing canvas components.

---

## Phase 3: B2B, CMS, And Member Self-Service

PRD section 15.6.

### Week 5

| #   | Task                                                             | Feature | Files                                                              | Status | Commit |
| :-- | :--------------------------------------------------------------- | :------ | :----------------------------------------------------------------- | :----- | :----- |
| 5.1 | Author `<MemberDashboard>` with billing portal integration       | F06     | `canvas-components/MemberDashboard.tsx`                            | todo   |        |
| 5.2 | Implement invoice listing with cross-member access protection    | F06     | Dashboard billing tab                                              | todo   |        |
| 5.3 | Author `<CMSGatedTemplate>` with boolean and enum bindings       | F09     | `canvas-components/CMSGatedTemplate.tsx`                           | todo   |        |
| 5.4 | Verify CMS gating on a 300-item collection with no per-item call | F09     | verification task                                                  | todo   |        |
| 5.5 | Author `<ProtectedDownload>` with signed URL handling            | F10     | `canvas-components/ProtectedDownload.tsx`                          | done   |        |
| 5.6 | Declare the remaining `framer.json` permissions                  | All     | `CodeFile.remove`, `Node.remove`, `setPluginData`, `getPluginData` | todo   |        |

### Week 6

| #   | Task                                                      | Feature | Files                                   | Status | Commit |
| :-- | :-------------------------------------------------------- | :------ | :-------------------------------------- | :----- | :----- |
| 6.1 | Author `<TeamManagement>` embedded in the dashboard       | F12     | `canvas-components/TeamManagement.tsx`  | todo   |        |
| 6.2 | Implement seat allocation, invites, and revocation limits | F12     | `services/orgService.ts`                | todo   |        |
| 6.3 | Author `<OnboardingModal>` with conditional steps         | F16     | removed 2026-10-18 at the product owner's request | removed |        |
| 6.4 | Implement shared password gating mode                     | F22     | `MemberGate.tsx`, Settings              | todo   |        |
| 6.5 | Write development docs for F06, F09, F10, F12, F16, F22   | Rule    | `docs/development-docs/*`               | todo   |        |

**Exit criteria**: a member updates their card and downloads an invoice from the site. A mixed CMS collection gates correctly per item. A signed download URL dies at 61 seconds. A team owner invites and revokes seats within their allocation.

---

## Phase 4: Community, Localization, And Packaging

PRD section 15.7.

### Week 7

| #   | Task                                                         | Feature | Files                                         | Status | Commit |
| :-- | :----------------------------------------------------------- | :------ | :-------------------------------------------- | :----- | :----- |
| 7.1 | Author `<BookmarkButton>` and `<BookmarksTray>`              | F14     | `canvas-components/Bookmark*.tsx`             | done   |        |
| 7.2 | Author `<MemberDirectory>` with opt-in enforcement           | F15     | `canvas-components/MemberDirectory.tsx`       | todo   |        |
| 7.3 | Author `<DonationSlider>` with server-side amount validation | F13     | `canvas-components/DonationSlider.tsx`        | todo   |        |
| 7.4 | Author `<MemberAnnouncementBar>`                             | F17     | `canvas-components/MemberAnnouncementBar.tsx` | todo   |        |
| 7.5 | Externalize every component string into locale maps          | F23     | `locales/*.json`                              | todo   |        |
| 7.6 | Finalize agency pooled licensing across multiple sites       | F19     | `hooks/useProLock.ts`                         | todo   |        |

### Week 8

| #   | Task                                                    | Output                                     | Status | Commit |
| :-- | :------------------------------------------------------ | :----------------------------------------- | :----- | :----- |
| 8.1 | Run the full TDD triad across all three layers          | green test suite                           | todo   |        |
| 8.2 | Light and dark contrast audit on all 16 components      | WCAG AA evidence                           | todo   |        |
| 8.3 | Zero-inline-CSS lint on `src` with zero violations      | clean lint                                 | todo   |        |
| 8.4 | Keyboard and screen reader pass on every modal and form | a11y sign-off                              | todo   |        |
| 8.5 | Cross-site and cross-member access penetration checks   | security sign-off                          | todo   |        |
| 8.6 | Write the help docs and highlighted features            | `docs/help/`, `docs/highlighted-features/` | todo   |        |
| 8.7 | Complete development docs for every remaining feature   | 24 files total                             | todo   |        |
| 8.8 | `tsc --noEmit`, `vite build`, then `npm run pack`       | `plugin.zip`                               | todo   |        |
| 8.9 | Marketplace listing copy, screenshots, and demo video   | submission package                         | todo   |        |

**Exit criteria**: `npm run pack` produces a valid bundle, every checklist in PRD section 16 passes, and the listing is submitted.

**Note on 8.8**: there is no `pack` script in `package.json`. It must be added before this task can run.

---

## Feature Plans

A second track, added 2026-10-12. The fourteen plans in [`docs/features-plan/`](features-plan/) are
feature-driven rather than task-driven: each one spans several PRD tasks and several files, and the
unit of work is the feature, not the row.

**They do not replace the phase tables above.** A feature plan is delivered against the PRD features
it implements, so FP-02 extends F05 and its development record lives in that feature's doc. The two
tracks disagree on nothing: where a plan goes beyond its PRD feature, the extra surface is recorded
as a conflict and listed below.

Status values are the same as everywhere else: `todo`, `in progress`, `awaiting review`, `done`,
`blocked`. **`done` still requires a commit**, so a finished plan sits at `awaiting review` until
the user commits it.

| # | Plan | PRD feature | Files | Status | Commit |
| :-- | :--- | :--- | :--- | :--- | :--- |
| FP-01 | Lock Pages and On-Page Content | F01 | `canvas-components/MemberGate.tsx` | todo | |
| FP-02 | Email and Password Authentication | F05 | `canvas-components/MemberAuth.tsx`, `utils/credentials.ts`, `types/canvas.ts`, `services/canvasComponentCodeGenerator.ts` | awaiting review | |
| FP-03 | OTP Passwordless Auth | F05 | `canvas-components/MemberAuth.tsx` | todo | |
| FP-04 | Google Sign In | F05 | `canvas-components/MemberAuth.tsx` | todo | |
| FP-05 | GitHub Sign In | F05 | `canvas-components/MemberAuth.tsx` | todo | |
| FP-06 | ReCAPTCHA Bot Defense | F21 | not started | todo | |
| FP-07 | Soft Paywall, Read More | F07, F08 | not started | todo | |
| FP-08 | Member Dashboard | F06 | `canvas-components/MemberDashboard.tsx`, `services/pageScaffoldService.ts` | awaiting review, partial | |
| FP-09 | Custom Profile Fields | F16 | `utils/customFields.ts`, `components/settings/CustomFieldsPanel.tsx`, `components/manage/MemberFlyout.tsx`, `canvas-components/OnboardingModal.tsx`, `canvas-components/MemberDashboard.tsx`; backend `lib/memberMetadata.ts`, `lib/siteSettings.ts`, `routes/site.ts` | awaiting review | |
| FP-10 | Member Bookmarking | F14 | not started | todo | |
| FP-11 | LMS Mark As Complete | F11 | not started | todo | |
| FP-12 | Upgrade To Download | F10 | not started | todo | |
| FP-13 | Shared Password Access | F22 | not started | todo | |
| FP-14 | Multi-Language Support | F23 | not started | todo | |
| FP-00 | Connect, Creator Identity, And Membership Pages | F02, F05, F06 | `components/tabs/ConnectTab.tsx`, `services/connectService.ts`, `services/connectionStore.ts`, `services/pageScaffoldService.ts`, `backend/src/routes/connect.ts`, `backend/src/routes/site.ts` | awaiting review | |
| FP-15 | Backend Architecture, Node and Prisma | sections 6, 10, 11, 14 | `backend/` in this repo. Specified in [`memberframe-backend-prd.md`](memberframe-backend-prd.md) | awaiting review, partial | |

**Blog paywalls and every currency, added 2026-10-18 on request, awaiting review and unstaged, in
both repositories.** The Soft Paywall gained a linked mode for CMS posts: placed below the post with
Article Body empty, styled in Framer's sidebar, and finding the post body tagged by the new
`PaywallArticle` override (`MemberArticle.tsx`). Page Locks and Section Locks needed only setup
guidance. An interim Article Paywall (plugin rules, `MemberPaywalls.tsx`) was built, seen working on a
published site, and removed the same day as a duplicate: [`21-blog-paywalls.md`](development-docs/21-blog-paywalls.md).
Tiers can now be priced in every circulating currency with its own decimal places
(`utils/currencies.ts`, conflict C12 resolved). **Linked mode is not yet seen in Framer.**

**Reports, added 2026-10-18 on request, awaiting review and unstaged, in both repositories.** A fifth tab: Overview (members, paying, MRR, net revenue, subscriptions, members by tier, sign ups by month, most saved, most downloaded), Revenue (by month chart and table, by tier, by gateway, payment history with CSV), Subscriptions (by status, interval, tier, list with CSV), Members (by tier, a tier's members, a member's full history). Live or Test, and a period. [`24-reports.md`](development-docs/24-reports.md). Queries run against the development database; **not yet seen in Framer**.

**Dynamic tiers and one site currency, added 2026-10-18 on request, awaiting review and unstaged, in both repositories.** No built in tier types: one Free tier (rank 0, no prices) and paid tiers (rank 1 and up), each with an ID made from its name; one site currency in Payments, searchable (`ui/SearchSelect`), with every tier following a change; per-tier currency and extra prices removed. [`23-dynamic-tiers.md`](development-docs/23-dynamic-tiers.md). **Not yet seen in Framer.**

**Dedicated auth screens, added 2026-10-15 on request, awaiting review and unstaged.** The Builder
now offers Member Login, Member Registration, Password Reset, and OTP Verification beside Member
Auth, which is unchanged. All five deploy from the one `MemberAuth.tsx`: the generator bakes a
`screen` in and renames the export, so each lands as its own file and component. Recorded in
[`05-member-auth.md`](development-docs/05-member-auth.md) section 10. 34 tests; none rendered.

**F19 plugin billing, added 2026-10-18 on request, awaiting review and unstaged, both repositories.**
BEAF's model for MemberFrame itself: an account made in a browser tab, a 7-day trial per account,
Framer user, and project, the Made with Framefic mark during the trial, the blur and a 402 server
block once it ends, Stripe plans (monthly, yearly, lifetime) with prorated upgrades, renewal
reminders, and customer emails. Recorded in [`19-pro-lock-and-trial.md`](development-docs/19-pro-lock-and-trial.md).
Plugin 19 new tests, backend 37; nothing paid through real Stripe yet and nothing seen rendered in Framer.
The billing and registration screens, the hosted `/auth` page, and every billing email were then rebuilt
as an exact copy of BEAF's, the company-wide standard (`components/billing`, `styles/billing`, exempt
from `lint:design`, design-system.md v0.4.4). Gates: plugin 884 tests, backend 451.

**Custom SMTP per site (SMTP-1), added 2026-10-18 on request, awaiting review and unstaged.**
Settings, Config, Email sending: each site can send member emails through its own SMTP server,
falling back to the platform sender when it is off or fails. Password sealed in
`integration_secrets`; host checked against private ranges in production. Recorded in
[`25-custom-smtp.md`](development-docs/25-custom-smtp.md). Plugin 12 tests, backend 11; no send
through a real provider yet.

**Onboarding Modal removed 2026-10-18 at the product owner's request, unstaged.** The canvas
component, its Builder entry, generator descriptor, config type, and the onboarding-only helpers
are gone; profile fields stay, answered on `<MemberDashboard>`. Recorded at the top of
[`16-onboarding-modal.md`](development-docs/16-onboarding-modal.md). The paragraph below is history.

**FP-09 is `awaiting review` and the work is unstaged, in both repositories.** Recorded in
[`16-onboarding-modal.md`](development-docs/16-onboarding-modal.md), which also closes task 6.3.
Creators define fields in a new Settings, Fields view; members answer them in `<OnboardingModal>`,
which opens only while a required answer is missing, and edit them in a new profile form on
`<MemberDashboard>`; the Manage flyout shows the answers. The value rules exist four times and two
parity tests chain them together, both proved able to fail. Gates: frontend lint, tsc, 621 tests,
build; backend tsc and 179 tests. **Nothing has run against a server or been seen rendered.** The
backend half lives in the sibling `memberframe-backend` folder, which has no commits yet. The
build now warns that the bundle passed 500 kB, at 539.74 kB.

**FP-02 is `awaiting review` and the work is unstaged.** It adds the password path to
`<MemberAuth>`: sign-in, sign-up, forgot-password, and the reset form, three more property controls
for thirteen in total, and a password policy duplicated into the component with a parity test that
has been proved able to fail. Recorded in
[`05-member-auth.md`](development-docs/05-member-auth.md) section 9.

**What is verified and what is not**: four gates green, 453 tests, and nine generated variants parse
under esbuild including three injection attempts. **Not one of the four new endpoints exists**, so
no password has been submitted anywhere, and nothing has been seen rendered. The lockout, the
timing-safe responses, and the session invalidation on reset are all server side and all unverifiable
here.

**The data-storage question that prompted this track is answered** in
[`00-member-data-model.md`](development-docs/00-member-data-model.md): member data goes in the
backend, never in a Framer CMS collection and never in plugin data. Three of the five reasons are
structural, the decisive one being that a CMS collection can only be written by a plugin running in
the creator's editor, so it cannot record a visitor's signup at all.

**FP-15 changed stack twice and is now partly built, in `backend/`.** The plan file proposed
Laravel 11, PostgreSQL, Redis, and a Vue 3 creator dashboard. The decision on 2026-10-12 was Node
with Prisma and MySQL, no dashboard at all, and the code in this repository rather than a separate
one. [`memberframe-backend-prd.md`](memberframe-backend-prd.md) is the authoritative specification
and section 1.3 records every deviation from the plan file.

**What is built and passing**: the Prisma schema with eight models, a hand-written migration for the
three MySQL specifics Prisma cannot express, typed configuration that refuses to boot on a bad
value, per-site tenant resolution with an origin allowlist, scrypt password hashing, opaque
revocable sessions, and six member endpoints covering register, sign in, forgot, reset, logout, and
logout everywhere. 67 tests, `tsc --noEmit` clean, `npm audit` zero vulnerabilities.

**What is not built**: creator authentication, which is conflict C10 and still blocks the plugin's
Manage and Settings tabs; OTP send and verify, which answer 501 while `<MemberAuth>` ships with that
path enabled (conflict C24); payments and webhooks; and any integration test at all. **Every route
is typechecked and has never run against a database**, so the lockout, the timing-safe responses, and
the session invalidation on reset are specified and unverified.

**The four root gates are unaffected.** The root `tsconfig.json` includes only `src` and `test` and
the root vitest config only `test/**`, so the backend is invisible to the Framer build. Verified
after the fact: lint:css 65 files, tsc clean, 453 tests, build 370.63 kB.

**The biggest gain from putting it in this repository** is `backend/test/parity.test.ts`. PRD section
11.3 requires `isEntitled` to be identical in the plugin, the canvas components, and the backend and
calls divergence a security defect. Two of the three were already compared. **The backend copy had
nothing watching it, and it is the copy that actually decides access**, because the other two run in
a browser where their verdict is advisory. The same test covers the password policy, with the sign
reversed: there the browser copies are hints and the server copy is the rule.

**Dropping the dashboard resolved C19 and left four responsibilities homeless**, listed in backend
PRD section 8.2. Three can wait. The fourth, MemberFrame's own billing for creators, cannot: F19 and
PRD section 12 require creators to pay, and that flow now has nowhere to live.

**Conflict C10 is closed.** Creator authentication now exists. Every `/api/site/*` route
needed a creator session token, no task in the 72-task plan built one, and the plugin's Manage and
Settings tabs had rendered their signed-out state since the project began. The Connect tab proves a
creator's email address with a six-digit code and issues an opaque bearer token, and both tabs now
read the connected site rather than a constant named `PLACEHOLDER_SITE_ID`.

**The canvas components could not authenticate at all, and that was silent.** `resolveSite`
requires an `X-MemberFrame-Site` header and neither `<MemberGate>` nor `<MemberAuth>` sent one,
so every request from a deployed component was a 400. The plugin looked fine and the backend looked
fine; only a visitor on the published site would have seen it, as a failure reading like a server
outage. The generator now bakes the site key in at deploy time and
[`test/deployContext.test.ts`](../test/deployContext.test.ts) pins the whole chain, proved able to
fail by perturbation.

**Settings are one JSON document per site**, keyed by `site_id`, on explicit instruction. The
reasoning and the three things that costs are in
[`06-connect-and-pages.md`](development-docs/06-connect-and-pages.md) section 3. Custom profile
field DEFINITIONS live there too; member VALUES live in `Member.metadata`, which is the split FP-09
needs and the reason neither becomes an `ALTER TABLE` driven by creator input.

**The Builder tab creates the membership pages**, derived from those settings rather than from its
own list, so a creator who sets `/members/sign-in` gets that page and cannot end up with a
`/login` page nothing points at. It is additive: an existing page is kept, never replaced.

**`<MemberDashboard>` is built, and billing is not.** FP-08 specifies billing and invoice tabs and
both need tables that are backend PRD phase B3. The component says so rather than rendering zeroes,
because a member reading "next billing: never" would conclude their subscription had lapsed.

**The Settings tab is now Config and Integration**, behind the same `Segmented`
control the Manage tab uses. Config holds the site's own settings; Integration
holds third-party credentials as a catalogue of cards, and it absorbed the
gateway key vault, because a gateway key is an integration's configuration
rather than a site setting.

**The storage rule is the thing to understand about the Integration tab.** Every
field in `components/settings/integrationRegistry.ts` declares whether it is a
secret, and the two halves go to different places: non-secret values into the
settings document, secrets into an encrypted table. A secret must never enter
the settings document, because that document is returned to the panel whole on
every connect and every settings read. `gateway_configs` with AES-256-GCM is
backend PRD phase B3 and **is not built**, so every secret field in the panel is
disabled today with the reason on screen, and `secretsPresent` is never accepted
from a client. `test/integrationRegistry.test.ts` checks the no-leak rule
against the whole catalogue rather than one example, so a field added later
without `secret: true` fails there rather than in production.

**One card per gateway, not two.** The reference layout has separate Stripe and
Stripe Sandbox cards. Live against test is already derivable from the key
itself, which `gatewayKeys.ts` detects, so the mode is a badge. Two cards would
let a creator fill in both with nothing saying which a real checkout uses.

**The Manage tab is deliberately unchanged.** Its redesign is five design
decisions listed in [`07-panel-restructure-plan.md`](development-docs/07-panel-restructure-plan.md)
section 3.1, and guessing at them would be building the wrong thing carefully.

### Conflicts Found In The Feature-Plan Track

| # | Conflict | Resolved as | Confirm before |
| :-- | :--- | :--- | :--- |
| C15 | FP-02 section 2.1 names "Argon2id/bcrypt" without choosing. **bcrypt silently truncates at 72 bytes**, so with bcrypt two different long passwords unlock the same account | The client caps length at 128 and the doc recommends Argon2id. The choice is the backend's and it is not a preference | **Before the backend hashes anything** |
| C16 | FP-02 asks `register` to return `email_already_exists`, which **is** a user-enumeration oracle, while the same plan's rule 3 forbids enumeration on sign-in and reset | Implemented as specified. A sign-up form that silently fails to create an account is unusable, and the leak is bounded to a path that already requires a chosen password. Sign-in and reset stay silent | Nothing, but it should be a deliberate decision rather than an inconsistency nobody noticed |
| C17 | FP-02 puts `siteId` in all four request bodies | Omitted. The backend derives the site from the request origin; a client-supplied `siteId` is a cross-site read waiting to be tried | Nothing. The PRD line is worth correcting |
| C18 | FP-02's reset flow needs a page at `/reset-password` on the creator's site, and **no plan or task tells the creator to create one** | `<MemberAuth>` self-detects `?token=` and switches to the reset view, so one instance serves both. The creator still has to make the page and set the path the backend emails | **Yes. Someone has to document this for creators**, or every reset link 404s |
| C19 | FP-15's Vue dashboard rebuilds the members CRM, the tier editor, and the gateway vault. All three are already built in the plugin, and PRD section 2.3 calls the In-Framer-First Mandate absolute | **Resolved on 2026-10-12: no dashboard at all.** Stronger than the cut-back version first proposed, and it removes the duplication rather than bounding it. Four responsibilities are now homeless, listed in backend PRD section 8.2 | **One is still open**: MemberFrame's own creator billing, which F19 and PRD section 12 require and which now has nowhere to live |
| C20 | FP-15 specifies Laravel 11.x, which **reached end of life in March 2026** | Moot. The stack is Node, Express, Prisma, and MySQL as of 2026-10-12. Recorded because it was a real defect in the plan file and would have bitten a PHP build on day one | Nothing |
| C21 | PRD section 11.2 soft deletes members to preserve invoice history, and the natural foreign key from `invoices` cascades them away on a hard delete | Members are only ever soft deleted, so the cascade never fires. A hard delete would take the invoices with it | Decide before any data-retention or GDPR tooling is written, which is blocker B4 |
| C22 | FP-15 puts webhook idempotency in a 24-hour Redis cache, and PRD section 10.5 makes non-replay a correctness requirement. A cache key can be evicted, and a gateway can replay days later | A MySQL `webhook_events` table with `UNIQUE(gateway, event_id)`. Insert before processing, and a failed insert is the answer | Nothing. Strictly stronger than the plan |
| C23 | FP-02 and the backend PRD both say Argon2id, and `backend/src/lib/password.ts` uses scrypt | Argon2id in Node needs a native addon and node-gyp, which fails often enough on Windows to matter for a surface handling passwords. scrypt is memory-hard, in Node's standard library, OWASP-acceptable as an alternative, and free of bcrypt's 72-byte truncation. Every stored hash carries its algorithm tag, so adding Argon2id later rehashes members as they sign in, with no migration and no forced reset | **Yes, before launch.** It is weaker against a well-funded GPU attacker and the upgrade is one file |
| C24 | `<MemberAuth>` ships with the email path enabled by default, and the backend answers 501 for OTP send and verify | A visitor who clicks "Email me a code instead" reaches a dead end. 501 rather than 404 so the network panel distinguishes "not built" from "broken" | **Yes.** Either build the OTP pair, backend PRD phase B2 item 11, or reconsider the component default |
| C25 | `npm audit` on the first backend install reported 15 high-severity nodemailer advisories, several of them delivery to an attacker-controlled domain through IDN, punycode, or RFC 5322 comment mis-parsing | Upgraded to nodemailer 10.1.0 before writing any sending code. Zero vulnerabilities now | Nothing, but **re-run `npm audit` in `backend/` before any release**. This is the dependency that carries password reset tokens |
| C26 | The shell standard permits two to four tabs and PRD section 7.3 resolved this product at four. Connect is a fifth | Added on explicit instruction. It is a different kind of surface from the other four: a gate a creator passes through once, not a workspace they return to. **The section 7.3 resolution is untouched**: Members and Tiers stay folded into Manage | **Yes.** If 360px feels cramped the fix is to move Connect into Settings. Never re-split Manage |
| C27 | PRD section 14.1 S2 bars a token from client storage, and the creator token is stored in Framer plugin data | Memory only would mean an emailed code on every panel open, and `localStorage` is what S2 names. Plugin data is project-scoped rather than origin-scoped, read back only by this plugin, with a thirty-day server-side expiry and a revoke endpoint. The resulting model is "whoever can edit this Framer project can administer its membership" | **Yes.** That is defensible, since a project editor can already change what the gates require, but it is weaker than "whoever has the creator's email", which is what the connect code actually proves |
| C28 | The first address to verify against a Framer project id owns that site, and there is no transfer flow | A second account connecting the same project gets 403 rather than access, which is correct. Inventing an ownership transfer in a service file would be a product decision made in the wrong place | **Yes.** A project connected by mistake, or by a contractor who has left, needs support to reassign |
| C29 | `ManageTab` calls `sendMagicLink` and no backend route answers it. PRD section 10.3 lists it | Left in place and resolving `unavailable`, with the service function documented as not built. It is a few lines once the OTP flow exists | **Yes**, with C24. They are the same missing piece |
| C30 | The Builder tab's six-row customizer for `<MemberGate>` was removed. PRD task 1.3 specifies it and feature F04 covers it | Every one of the six is also a Framer property control on the component, so a creator configured the same value twice and the panel's copy was only the starting value. `<MemberAuth>` and `<MemberDashboard>` always worked the other way. The gate now deploys with its authored defaults and is configured on the canvas like the other two | **Confirmed by the user.** Recorded because it reduces specified work that was passing its gates. The preview's state switcher, F04's first half, is kept: it answers what a Silver member sees versus a VIP, which the canvas cannot |
| C31 | FP-09's flow chart branches ("Agency selected, show Team Size") and its section 5 tests conditional fields, but its section 4.1 schema has nothing that can express a condition | `showWhen: { key, value } \| null` added to the definition on both sides, one level deep, parent an earlier dropdown or checkbox. Optional, so stored documents read back unchanged. The server validates it on write, salvages it on read, and drops a hidden field's value | Nothing, but it is a schema addition the plan did not specify |
| C32 | PRD section 9.2 lists a `steps` property control on `<OnboardingModal>`, and the questions are the profile fields defined in Settings | No `steps` control. Steps are derived from the fields: welcome, required, optional. A second list in Framer's sidebar could only disagree with the first, the same reasoning as C30 | Nothing |

Two need a decision rather than a fix. **C19** is a product scope question: whether the web
dashboard rebuilds three surfaces the plugin already has. **C18** is unowned: the component handles
the reset page, and nothing tells the creator the page has to exist.

---

## Tasks Needing Human Verification

The agent cannot check these. Assign an owner before the phase they fall in.

| Task            | Why the agent cannot verify it                                                                                                                                                                                                                                                                                                                                                                              |
| :-------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0.2             | The done-when is "tokens resolve in devtools". The agent confirmed all three token layers reach `dist/assets/index-*.css` and that `--framefic-page-bg` is emitted three times, once per layer, but it cannot open devtools against the running panel to watch Framer flip `body[data-framer-theme]`                                                                                                        |
| 0.4 to 0.7, 0.9 | Rendered panel in the Framer desktop app. The browser pane cannot load the self-signed HTTPS dev server. The agent confirmed every module is served (`curl -sk --http1.1 https://127.0.0.1:5173/...` returns 200) and Vite logs no transform error. That is compile-level evidence, not visual. Unverified: the 360x640 layout, the 48px collapse and restore, contrast in both themes, and a clean console |
| 1.1 to 1.3      | Rendered panel again, plus four F04 acceptance criteria the agent cannot reach: that the five states look distinct, that a keystroke reaches the preview inside one frame, that a workspace theme flip re-renders it at WCAG AA, and a clean console. The agent proved the five states resolve distinctly as **logic** in `test/entitlement.test.ts`, and that no network path exists in the subtree, which is grep-verifiable. Pixels, timing, and contrast need a human. F04's fifth criterion, "renders correctly for all 15 canvas components", is **deferred by arithmetic**: 14 of the 15 are not authored yet |
| 1.4 to 1.7      | **The deploy path has never run against Framer.** It is the first code that writes to a creator's project, and every step of it is unverified end to end: that `createCodeFile` accepts the generated file, that Framer reports a component export with an `insertURL` soon enough for the insert to find one, that the instance lands on the canvas, and that all seven controls appear in the sidebar with their `hidden` behaviour. The agent proved the logic against `createFramerMock` and proved the real SDK satisfies the narrow interface at compile time, which catches a signature change but not a behaviour difference. Two specific unknowns are called out: `src/types/framer-canvas.d.ts` is a hand-written shim for the `framer` module and **a shim cannot be wrong in a way the compiler notices**, so `RenderTarget` needs confirming; and whether a second "Add to canvas" really overwrites rather than creating a second file. The four locked states, the entitled render, and contrast in both colour schemes are pixels |
| 2.1 to 2.8      | **Nothing in Week 2 has spoken to a backend or been seen rendered.** Those are different gaps and both are open. The API client's five cases are tested against an injected `fetch`, which proves the mapping and not the contract; no request has reached a server, so CORS, the real status codes, and whether `Retry-After` is even sent are all unverified. On the rendering side: the members table at 360px with no horizontal scroll, the search debounce feeling responsive rather than laggy, the revoke confirmation being unskippable, inline key errors appearing under their field, the Test mode badge being noticeable enough to act on, and contrast in both themes. For `<MemberAuth>`: all ten sidebar controls, the focus trap and Tab cycling, Escape, a real OAuth popup round trip, a real popup block producing the inline error, and a real six-digit code arriving. One non-engineering check too: the four provider brand marks are monochrome glyphs drawn to inherit colour, and each provider publishes brand guidelines for sign-in buttons, so that usage needs a human sign-off before release |
| 0.8             | Mock fidelity against a live Framer app. The fixture shapes typecheck against the SDK `.d.ts`, which proves they match what Framer **declares**, not what it **returns**. The done-when, "unit tests run with no Framer desktop app", is fully met and verified: `npm test` passes 16 of 16 in a node environment                                                                                           |
| FP-02           | **No password has been submitted anywhere**, because none of the four endpoints exists. What that leaves unverified is most of the feature: the five-attempt lockout, whether an unknown address and a wrong password really do take the same time to answer, whether a reset invalidates other sessions, and whether the emailed link resolves at all. Two of those, timing safety and session invalidation, are the ones most likely to be quietly missing in a first backend. On the rendering side: the sign-in and sign-up tabs, the show and hide toggle, the strength meter moving as someone types, inline problems appearing under the field rather than as a banner, the Tab order through email, password, toggle, and submit, and contrast on the meter's weak state in both colour schemes. One creator-facing gap too, conflict C18: the reset page has to exist on the creator's site and nothing tells them so |
| FP-15           | **No endpoint has run against a database.** The backend typechecks and its pure logic is tested, and `backend/src/routes/member.ts` has never served a request. That leaves unverified everything the frontend could not verify either: the five-failure lockout, whether an unknown address and a wrong password really take the same time to answer, whether a reset invalidates other sessions, and whether a 401 arrives where the contract says it should. Also unverified: the Prisma migration against a real MySQL 8, which is where the hand-written generated column and the `utf8mb4_0900_as_ci` collation either apply or silently do not. `npm run db:check` reports both, and nobody has run it against a server. Above all, **the cross-origin session cookie has not been tested in any browser**, which is the Stage 0 spike in backend PRD section 2.3 and the one result that could invalidate the session design for every canvas component already built |
| FP-00           | **The connect handshake has never run.** No code has been emailed, no project claimed, no token issued. That leaves unverified: whether `framer.getProjectInfo()` returns an id stable enough to key a tenant on across sessions and machines, whether `setPluginData` actually succeeds with the newly declared permission, and whether a token stored in plugin data survives a Framer project being duplicated, which would hand a copy of the project a live creator session. On the server: whether `Access-Control-Allow-Origin: *` without `Allow-Credentials` really lets the panel's iframe origin through, which is the one assumption the whole plugin half rests on |
| FP-08           | **`createWebPage` has never been called.** The scaffolder is tested against a mock returning what the SDK types promise, so what is unverified is Framer's real behaviour: whether a path with a nested segment creates one page or a tree, what it does with a path that collides with a CMS detail route, and whether the returned node is ready to accept a component instance immediately or needs the same compile wait `resolveInsertUrl` already works around for code files. `<MemberDashboard>` has also never rendered: contrast, layout at a real width, and both themes need a human |
| FP-09           | **No field has been saved to a real server or answered in a browser.** The editor, the modal, the dashboard form, and the flyout are all unrendered. Unverified: the Fields view at 360px in both themes; the modal opening only with a required answer missing and never for a signed-out visitor; a reload resuming the same step; the focus trap and "Step 2 of 3" being announced; a server problem landing under its field; whether `Member.metadata` round trips UTF-8 through the MySQL JSON column, which FP-09 section 5 asks for explicitly. Full list in [`16-onboarding-modal.md`](development-docs/16-onboarding-modal.md) section 7 |
| 2.6, 3.1, 3.2   | Live gateway sandbox transactions and webhook delivery                                                                                                                                                                                                                                                                                                                                                      |
| 3.6             | Google Rich Results Test                                                                                                                                                                                                                                                                                                                                                                                    |
| 4.2             | Real YouTube, Vimeo, and Mux player `postMessage` traffic                                                                                                                                                                                                                                                                                                                                                   |
| 8.2, 8.4        | Visual contrast and screen reader passes                                                                                                                                                                                                                                                                                                                                                                    |
| 8.5             | Penetration testing against a running backend                                                                                                                                                                                                                                                                                                                                                               |
| 8.9             | Screenshots and demo video                                                                                                                                                                                                                                                                                                                                                                                  |

---

## Blockers

| #   | Blocker                                                                                    | Blocks                                                              | Needed from                                            |
| :-- | :----------------------------------------------------------------------------------------- | :------------------------------------------------------------------ | :----------------------------------------------------- |
| B1  | The backend API does not exist. PRD section 10 marks it out-of-repo                        | 2.1 and everything downstream, which is most of Phases 1 to 4. As of 1.7 this is now visible in shipped output: a deployed `<MemberGate>` calls `GET /api/member/session`, gets nothing, and renders its locked state on every visit. Correct per S11 and useless to a creator until the endpoint exists | **Now fully specified** in [`memberframe-backend-prd.md`](memberframe-backend-prd.md), still unbuilt. The open question is no longer who builds it but the Stage 0 cookie spike in that document, section 2.3 |
| B2  | Member caps per tier are unspecified                                                       | Phase 1 data model, PRD section 11                                  | Product decision, PRD section 18                       |
| B3  | Creator-lapse policy for their paying subscribers is unspecified                           | Phase 1 data model                                                  | Product decision, PRD section 18                       |
| B4  | GDPR controller and processor split is unspecified                                         | Phase 1 data model                                                  | Legal and product decision, PRD section 18             |
| B5  | No DOM test environment. `vitest` is installed, `jsdom` is not                             | 8.1 layer 2, component and theme rendering tests. Every F04 rendering criterion, and from 1.7 the four F01 locked states and the entitled render as well. `test/memberGateParity.test.ts` reaches what it can by asserting on the component's source text, which is a real guard and not a substitute for rendering it | Approval to add `jsdom` and a testing library          |
| B6  | No `pack` script                                                                           | 8.8                                                                 | Scheduling, small task                                 |
| B7  | `framer.getCurrentUser()` exposes no email, but PRD section 13 sources `userEmail` from it | F20 telemetry contract, the creator account model in PRD section 12 | Product decision, see `00-test-harness.md` section 8.2 |
| B8  | No runtime schema validation. The API client guarantees the transport contract and casts the response body, so a backend returning the wrong shape typechecks and then fails at the first property access | Every consumer of `services/*`. Mitigated by treating responses defensively, not solved | Approval to add a validation dependency, the same kind of decision `jsdom` was |
| B9  | **No task builds creator authentication**, yet every `/api/site/*` endpoint needs a creator session token. Conflict C10 | 2.2, 2.3, and 2.4 are built and permanently signed out. Also F19 trial eligibility, which keys on creator identity | A task added to Phase 1, or those three tasks moved to Phase 2 |

B2 to B4 change the schema. Settling them after Phase 1 means reworking it. B7 changes the F20 request body and how a creator account is keyed, so it is the same kind of problem: cheaper now than in Phase 2.
