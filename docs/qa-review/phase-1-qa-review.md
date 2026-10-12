# Phase 1 QA Review: Foundation And Core Gating

QA tester script for PRD section 15.4, tasks 1.1 to 2.8. Covers the ledger rows in
[`docs/IMPLEMENTATION-STATUS.md`](../IMPLEMENTATION-STATUS.md) under "Phase 1: Foundation And Core Gating".

| Field                | Value                                                                        |
| :------------------- | :--------------------------------------------------------------------------- |
| Review scope         | Phase 1 only, both weeks. Features F01, F02, F03, F04, F05                   |
| Tasks under review   | 1.1 to 1.8 and 2.1 to 2.8, sixteen rows                                      |
| Code state at review | Unstaged working tree on branch `framer-app`, HEAD `cd5c248`                 |
| Agent run date       | 2026-10-12                                                                   |
| Reviewer             | unassigned                                                                   |
| Review date          |                                                                              |
| Verdict              | pending                                                                      |
| Prerequisite         | Phase 0 QA sign-off is still open. See section 7.1                           |

---

## 1. How To Read This Document

Same four parts as the Phase 0 review, run in order. Part A and Part B are machine checks and are
already filled in with the agent's last run. Part C needs a human, and it is the part that decides
whether Phase 1 passes. Part D is the sign-off.

Case ids run from **QA-101** upward so they never collide with the Phase 0 ids QA-01 to QA-15. A
reference to QA-03 always means the Phase 0 case.

Result vocabulary, one of six. The sixth is new in this phase and it matters:

| Result             | Meaning                                                                                            |
| :----------------- | :------------------------------------------------------------------------------------------------- |
| Pass               | Observed, matches the expected result                                                              |
| Fail               | Observed, does not match. Open a defect row in section 8                                           |
| Blocked, backend   | **Cannot run until the backend exists.** Not a defect, not a pass. Blocker B1. See section 1.1     |
| Blocked, other     | Could not run for any other reason. Say what blocked it                                            |
| Needs human        | The agent cannot check it. Waiting on a tester                                                     |
| Deferred           | Out of scope for Phase 1 by an explicit decision recorded below                                    |

**An unticked row is not a pass**, and **a row blocked on the backend is not a pass either.** Phase
1 closes only when every row in Part C and Part D carries a result and a tester name.

### 1.1. Read This Before You File Anything

Three structural facts shape the whole review. None of them is a defect you can file.

**The backend does not exist.** PRD section 10.1 puts the API outside this repository, and nothing
has been built there. Every `/api/*` call in Phase 1 therefore fails, and the client turns that
failure into a signed-out or locked state on purpose. A tester who expects to see a member list
will see an empty signed-out panel and that is the correct behaviour today. Roughly a third of the
cases below carry `Blocked, backend` as their pre-filled result.

**There is no creator session token, and no task in the plan builds one.** Conflict C10 in the
ledger. Every `/api/site/*` endpoint needs one, so the Manage tab and the gateway vault would
render their signed-out state even if the backend were live. This is a schedule defect and it needs
a product decision, not a QA result.

**PRD section 15.4 has no "Done When" column.** Section 15.2 gave Phase 0 one per task, and the
Phase 1 table gives only task, feature, and files. The acceptance criteria in Part B are therefore
sourced from the F01 to F05 acceptance criteria lists in PRD section 8, the per-feature gate in PRD
section 16.2, and the task statement itself. Where the PRD is genuinely silent, the row says so
rather than inventing a bar.

---

## 2. Before You Start

1. Node 20 or newer. Confirm with `node -v`.
2. `npm install` from the repo root.
3. `npm run dev`. HTTPS on port 5173, self-signed certificate.
4. Open `https://127.0.0.1:5173` once in a normal browser and accept the certificate warning.
   `localhost` fails where `127.0.0.1` succeeds.
5. In the Framer desktop app, open a project, then Plugins, then Open Development Plugin, pointed at
   `https://127.0.0.1:5173`.
6. Keep the plugin devtools console open for the whole session. QA-147 depends on it.
7. **Prepare a canvas frame to gate.** Several F01 cases need a real frame with visible content on
   it. Make one before you start, with text in it you will recognise when it is revealed.
8. **Do not paste a real gateway secret key anywhere in this review.** Use Stripe's published test
   keys. Section 5.4 names the cases that need them.

### 2.1. What Will Not Work, By Design

Read this list once so you do not file six duplicate defects:

| You will see                                                     | Because                                                       |
| :--------------------------------------------------------------- | :------------------------------------------------------------ |
| Manage tab shows a signed-out or error state, never a member list | No backend, no creator token. B1 and C10                      |
| Tier editor will not save                                        | Same                                                          |
| Gateway vault will not validate a key or remember one            | Same, and by design nothing is persisted client side          |
| Checkout does nothing                                            | Same                                                          |
| `<MemberAuth>` on the canvas cannot send or verify a code        | Same, plus the two OTP routes are proposals. Conflict C11     |
| `<MemberAuth>` has no preview in the Builder tab                 | Authored at task 2.5, no task in the plan builds its preview  |
| 13 of the 15 components in the picker show no preview            | They are not authored yet. Tasks 3.4 onward                   |

---

## 3. Part A: Automated Gates

Run all four from the repo root. Re-run them yourself before signing off. They are cheap and they
are the only part of this review that cannot be fooled by a stale screenshot.

| Gate | Command            | Expected                               | Agent result                                                   |
| :--- | :----------------- | :------------------------------------- | :------------------------------------------------------------- |
| A1   | `npm run lint:css` | `PASSED`, zero inline style violations | Pass. 64 files checked, 0 violations. Was 29 at Phase 0        |
| A2   | `npx tsc --noEmit` | No output, exit 0                      | Pass. Clean over `src` and `test`                              |
| A3   | `npm test`         | All tests pass                         | Pass. 365 of 365 across 13 files in 957ms. Was 16 at Phase 0   |
| A4   | `npm run build`    | `built in` with no error               | Pass. 1643 modules, `index-Bg-cm4TS.mjs` 338.89 kB, CSS 82.80 kB |

Test coverage is layer 1 of the PRD section 16 triad only: pure logic in a node environment.
**No test renders a React component**, because `jsdom` and a testing library are still not
installed. Blocker B5. The thirteen files cover `entitlement`, `money`, `apiClient`,
`tierValidation`, `memberFilters`, `gatewayKeys`, `checkoutService`, `memberSession`, `memberAuth`,
`canvasCodeGenerator`, `framerCanvasService`, `memberGateParity`, and `framerMock`.

### 3.1. Design System Drift Checks

The three CSS files under review are verbatim slices of the reference design system. A drift check
that prints nothing is a pass.

```sh
R=.agents/skills/framer-plugin-suite/references/design-tokens.css

diff <(tail -n +17 src/styles/design-tokens.css) <(sed -n '1,256p' $R)
diff <(tail -n +21 src/styles/components.css)    <(sed -n '258,553p;580,2642p' $R)
diff <(tail -n +17 src/App.css)                  <(sed -n '554,578p' $R)
```

| Check | Expected                                        | Agent result   |
| :---- | :---------------------------------------------- | :------------- |
| A5    | `design-tokens.css` byte-identical below header | Pass, no drift |
| A6    | `components.css` byte-identical below header    | Pass, no drift |
| A7    | `App.css` byte-identical below header           | Pass, no drift |

Phase 1 added three per-feature stylesheets instead of touching those files: `builder.css`,
`manage.css`, and `settings.css`. All three are registered in `src/main.tsx`.

### 3.2. Binding Rule Spot Checks

| Check | Rule                                       | Command                                                                             | Agent result                                                                 |
| :---- | :----------------------------------------- | :---------------------------------------------------------------------------------- | :--------------------------------------------------------------------------- |
| A8    | Zero hardcoded hex in the panel            | Hex scan over `src`, excluding the three verbatim files and `src/canvas-components/` | Pass with one named exception. See section 3.5                               |
| A9    | Zero emoji, zero em-dash, zero en-dash     | Codepoint scan over `src`, `test`, `docs/development-docs`, `docs/qa-review`          | Pass. Zero matches                                                           |
| A10   | Exactly one `.primary-cta` per view        | `grep -rn 'variant="primary"' src/components src/App.tsx`                           | Pass. One each in Home, Builder, Settings. Three in `TierEditor.tsx`, provably exclusive. See QA-131 |
| A11   | No platform fee anywhere, F03's criterion  | Scan `src/services` for nine fee identifiers including `application_fee_amount`      | Pass. Zero matches                                                           |
| A12   | No secret persisted client side            | Scan `src/components/settings` for storage, cookie, plugin data, and console APIs    | Pass in code. Three matches, all in explanatory comments, none a call site   |
| A13   | `framer.json` declares exactly four permissions | `cat framer.json`                                                              | Pass. `addComponentInstance`, `createCodeFile`, `setCodeFileContent`, `setParent` |
| A14   | The preview issues no network request, F04's criterion | Scan `src/components/studio` for `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource` | Pass. Zero matches. QA-105 still confirms it in the network panel   |

A12 is worth reading twice. The three matches are comment lines explaining that the vault must not
use those APIs. The test that enforces this strips comments before scanning, which is why it passes
and why a careless `grep` looks like a failure.

### 3.3. Canvas Component Checks

These cover the code that ships to a creator's published site, which is the only code in this
repository that a stranger's browser will execute.

| Check | What                                                     | Agent result                                                                  |
| :---- | :------------------------------------------------------- | :---------------------------------------------------------------------------- |
| A15   | Generated output parses as TSX                           | Pass. Both components run through esbuild's TSX loader, including two hostile inputs: a string breakout attempt and a `</style><script>` payload |
| A16   | Component size against PRD section 14.2 P3, 40kB gzipped | Pass. `MemberGate.tsx` 24,499 bytes raw and 7,903 gzipped. `MemberAuth.tsx` 37,329 raw and 10,690 gzipped |
| A17   | The two `isEntitled` copies have not diverged            | Pass. `test/memberGateParity.test.ts` extracts both function bodies by brace matching and compares them normalised |
| A18   | That parity test can actually fail                       | Pass. Proved by perturbing `>=` to `>` in one copy: 3 assertions failed. Restored and diffed byte-identical |
| A19   | `<MemberGate>` declares all seven property controls      | Pass. `contentSlot`, `requiredTier`, `fallbackAction`, `redirectUrl`, `cardTitle`, `cardDescription`, `blurIntensity` |
| A20   | `<MemberAuth>` declares ten property controls            | Pass. PRD section 9.2 lists five. See QA-138 for why ten                      |

A17 and A18 together are the important pair. PRD section 11.3 requires the same resolver in the
plugin, the canvas component, and the backend, and the canvas copy cannot import the plugin's,
because it is compiled by Framer on the creator's site. A test that compares them is the only thing
standing between that requirement and a silent divergence, so it was checked that it can fail.

### 3.4. Named Exceptions To The Zero-Hex Rule

The Phase 0 review recorded "zero hardcoded hex, no matches". That is no longer the whole truth and
the difference is deliberate.

**The two canvas components contain hex values**: nine in `MemberGate.tsx`, twelve in
`MemberAuth.tsx`. They are not panel styling. A canvas component is compiled into the creator's own
published website, where `design-tokens.css` is not loaded and `var(--framefic-surface)` resolves
to nothing. Each component therefore declares its own small palette inside its injected
`cssContent`, with a `prefers-color-scheme` block for dark. Using a token there would render the
component unstyled on a live site.

**One hex sits in the panel tree**: `accentColor: "#5271ff"` at
[`src/types/canvas.ts:125`](../../src/types/canvas.ts). It is the default value of a canvas
component property control, so it is canvas data that happens to be declared in a panel file, not a
colour the panel paints with. It matches the brand blue in the design system.

Tester action: confirm these are the only exceptions by re-running A8 unfiltered, and confirm the
count is still 9, 12, and 1. A new hex anywhere else is a Fail.

### 3.5. Two Code Defects Already Found And Fixed

Both were caught by the agent's own tests during the build, before this review. **Do not re-file
them.** They are listed because a tester should spot-check that the fixes hold.

| What                     | Was                                                                | Now                                                             | Spot check                                      |
| :----------------------- | :----------------------------------------------------------------- | :-------------------------------------------------------------- | :---------------------------------------------- |
| `parseRetryAfter("-5")`  | Returned 0, so a meaningless `Retry-After` header rendered "try again in 0 seconds" | Returns `null`. The date branch requires a letter, which every HTTP date carries | `test/apiClient.test.ts`                        |
| `parseMinor("1,999")`    | Truncated to `$1.99`, a thousandfold mispricing on a monthly charge | Refused as `too_precise`. Over-precise input is never reshaped   | QA-130, and `test/money.test.ts`                |

---

## 4. Part B: Static Verification Per Task

One row per ledger task. The criterion column is sourced as described in section 1.1, because PRD
section 15.4 provides no per-task done-when. The agent column records what was mechanically
confirmed, which is never the same as a visual pass.

### 4.1. Week 1

| #   | Task                                 | Criterion applied                                                           | Agent verified                                                                                      | Needs human              |
| :-- | :----------------------------------- | :-------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------- | :----------------------- |
| 1.1 | Live Preview Studio, five states     | F04: all five render distinctly, no console errors                          | Partial. Five states resolve to distinct entitlement outcomes as logic in `test/entitlement.test.ts`. No network path in the subtree, A14 | Yes, QA-101 to QA-106    |
| 1.2 | Simulated session context            | F04: the switcher drives the preview                                        | Pass on logic. `SIMULATED_STATES` has five entries, Guest, Free, Silver, VIP, Failed, covered by `test/memberSession.test.ts` | Yes, QA-102              |
| 1.3 | Builder tab customizer, `.field-row` | Rule: label left, control right, 30px tall, 8px radius                      | Partial. Three new kit controls exist, `TextField`, `Select`, `Slider`. Geometry is in CSS, not measured | Yes, QA-107              |
| 1.4 | Canvas code generator                | F01: generated file compiles in Framer with no missing exports              | Pass on parsing, A15. **Never compiled by Framer itself**                                           | Yes, QA-108              |
| 1.5 | Framer canvas service wrapper        | F01: deploy via `createCodeFile`, insert via `addComponentInstance`          | Partial. Logic proved against `createFramerMock`, and the real SDK is proved to satisfy the narrow interface at compile time | Yes, QA-108 to QA-110, QA-117 |
| 1.6 | First `framer.json` permissions      | The four permissions the deploy path needs                                  | Pass. A13. Note the two namespaces: `framer.json` takes message types, `framer.isAllowedTo` takes method keys | Yes, QA-117              |
| 1.7 | `<MemberGate>`, seven controls       | F01's eight acceptance criteria                                             | Partial. Seven controls declared, A19. Parity holds, A17. Size within budget, A16                   | Yes, QA-111 to QA-119    |
| 1.8 | Shared `isEntitled` resolver         | PRD section 11.3, and it must not be forked                                 | **Pass, as far as a machine can.** 21 cases in `test/entitlement.test.ts`, plus the parity test and its failure proof | No, but see section 7.4  |

### 4.2. Week 2

| #   | Task                       | Criterion applied                                                        | Agent verified                                                                                                  | Needs human                |
| :-- | :------------------------- | :----------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------- | :------------------------- |
| 2.1 | API client, five cases      | PRD section 10.6: five named cases, each with its own behaviour, no retry storm | Partial. 32 cases against an injected `fetch`, which proves the mapping and not the contract. **No request has reached a server** | Yes, and blocked on B1     |
| 2.2 | Manage tab                  | F02: seven acceptance criteria                                            | Partial. All four table states built and prop driven. Filtering, pluralization, and paging covered by 32 cases   | Yes, QA-120 to QA-127      |
| 2.3 | Tier editor, rank uniqueness | F02: `rank` drives entitlement and cannot be duplicated                  | Pass on the rule. 36 cases including the edited tier excluded from its own uniqueness check                     | Yes, QA-128 to QA-130      |
| 2.4 | Gateway key vault            | F03: no secret in a client response, inline field errors, test mode labelled | Partial. A12 holds. 32 cases over prefix detection and masking                                                  | Yes, QA-132 to QA-135      |
| 2.5 | `<MemberAuth>`               | F05: eight acceptance criteria                                            | Partial. 54 cases, the largest file. Origin equality asserted against three loosening regressions. Size within budget | Yes, QA-137 to QA-145      |
| 2.6 | Stripe checkout              | F03: zero platform fee, and the routed gateway decision is server side     | Pass on A11. `isAcceptableCheckoutUrl` refuses anything but https, 18 cases                                     | Blocked, backend           |
| 2.7 | Home tab                     | PRD section 7.3: hero card and quick start, one primary CTA               | Pass on structure. Three route tiles, three link cards, one CTA                                                 | Yes, QA-131                |
| 2.8 | Development docs F01 to F05  | Rule: a doc exists at `docs/development-docs/<nn>-<slug>.md`              | **Pass, fully.** Five feature docs plus `00-api-client.md`, each carrying an unticked human verification table  | No                         |

Tasks 1.8 and 2.8 are the only two rows the agent can close by itself. Everything else ends in a
pixel, a network response, or a Framer behaviour.

---

## 5. Part C: Manual Test Cases

Run every case. Fill in Result and Notes. A tester name is required on each row.

### 5.1. F04: Live Preview Studio And The Builder Tab, Tasks 1.1 To 1.3

#### QA-101: Builder Tab Renders The Picker, Preview, And Customizer

|          |                                                                                                                                                  |
| :------- | :----------------------------------------------------------------------------------------------------------------------------------------------- |
| Covers   | 1.1, 1.3                                                                                                                                         |
| Steps    | Open the Builder tab                                                                                                                             |
| Expected | A component picker listing 15 components, a preview area, a state switcher, and a customizer form. One primary call to action, "Add to canvas". No horizontal scroll at 360px |
| Result   |                                                                                                                                                  |
| Notes    |                                                                                                                                                  |

#### QA-102: The Five-State Switcher Renders Five Distinct Previews

|          |                                                                                                                                                                                                                              |
| :------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Covers   | 1.1, 1.2. F04 criterion 1                                                                                                                                                                                                    |
| Steps    | With Member Gate selected, click Guest, Free, Silver, VIP, and Failed in turn                                                                                                                                                 |
| Expected | Five visibly different previews, each with its caption. Guest and Free show the locked state against a `tier_1` gate. Silver and VIP show the unlocked state. Failed shows locked. No two states look the same. No console error on any switch |
| Result   |                                                                                                                                                                                                                              |
| Notes    |                                                                                                                                                                                                                              |

#### QA-103: Hierarchical Tiers And The Grace Window, In The Preview

|          |                                                                                                                                                                                                                                                    |
| :------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Covers   | 1.2, 1.8. F01 criteria 4 and 5                                                                                                                                                                                                                     |
| Steps    | Set Access Tier to Tier 1: Silver in the customizer. Switch between Silver, VIP, and Failed                                                                                                                                                         |
| Expected | **VIP passes a Silver gate**, because comparison is by rank and not by name. Silver passes. Failed does not. Then set Access Tier to VIP and confirm Silver no longer passes. This is the single most important behaviour in F01 and it is testable here with no backend |
| Result   |                                                                                                                                                                                                                                                    |
| Notes    |                                                                                                                                                                                                                                                    |

#### QA-104: Customizer Changes Reflect Within One Frame

|          |                                                                                                                                             |
| :------- | :------------------------------------------------------------------------------------------------------------------------------------------- |
| Covers   | 1.3. F04 criterion 2                                                                                                                        |
| Steps    | Type into Lock Title one character at a time. Drag the Blur Amount slider from 2 to 20                                                      |
| Expected | The preview updates with no perceptible lag and no dropped keystrokes. The blur visibly changes across the range. No flicker, no remount     |
| Result   |                                                                                                                                             |
| Notes    |                                                                                                                                             |

#### QA-105: The Preview Issues No Network Request

|          |                                                                                                                                                                              |
| :------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Covers   | 1.1. F04 criterion 4                                                                                                                                                         |
| Steps    | Open the network panel, clear it, then exercise QA-102 and QA-104 fully                                                                                                      |
| Expected | **Zero requests.** The preview simulates a session and never calls the API. A14 proves no network identifier exists in the subtree, and this case proves it at runtime        |
| Result   |                                                                                                                                                                              |
| Notes    |                                                                                                                                                                              |

#### QA-106: Preview For All Fifteen Components

|          |                                                                                                                                                                                                                                 |
| :------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Covers   | 1.1. F04 criterion 5                                                                                                                                                                                                            |
| Steps    | Click through all 15 entries in the picker                                                                                                                                                                                      |
| Expected | **Deferred by arithmetic.** Only `<MemberGate>` is preview ready. `<MemberAuth>` is deployable with no preview. The other 13 are not authored until tasks 3.4 and later. Each should show an honest placeholder naming its task, never a blank area or an error |
| Result   | Deferred                                                                                                                                                                                                                        |
| Notes    | Confirm the placeholders are honest. File a defect only if one errors or renders blank                                                                                                                                           |

#### QA-107: Field Row Geometry

|          |                                                                                                                                                                                 |
| :------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Covers   | 1.3                                                                                                                                                                             |
| Steps    | Measure the customizer rows in devtools. Check `TextField`, `Select`, and `Slider`                                                                                              |
| Expected | Label left, control right. Control 30px tall with an 8px radius, and either 160px wide or filling. Rows align with each other. The three new controls match the nine from task 0.5 |
| Result   |                                                                                                                                                                                 |
| Notes    |                                                                                                                                                                                 |

### 5.2. F01: The Deploy Path, Tasks 1.4 To 1.7

**This is the first code in the project that writes to a creator's own Framer project, and no step
of it has ever run against Framer.** Treat every case in this section as high risk. If QA-108 fails,
stop and report it before continuing, because QA-109 onward all assume a deployed file.

#### QA-108: Add To Canvas Creates The Code File

|          |                                                                                                                                                                                                                 |
| :------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Covers   | 1.4, 1.5, 1.6                                                                                                                                                                                                   |
| Steps    | Configure a Member Gate in the Builder tab, then click "Add to canvas"                                                                                                                                          |
| Expected | A code file named `MemberGate.tsx` appears in the Framer project's code files. It compiles with no error and no missing export. A toast confirms, under 45 characters. The panel does not freeze or throw        |
| Result   |                                                                                                                                                                                                                 |
| Notes    |                                                                                                                                                                                                                 |

#### QA-109: The Instance Lands On The Canvas

|          |                                                                                                                                                                                                                                                       |
| :------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Covers   | 1.5                                                                                                                                                                                                                                                   |
| Steps    | Watch the canvas during QA-108                                                                                                                                                                                                                        |
| Expected | A component instance is inserted. **If Framer has not yet published the component export, the agent's code re-reads once and then reports "saved, not inserted" rather than claiming success.** Either outcome is acceptable here; a silent false success is a Fail. Record which one you saw |
| Result   |                                                                                                                                                                                                                                                       |
| Notes    |                                                                                                                                                                                                                                                       |

#### QA-110: A Second Add To Canvas Updates Rather Than Duplicating

|          |                                                                                                                                                              |
| :------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Covers   | 1.5                                                                                                                                                          |
| Steps    | Change the Lock Title, then click "Add to canvas" again                                                                                                      |
| Expected | **One** `MemberGate.tsx`, not two, with the new title inside it. The existing instance keeps working. This is an explicit unknown in the ledger: confirm it   |
| Result   |                                                                                                                                                              |
| Notes    |                                                                                                                                                              |

#### QA-111: All Seven Property Controls Appear In The Sidebar

|          |                                                                                                                                                                                                                                      |
| :------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Covers   | 1.7. F01's control block                                                                                                                                                                                                             |
| Steps    | Select the inserted instance and read Framer's properties sidebar top to bottom                                                                                                                                                      |
| Expected | Protected Frame, Access Tier, Locked State, Redirect Target, Lock Title, Lock Message, Blur Amount. Titles exactly as listed. Access Tier shows five readable option titles, never raw values like `free_member`. Blur Amount is a number with a px unit, clamped 2 to 20 |
| Result   |                                                                                                                                                                                                                                      |
| Notes    |                                                                                                                                                                                                                                      |

#### QA-112: Conditional Controls Hide Correctly

|          |                                                                                                                                                                                                             |
| :------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Covers   | 1.7. F01 criterion 3                                                                                                                                                                                        |
| Steps    | Cycle Locked State through Frosted Blur, Hide Completely, Page Redirect, and Lock Card                                                                                                                      |
| Expected | Blur Amount visible only on Frosted Blur. Redirect Target only on Page Redirect. Lock Title and Lock Message only on Lock Card. Hide Completely shows none of the four. No control flickers in and out       |
| Result   |                                                                                                                                                                                                             |
| Notes    |                                                                                                                                                                                                             |

#### QA-113: An Entitled Member Sees The Frame Unmodified

|          |                                                                                                                                                                                                                                           |
| :------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Covers   | 1.7. F01 criterion 1                                                                                                                                                                                                                      |
| Steps    | Connect your prepared frame to Protected Frame. **Blocked, backend** for a real entitled member, so verify the equivalent in the Builder preview at VIP                                                                                   |
| Expected | The frame renders with no blur, no overlay, no wrapper that shifts its layout, and no added spacing. Compare against the same frame outside the gate. Any visual difference at all is a Fail                                               |
| Result   | Blocked, backend for the live path                                                                                                                                                                                                        |
| Notes    |                                                                                                                                                                                                                                           |

#### QA-114: Each Of The Four Locked States Looks Distinct

|          |                                                                                                                                                                                                                              |
| :------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Covers   | 1.7. F01 criterion 2                                                                                                                                                                                                         |
| Steps    | With the preview at Guest, set Locked State to each of the four in turn                                                                                                                                                      |
| Expected | Frosted Blur blurs the content behind a readable lock card. Hide Completely renders nothing, with no leftover empty box. Page Redirect shows a redirect notice in the preview and does not actually navigate the panel. Lock Card shows the card with your title and message and no blur |
| Result   |                                                                                                                                                                                                                              |
| Notes    |                                                                                                                                                                                                                              |

#### QA-115: The Gate Stays Locked When The API Is Unreachable

|          |                                                                                                                                                                                                                                                                             |
| :------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Covers   | 1.7. F01 criterion 6, PRD section 14.1 S11, PRD section 16.4                                                                                                                                                                                                                |
| Steps    | This is the one case the missing backend makes **easier**. Publish a page with the gate on it. The API host does not exist, so every session call already fails. Then repeat with JavaScript disabled entirely                                                               |
| Expected | **The locked state renders. Never the content, never a crash, never a blank frame.** With JavaScript off, the protected content must not be in the delivered markup at all. Read the page source and search for a phrase from inside your protected frame: finding it is a Fail and a security defect |
| Result   |                                                                                                                                                                                                                                                                             |
| Notes    |                                                                                                                                                                                                                                                                             |

#### QA-116: Blur Amount Is Per Instance

|          |                                                                                                                                                      |
| :------- | :--------------------------------------------------------------------------------------------------------------------------------------------------- |
| Covers   | 1.7                                                                                                                                                  |
| Steps    | Place two gates on one page with different Blur Amounts, 2 and 20                                                                                    |
| Expected | Each blurs by its own value. One does not override the other. The implementation uses a per-instance custom property, so a shared value here is a Fail |
| Result   |                                                                                                                                                      |
| Notes    |                                                                                                                                                      |

#### QA-117: The Permission Guard Behaves When Permission Is Absent

|          |                                                                                                                                                                                                                              |
| :------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Covers   | 1.5, 1.6                                                                                                                                                                                                                     |
| Steps    | Confirm the plugin asks for the four permissions on first use and that accepting them makes "Add to canvas" work. If Framer offers a way to decline, decline and retry                                                        |
| Expected | With permission granted, deploy works. With permission denied, the panel shows a clear message naming what it cannot do, and does not attempt the write or throw an uncaught error. **Record the exact permission prompt text you saw**: the ledger notes that `framer.json` and `framer.isAllowedTo` use two different name spaces, and this is where that would show up |
| Result   |                                                                                                                                                                                                                              |
| Notes    |                                                                                                                                                                                                                              |

#### QA-118: Gate Contrast In Both Colour Schemes

|          |                                                                                                                                                                                                             |
| :------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Covers   | 1.7. F01 criterion 8                                                                                                                                                                                        |
| Steps    | View the published gate in a light browser and a dark one. The component carries its own palette and a `prefers-color-scheme` block, not the panel's tokens. See section 3.4                                 |
| Expected | Lock title, lock message, and button label all meet 4.5:1 against the card. The button is the 180 degree gradient, never flat `#5271ff`, which fails at 4.07:1. Sample the actual rendered pixels, both schemes |
| Result   |                                                                                                                                                                                                             |
| Notes    |                                                                                                                                                                                                             |

#### QA-119: The Shim Is Right About `RenderTarget`

|          |                                                                                                                                                                                                                                                                 |
| :------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Covers   | 1.7                                                                                                                                                                                                                                                             |
| Steps    | On the canvas, with the gate selected, confirm the component shows its design-time appearance rather than attempting a live session call. Then compare with the published page                                                                                   |
| Expected | Canvas and published behaviour differ as intended. **`src/types/framer-canvas.d.ts` is a hand-written shim for the `framer` module, and a shim cannot be wrong in a way the compiler notices.** If `RenderTarget` is wrong, this case is where it surfaces       |
| Result   |                                                                                                                                                                                                                                                                 |
| Notes    |                                                                                                                                                                                                                                                                 |

### 5.3. F02: The Manage Tab, Tasks 2.2, 2.3, And The Home Tab, Task 2.7

#### QA-120: Manage Tab Signed-Out State Is Honest

|          |                                                                                                                                                                                                      |
| :------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Covers   | 2.1, 2.2. Conflict C10                                                                                                                                                                               |
| Steps    | Open the Manage tab                                                                                                                                                                                  |
| Expected | A clear state explaining that members cannot load, with a retry affordance. **Not a spinner that never resolves, not an empty table that implies zero members, and not a raw error string or status code.** This is the correct behaviour today |
| Result   |                                                                                                                                                                                                      |
| Notes    |                                                                                                                                                                                                      |

#### QA-121: Members Table At 360px

|          |                                                                                                                                                                                                 |
| :------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Covers   | 2.2. F02 criterion 7                                                                                                                                                                            |
| Steps    | **Blocked, backend** for real rows. Confirm the structure with whatever the loading and error states render, and review `manage.css` column widths against 360px in devtools                      |
| Expected | No horizontal page scroll at 360px. Email truncates with an ellipsis rather than pushing the row wide. The tier pill and status badge stay on the row                                            |
| Result   | Blocked, backend                                                                                                                                                                                |
| Notes    | Re-run the moment the backend returns rows. This is an F02 acceptance criterion and it cannot be signed off from CSS alone                                                                       |

#### QA-122: Search Debounces At 300ms

|          |                                                                                                                                                                       |
| :------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Covers   | 2.2. F02 criterion 1                                                                                                                                                  |
| Steps    | Type a long query quickly into member search with the network panel open                                                                                              |
| Expected | One request after you stop, not one per keystroke. The field stays responsive while typing. Filtering is by email and by name                                          |
| Result   | Blocked, backend                                                                                                                                                      |
| Notes    | The 300ms constant and the settle logic are unit tested. Only the felt behaviour needs a human                                                                        |

#### QA-123: Status Is Never Shown As A Raw Enum

|          |                                                                                                                                                                                                       |
| :------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Covers   | 2.2. F02 criterion 2, PRD section 7.6 rule 4                                                                                                                                                          |
| Steps    | Read every badge, pill, and label in the Manage tab, including the error and empty states                                                                                                             |
| Expected | **No `past_due`, no `free_member`, no `rate_limited` anywhere on screen.** "Payment failed", not `past_due`. Pills and badges use token colours, never hardcoded hex. Counts pluralize correctly: "1 member", "2 members" |
| Result   |                                                                                                                                                                                                       |
| Notes    |                                                                                                                                                                                                       |

#### QA-124: Member Flyout

|          |                                                                                                                                 |
| :------- | :------------------------------------------------------------------------------------------------------------------------------ |
| Covers   | 2.2                                                                                                                             |
| Steps    | Click a member row                                                                                                              |
| Expected | A flyout with that member's detail. Closes on Escape and on an outside click. Keyboard reachable. Does not shift the table behind it |
| Result   | Blocked, backend                                                                                                                |
| Notes    |                                                                                                                                 |

#### QA-125: Tier Change Confirms Under 45 Characters

|          |                                                                                                                              |
| :------- | :--------------------------------------------------------------------------------------------------------------------------- |
| Covers   | 2.2. F02 criterion 3                                                                                                         |
| Steps    | Change a member's tier                                                                                                       |
| Expected | The change reflects within 2 seconds and a toast confirms. **Count the characters in the toast: 45 or fewer.** No banner for this |
| Result   | Blocked, backend                                                                                                             |
| Notes    |                                                                                                                              |

#### QA-126: Revoke Access Requires A Confirmation

|          |                                                                                                                                                                                      |
| :------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Covers   | 2.2. F02 criterion 4                                                                                                                                                                 |
| Steps    | Click Revoke access. Then try to dismiss the confirmation and confirm nothing happened. Then confirm it properly                                                                     |
| Expected | **The confirmation cannot be skipped**, including by pressing Enter twice quickly. Dismissing it revokes nothing. The confirming control names the consequence, not just "OK"         |
| Result   | Blocked, backend                                                                                                                                                                     |
| Notes    | Confirm the confirmation step appears even while the backend is absent, since the dialog is client side                                                                               |

#### QA-127: Empty List Renders An Empty State

|          |                                                                                                              |
| :------- | :----------------------------------------------------------------------------------------------------------- |
| Covers   | 2.2. F02 criterion 6                                                                                         |
| Steps    | With zero members, view the Members segment                                                                  |
| Expected | `.empty-state` with an icon, a title, a sentence, and a way forward. **Never a blank area.** Distinct from the error state in QA-120 and from the loading state |
| Result   | Blocked, backend                                                                                             |
| Notes    |                                                                                                              |

#### QA-128: Tier Rank Uniqueness Shows An Inline Error

|          |                                                                                                                                                                                                                                                  |
| :------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Covers   | 2.3. F02 criterion 5                                                                                                                                                                                                                             |
| Steps    | Open the tier editor. Create a tier at rank 10. Create a second at rank 10. Then edit the first tier and save it at its own rank 10 unchanged                                                                                                     |
| Expected | The duplicate is refused with the error **under the Rank field, not in a banner**. The third step must succeed: a tier is not a duplicate of itself. This is the rule that makes two tiers identical to every gate on the site if it breaks        |
| Result   | Partially blocked, backend. The validation is client side and runs before any save                                                                                                                                                               |
| Notes    |                                                                                                                                                                                                                                                  |

#### QA-129: Price Entry Refuses Over-Precise Input

|          |                                                                                                                                                                                                                                             |
| :------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Covers   | 2.3. See section 3.5                                                                                                                                                                                                                        |
| Steps    | In Monthly, enter each of: `9.99`, `1,999`, `9.999`, `1e5`, `9.99abc`, `Infinity`, `-5`, and an empty value                                                                                                                                  |
| Expected | `9.99` accepted. **`1,999` refused, not silently read as 1.99.** `9.999` refused as too precise. The last four refused. Empty accepted as no price, because a free tier is legitimate. Every refusal shows an inline error under the field   |
| Result   |                                                                                                                                                                                                                                             |
| Notes    |                                                                                                                                                                                                                                             |

#### QA-130: Exactly One Primary CTA In Every Tier Editor State

|          |                                                                                                                                                                                                       |
| :------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Covers   | 2.3. PRD section 7.5                                                                                                                                                                                  |
| Steps    | Count the gradient buttons in each of four states: loading, no tiers yet, tiers listed with no form open, and the form open                                                                            |
| Expected | **Exactly one in each state, and zero while loading.** `TierEditor.tsx` holds three candidates and a pure function picks one, so a second appearing means that function and the markup have drifted apart |
| Result   |                                                                                                                                                                                                       |
| Notes    |                                                                                                                                                                                                       |

#### QA-131: Home Tab Hero And Quick Start

|          |                                                                                                                                                                                                      |
| :------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Covers   | 2.7                                                                                                                                                                                                  |
| Steps    | Open Home. Click the primary call to action, then each of the three quick-start tiles, then each of the three link cards                                                                              |
| Expected | "Open builder" goes to Builder. The three tiles route to Builder, Manage, and Settings. The three cards open externally in a new tab, never in the panel, which is an iframe with no way back. One primary CTA |
| Result   |                                                                                                                                                                                                      |
| Notes    | Two of the external URLs are known placeholders, tracked at PRD task 8.8. Do not file them                                                                                                           |

### 5.4. F03: Gateway Vault And Checkout, Tasks 2.4 And 2.6

**Use Stripe's published test keys only. Do not paste a live secret key into this review.**

#### QA-132: The Vault Shows Three Gateways And Says Which Work

|          |                                                                                                                                                              |
| :------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Covers   | 2.4                                                                                                                                                         |
| Steps    | Open Settings and find the gateway vault                                                                                                                    |
| Expected | Stripe, Lemon Squeezy, and Razorpay all listed. Stripe is available now. The other two are clearly marked as arriving at tasks 3.1 and 3.2, not silently broken |
| Result   |                                                                                                                                                             |
| Notes    |                                                                                                                                                             |

#### QA-133: An Invalid Key Shows An Inline Field Error

|          |                                                                                                                                                                                                                 |
| :------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Covers   | 2.4. F03 criterion 2                                                                                                                                                                                            |
| Steps    | Paste `not_a_key` into Publishable key. Then paste a secret key beginning `sk_test_` into the **publishable** field                                                                                              |
| Expected | **The error appears under the field, never as a banner.** The second case is caught as the wrong field rather than as an invalid key, and the message says which field it belongs in                              |
| Result   |                                                                                                                                                                                                                 |
| Notes    | Prefix detection guides and does not validate. A client regex that rejects a working key is worse than one accepting a broken key, so only the server validates                                                  |

#### QA-134: Test Keys Are Clearly Labelled

|          |                                                                                                                                  |
| :------- | :------------------------------------------------------------------------------------------------------------------------------- |
| Covers   | 2.4. F03 criterion 3                                                                                                            |
| Steps    | Enter a `pk_test_` key. Then replace it with a `pk_live_` key                                                                   |
| Expected | A Test mode badge appears and is **noticeable enough that a creator would not ship by accident**. It disappears for a live key   |
| Result   |                                                                                                                                 |
| Notes    |                                                                                                                                 |

#### QA-135: No Secret Survives A Reopen

|          |                                                                                                                                                                                                                                                                                      |
| :------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Covers   | 2.4. F03 criterion 1, PRD section 14.1 S1                                                                                                                                                                                                                                           |
| Steps    | Type a test secret key into the vault without saving. Close the plugin. Reopen it. Then, in devtools, read Application, then Local Storage, Session Storage, IndexedDB, and Cookies for the plugin origin, and search each for `sk_`                                                 |
| Expected | **The field is empty and no store contains any part of the key.** The draft lives in React state only. Also confirm the devtools console shows no logged key. Finding a secret in any store is a Fail and a security defect, not a cosmetic one                                      |
| Result   |                                                                                                                                                                                                                                                                                     |
| Notes    | A12 proves no storage API is called from the settings code. This case proves the result                                                                                                                                                                                              |

#### QA-136: Checkout

|          |                                                                                                                                                                                                                              |
| :------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Covers   | 2.6. F03 criteria 4, 5, 6, 7                                                                                                                                                                                                 |
| Steps    | **Blocked, backend.** No checkout session can be created                                                                                                                                                                     |
| Expected | When unblocked: a Stripe session opens, the geolocation routing rules hold, an Indian IP gets Razorpay once a key exists, routing falls back to Stripe with a logged warning when the routed gateway has no key, and **no fee line item appears on any gateway dashboard** |
| Result   | Blocked, backend                                                                                                                                                                                                             |
| Notes    | A11 already proves no fee identifier exists in the source. The dashboard check is the other half                                                                                                                             |

### 5.5. F05: `<MemberAuth>`, Task 2.5

#### QA-137: Ten Property Controls, Not Five

|          |                                                                                                                                                                                                                                                      |
| :------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Covers   | 2.5                                                                                                                                                                                                                                                  |
| Steps    | Deploy `<MemberAuth>` from the Builder tab, select the instance, and read the sidebar                                                                                                                                                                 |
| Expected | Display Mode, Headline, Welcome Message, Email Sign In, Google, Apple, GitHub, Discord, Accent Color, Corner Radius. **PRD section 9.2 lists five controls**, and the five provider booleans are separate because "a disabled provider does not render its button" needs one each and Framer has no multi-checkbox control. Confirm all ten appear and are readable |
| Result   |                                                                                                                                                                                                                                                      |
| Notes    |                                                                                                                                                                                                                                                      |

#### QA-138: A Disabled Provider Renders No Button

|          |                                                                                                                                              |
| :------- | :------------------------------------------------------------------------------------------------------------------------------------------- |
| Covers   | 2.5. F05 criterion 5                                                                                                                        |
| Steps    | Turn every provider off, then on one at a time                                                                                              |
| Expected | A disabled provider leaves **no button, no gap, and no disabled placeholder**. With all providers off and email on, only the email form shows |
| Result   |                                                                                                                                             |
| Notes    |                                                                                                                                             |

#### QA-139: Keyboard, Focus Trap, And Escape

|          |                                                                                                                                                                                                 |
| :------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Covers   | 2.5. F05 criterion 7                                                                                                                                                                            |
| Steps    | Set Display Mode to the modal form on a published page. Tab forward through every element, then Shift+Tab back. Press Escape                                                                     |
| Expected | Focus cycles **inside the modal and never escapes to the page behind it**. Every control has a visible focus ring. Escape closes. Focus returns to whatever opened the modal, not to the top of the page |
| Result   |                                                                                                                                                                                                 |
| Notes    |                                                                                                                                                                                                 |

#### QA-140: The Resend Countdown

|          |                                                                                                                              |
| :------- | :--------------------------------------------------------------------------------------------------------------------------- |
| Covers   | 2.5. F05 criterion 3                                                                                                        |
| Steps    | Request a code. Watch the resend control. Then background the tab for 30 seconds and come back                               |
| Expected | Disabled for 60 seconds with a visible count. **The count is correct after backgrounding**, because it is derived from a deadline rather than decremented by a timer |
| Result   | Blocked, backend for the request itself. The countdown is testable once a send is attempted                                   |
| Notes    |                                                                                                                             |

#### QA-141: The OTP Rules

|          |                                                                                                                                                                                                                                                     |
| :------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Covers   | 2.5. F05 criteria 1 and 2                                                                                                                                                                                                                           |
| Steps    | **Blocked, backend, and also blocked on conflict C11**: the two OTP endpoints this component calls do not exist in PRD section 10.4 and were declared as proposals                                                                                   |
| Expected | When unblocked: a wrong code is rejected, a fourth attempt on one code is rejected and invalidates the code, and a code past 10 minutes gives a **different message** from a wrong code. Rate limiting prevents inbox bombing, PRD section 16.4       |
| Result   | Blocked, backend                                                                                                                                                                                                                                    |
| Notes    | Resolve C11 before the backend routes are written, or this surface will be built twice                                                                                                                                                              |

#### QA-142: A Blocked OAuth Popup Gives An Actionable Error

|          |                                                                                                                                                                             |
| :------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Covers   | 2.5. F05 criterion 6                                                                                                                                                        |
| Steps    | Set the browser to block popups for the published site. Click Google                                                                                                        |
| Expected | **An inline error that says what to do**, not a silent failure and not a spinner that never ends. The button returns to its normal state so a second attempt is possible     |
| Result   |                                                                                                                                                                             |
| Notes    | Testable without the backend, because the popup is blocked before any request                                                                                               |

#### QA-143: The Session Cookie

|          |                                                                                                                                                                                      |
| :------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Covers   | 2.5. F05 criterion 4, PRD section 14.1 S2                                                                                                                                            |
| Steps    | **Blocked, backend.** When unblocked, sign in and inspect the cookie in devtools                                                                                                     |
| Expected | HttpOnly, Secure, and SameSite all set. **No JWT in `localStorage` or `sessionStorage`.** The component reads no token from JavaScript, which is why it sends `credentials: "include"` |
| Result   | Blocked, backend                                                                                                                                                                     |
| Notes    | The absence half is testable now: search every browser store for a token after any sign-in attempt                                                                                   |

#### QA-144: The Accent Colour Cannot Break Out Of Its Declaration

|          |                                                                                                                                                                                                                                                                                  |
| :------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Covers   | 2.5. PRD section 14.1                                                                                                                                                                                                                                                            |
| Steps    | Accent Color is a Framer colour control, but a Framer **variable** can set that prop to arbitrary text. If you can bind it to a text variable, try `red; } body { display: none } .x {`. Otherwise, confirm a normal colour works and record that the hostile case was not reachable |
| Expected | The page does not break. The value is whitelisted to the three notations a colour control emits, both at generate time and at runtime, and anything else falls back to the brand default. **Nothing in the page should disappear**                                                |
| Result   |                                                                                                                                                                                                                                                                                  |
| Notes    | A15 already parses a `</style><script>` payload through the generator. This is the runtime half                                                                                                                                                                                  |

#### QA-145: Provider Brand Marks, A Non-Engineering Review

|          |                                                                                                                                                                                                                                                                      |
| :------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Covers   | 2.5. F05 criterion 8                                                                                                                                                                                                                                                 |
| Steps    | Read the four provider buttons. Confirm zero unicode emoji. Then take the question to whoever owns brand and legal compliance                                                                                                                                       |
| Expected | Zero emoji, which the agent has verified. The marks are monochrome glyphs that inherit colour, a deliberate deviation from the stroke rule because Lucide ships no brand marks. **Google, Apple, GitHub, and Discord each publish sign-in button guidelines, and this usage needs a human sign-off before release** |
| Result   |                                                                                                                                                                                                                                                                      |
| Notes    | Not a code defect. Assign an owner outside QA                                                                                                                                                                                                                        |

### 5.6. Cross-Cutting

#### QA-146: Console Is Clean Across Every New Surface

|          |                                                                                                                                                                                             |
| :------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Covers   | Exit criteria, PRD section 16.3                                                                                                                                                             |
| Steps    | With devtools open, work through sections 5.1 to 5.5, then read the whole console                                                                                                           |
| Expected | Zero errors and zero React warnings. A `FramerPluginClosedError` after pressing close is expected and documented. **A failed `/api/*` request logged by the browser is expected and is not a defect**, but an unhandled rejection from one is |
| Result   |                                                                                                                                                                                             |
| Notes    |                                                                                                                                                                                             |

#### QA-147: Theme Across All Four Tabs

|          |                                                                                                                                                                                      |
| :------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Covers   | Exit criteria. Extends QA-07 and QA-08 to the new surfaces                                                                                                                           |
| Steps    | Switch the Framer workspace between light and dark, both directions, standing on each of Home, Builder, Manage, and Settings in turn. Then repeat with the panel override set opposite |
| Expected | Every new surface repaints together. The Builder preview, the members table states, the tier form, and the vault all follow. **No element keeps its old colour.** The deliberate override case from QA-08 still wins in both directions |
| Result   |                                                                                                                                                                                      |
| Notes    |                                                                                                                                                                                      |

#### QA-148: WCAG AA On The New Panel Surfaces

|          |                                                                                                                                                                                       |
| :------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Covers   | PRD section 14.3, section 16.2                                                                                                                                                        |
| Steps    | In both themes, sample: tier pills, status badges, the Test mode badge, inline field error text, the tier rank marker, tile and card text on Home, and disabled control labels          |
| Expected | 4.5:1 for normal text, 3:1 for large. **Inline error text and the Test mode badge are the two most likely to fail**, because both carry a tone colour on a tinted ground                |
| Result   |                                                                                                                                                                                       |
| Notes    |                                                                                                                                                                                       |

---

## 6. Part D: Phase 1 Exit Criteria Sign-Off

### 6.1. The PRD Section 15.4 Criteria

Quoted from the PRD. All seven must pass before Phase 2 task 3.1 starts.

| #   | Criterion                                             | Source                 | Agent result                                      |
| :-- | :---------------------------------------------------- | :--------------------- | :------------------------------------------------ |
| E1  | A creator creates a tier                              | QA-128                 | Blocked, backend                                  |
| E2  | A creator gates a frame with `<MemberGate>`           | QA-108 to QA-113       | Needs human. The deploy path has never run        |
| E3  | A visitor signs in by OTP                             | QA-141                 | Blocked, backend. Also blocked on conflict C11    |
| E4  | A visitor pays through Stripe                         | QA-136                 | Blocked, backend                                  |
| E5  | The gate unlocks on the published site                | QA-113, QA-115         | Blocked, backend                                  |
| E6  | Linter and typecheck pass                             | A1, A2                 | **Pass**                                          |
| E7  | Five development docs exist                           | Task 2.8               | **Pass.** Five, plus `00-api-client.md`           |

**Two of seven are closed. Four are blocked on a backend that does not exist, and one has never
run.** Phase 1 is feature complete against the task list and its exit criteria are not met. That
distinction is the single most important line in this review.

### 6.2. The Per-Feature Gate, PRD Section 16.2

Six items per feature, five features. A feature is not done until all six pass.

| Item                                             | F01            | F02              | F03              | F04       | F05              |
| :----------------------------------------------- | :------------- | :--------------- | :--------------- | :-------- | :--------------- |
| Light and dark contrast verified                 | QA-118         | QA-148           | QA-148           | QA-147    | QA-118 style     |
| Zero inline CSS verified by the linter           | **Pass, A1**   | **Pass, A1**     | **Pass, A1**     | **Pass**  | **Pass, A1**     |
| Property controls render cleanly in the sidebar  | QA-111, QA-112 | not applicable   | not applicable   | n/a       | QA-137           |
| Backend returns correct codes, all five handled  | Blocked, B1    | Blocked, B1      | Blocked, B1      | n/a       | Blocked, B1      |
| One `.primary-cta` per view                      | **Pass, A10**  | QA-130           | **Pass, A10**    | **Pass**  | n/a              |
| Lucide or Framer SVG only, zero emoji            | **Pass, A9**   | **Pass, A9**     | **Pass, A9**     | **Pass**  | QA-145           |
| A development doc exists                         | **Pass**       | **Pass**         | **Pass**         | **Pass**  | **Pass**         |

### 6.3. Security Review Checklist, The Items In Scope Now

PRD section 16.4 lists ten. Six concern features not yet built. These four are in scope for Phase 1
and must each carry a result:

| #   | Item                                                            | Case            | Result |
| :-- | :-------------------------------------------------------------- | :-------------- | :----- |
| S-a | No gateway secret appears in any client response or client store | QA-135          |        |
| S-b | Every `postMessage` handler validates origin                     | See below       | **Pass, static.** Origin equality, `event.source`, and message type, in that order. A test asserts the comparison is never loosened to `includes`, `endsWith`, or `startsWith` |
| S-c | Blocking the API leaves gated content locked, never revealed      | QA-115          |        |
| S-d | Disabling JavaScript leaves gated content locked                  | QA-115          |        |
| S-e | OTP send is rate limited and cannot bomb a third-party inbox      | QA-141          | Blocked, backend. Rate limiting is a server responsibility |

S-c and S-d are the two that would matter most if they failed, and QA-115 is the only case in this
review where the missing backend makes testing **easier** rather than harder. Run it.

---

## 7. Open Items Carried Into This Review

These are known before you start. Do not re-file them as new defects.

### 7.1. Phase 0 Is Closed In The Ledger And Unsigned In QA

Both statements are true and the difference matters before you start.

**The ledger closes Phase 0 on commit evidence.** All twelve rows are `done` against a SHA, and the
discrepancy recorded in section 7.1 of the Phase 0 review is resolved: rows 0.4 to 0.9 were
backfilled to `cd5c248` on 2026-10-12. Do not re-file it.

**[`phase-0-qa-review.md`](phase-0-qa-review.md) still has no sign-off, no tester name, and three of
its six exit criteria unresolved.** Those three, panel opens with no console errors, four tabs
navigate, and theme switches cleanly, all need a human in Framer. The ledger says as much itself:
the Framer-side checks for 0.2 and 0.4 to 0.7 are open.

One live caveat sits between the two. **`cd5c248` shipped the tab bar with DEF-01 in it**, the
defect that pushed three of four tabs out of the panel, and the one-rule fix in
[`src/styles/shell.css`](../../src/styles/shell.css) is written and gate-green but **not yet
committed**. Row 0.7 is therefore `done` on a commit that does not contain its own fix. Retest
QA-03 during this session, which the Phase 1 setup in section 2 gives you for free, and record that
you tested the working tree rather than that commit.

Running Phase 1 before Phase 0 is signed off is a sequencing decision for the reviewer. It is noted
here rather than resolved.

### 7.2. Four Conflicts Need A Product Decision, Two Urgently

Full write-ups are in the ledger's conflict tables and in the development docs. Fourteen conflicts
have been found across the project. These four are open and affect Phase 1:

| #   | Needs deciding                                                                                                   | Before                                     |
| :-- | :--------------------------------------------------------------------------------------------------------------- | :----------------------------------------- |
| C10 | **No task builds creator authentication**, yet every `/api/site/*` endpoint needs a creator token                 | **Now.** A Phase 1 task, or move 2.2 to 2.4 to Phase 2 |
| C11 | **`<MemberAuth>` calls two OTP endpoints that are not in the contract**, declared as proposals                    | **Before the backend routes are written**  |
| C1  | `gracePeriodEndsAt` is read by the resolver and is not in the session response shape                              | The backend schema                         |
| C5  | The session response carries no tier ladder, so the gate ships a default one                                      | The backend schema                         |
| C9  | Custom tier keys cannot be selected on a gate, whose control is a fixed enum of five                              | Offering custom tiers in the UI            |

C10 and C11 are the two that change what gets built. Neither is a code defect and neither has a QA
result.

### 7.3. Nine Blockers, Of Which B1 Shapes This Whole Review

| #   | Blocker                                                   | Effect here                                                 |
| :-- | :-------------------------------------------------------- | :---------------------------------------------------------- |
| B1  | The backend is out of repo and does not exist             | Roughly a third of Part C, and four of seven exit criteria   |
| B2  | Member caps per tier unspecified                          | Schema. Cheaper to settle now than in Phase 2                |
| B3  | Creator-lapse policy unspecified                          | Schema                                                      |
| B4  | GDPR controller and processor split unspecified           | Schema and legal                                            |
| B5  | No `jsdom`, so no test renders a component                | Everything visual in Part C. See section 7.5                 |
| B6  | No `pack` script                                          | Release gate, not Phase 1                                   |
| B7  | `getCurrentUser()` exposes no email                       | F20 telemetry and the creator account model                  |
| B8  | No runtime schema validation                              | A wrong response shape typechecks and then fails at first use |
| B9  | No creator auth task. Conflict C10                        | Three Week 2 surfaces are permanently signed out             |

### 7.4. The Resolver Exists Twice, By Necessity

PRD section 11.3 requires identical `isEntitled` implementations in the plugin, the canvas
components, and the backend. The canvas copy cannot import the plugin's, because Framer compiles it
on the creator's site. Task 1.7 therefore duplicates it on purpose, and the ledger's earlier note
saying 1.7 "must import" it was wrong and has been corrected.

`test/memberGateParity.test.ts` is what keeps the two honest, and A18 proves it can fail. **The
third copy, the backend's, has nothing watching it at all.** When the backend is written, the
parity check needs extending to it, and no task in the plan does that.

### 7.5. Visual Coverage Has No Automated Layer, And DEF-01 Proved It

All four gates were green while DEF-01 was live, a defect that pushed three of four tabs out of the
panel. `lint:css` checks for inline styles, `tsc` checks types, the build checks that CSS compiles,
and **none of them lays out a box**.

Phase 1 adds far more surface than Phase 0: a members table, a tier form, a gateway vault, a preview
studio, and two canvas components with their own stylesheets. Every one of them is exposed to the
same class of defect. Part C is the only protection, which is why a blank row in it is not a pass.

Adding `jsdom` and a testing library is unscheduled work and needs a decision. So does a visual
regression tool, which is what would actually have caught DEF-01.

### 7.6. The Canvas Components Ship Their Own Palette

Covered in section 3.4. Not a defect, and worth understanding before QA-118, because the gate's
contrast does not come from the panel's design tokens and cannot be fixed by changing them.

### 7.7. `<MemberAuth>` Has No Preview And No Customizer

It is deployable and insertable, and the Builder tab cannot preview it or configure it. The registry
carries a `deployable` flag separate from `previewReady` precisely so the panel does not have to
either refuse to insert a component that exists or claim a preview that does not.

**No task in the 72-task plan builds its preview or its customizer.** A creator configures it in
Framer's sidebar instead, which works and is not what F04 promises. QA-106 records it as deferred.

### 7.8. Two Placeholder URLs, Still

`companyUrl` and `changelogUrl` in [`src/config/branding.ts`](../../src/config/branding.ts), plus
the two paths Home builds on them. All four marked unconfirmed in the file. Due at PRD task 8.8,
before packaging. Do not file them.

---

## 8. Defects Found During This Review

Add one row per Fail. Keep the QA id so the fix can be traced back.

| ID     | QA case | Severity | What was observed | Expected | Owner | State |
| :----- | :------ | :------- | :---------------- | :------- | :---- | :---- |
|        |         |          |                   |          |       |       |

Severity: **Blocker** stops Phase 2, **Major** breaks an acceptance criterion, **Minor** is cosmetic.

Carried from Phase 0, not to be re-filed:

| ID     | QA case | Severity | State               | Note                                                                      |
| :----- | :------ | :------- | :------------------ | :------------------------------------------------------------------------ |
| DEF-01 | QA-03   | Major    | Fixed, needs retest | Three of four tabs overflowed the panel. Retest QA-03 during this session |

Two code defects were found and fixed by the agent's own tests before this review. They are in
section 3.5 with a spot check each, not here, because they never reached a tester.

---

## 9. Sign-Off

Phase 1 is accepted when Part A is green, every Part C row has a result and a tester name, every
Part D criterion has a result, and section 8 holds no open Blocker or Major.

**A result of `Blocked, backend` is an acceptable sign-off value for the rows that carry it, and
accepting Phase 1 with those rows blocked is an explicit decision the reviewer is making.** Record
it below rather than leaving it implied. Four of the seven PRD exit criteria cannot pass today, so
either Phase 1 is accepted as conditionally complete, or it stays open until the backend exists.

| Role                      | Name | Date | Verdict |
| :------------------------ | :--- | :--- | :------ |
| QA tester                 |      |      |         |
| Reviewer, code            |      |      |         |
| Brand and legal, QA-145   |      |      |         |
| Accepted by               |      |      |         |

Conditional acceptance, if chosen. Name the rows being deferred and the date they will be revisited:

| Deferred to | Rows | Revisit date | Approved by |
| :---------- | :--- | :----------- | :---------- |
|             |      |              |             |

On acceptance:

1. Update the sixteen Phase 1 rows in [`docs/IMPLEMENTATION-STATUS.md`](../IMPLEMENTATION-STATUS.md)
   with their commit SHAs, which only exist once the user has committed.
2. Record the tester name against the "1.1 to 1.3", "1.4 to 1.7", and "2.1 to 2.8" rows in the human
   verification table at the bottom of the ledger.
3. Tick the human verification tables in section 7 of each of the five development docs.
4. Resolve C10 and C11, or carry them into Phase 2 as accepted risk with an owner.
5. Sign off Phase 0, which needs DEF-01 retested in Framer and its three open exit criteria run.
