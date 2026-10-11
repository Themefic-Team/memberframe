# Phase 0 QA Review: Scaffold From The Clean Slate

QA tester script for PRD section 15.2, tasks 0.1 to 0.12. Covers the ledger rows in
[`docs/IMPLEMENTATION-STATUS.md`](../IMPLEMENTATION-STATUS.md) under "Phase 0: Scaffold From The Clean Slate".

| Field                | Value                                                                 |
| :------------------- | :-------------------------------------------------------------------- |
| Review scope         | Phase 0 only. No feature is in scope, because no feature is built yet |
| Tasks under review   | 0.1 to 0.12, twelve rows                                              |
| Code state at review | Unstaged working tree on branch `framer-app`, HEAD `4c4d5f5`          |
| Agent run date       | 2026-10-11                                                            |
| Reviewer             | unassigned                                                            |
| Review date          |                                                                       |
| Verdict              | pending                                                               |

---

## 1. How To Read This Document

Four parts, run in order. Part A and Part B are machine checks and are already filled in with the
agent's last run. Part C needs a human with the Framer desktop app open, and it is the part that
decides whether Phase 0 passes. Part D is the sign-off.

Result vocabulary, one of five:

| Result      | Meaning                                                         |
| :---------- | :-------------------------------------------------------------- |
| Pass        | Observed, matches the expected result                           |
| Fail        | Observed, does not match. Open a defect row in section 7        |
| Blocked     | Could not run. Say what blocked it                              |
| Needs human | The agent cannot check it. Waiting on a tester                  |
| Deferred    | Out of scope for Phase 0 by an explicit decision recorded below |

**An unticked row is not a pass.** Phase 0 closes only when every row in Part C and Part D carries
a result and a tester name.

---

## 2. Before You Start

1. Node 20 or newer. Confirm with `node -v`.
2. `npm install` from the repo root. The lockfile now includes `vitest` 5.0.3, added by task 0.8.
3. `npm run dev`. The server is HTTPS on port 5173 with a self-signed certificate from
   `@vitejs/plugin-basic-ssl`.
4. Open `https://127.0.0.1:5173` once in a normal browser and accept the certificate warning.
   Skipping this makes the plugin fail to load in Framer with no useful error.
   Note that `localhost` fails where `127.0.0.1` succeeds.
5. In the Framer desktop app, open any project, then Plugins, then Open Development Plugin, and
   point it at `https://127.0.0.1:5173`.
6. Keep the plugin devtools console open for the whole session. Test case QA-13 depends on it.

If the panel does not appear at all, stop and record it as QA-01 Fail. Everything after QA-01
assumes a rendered panel.

---

## 3. Part A: Automated Gates

Run all four from the repo root. These are the gates named in the Phase 0 exit criteria plus the
test gate added by task 0.8.

| Gate | Command            | Expected                               | Agent result                                       |
| :--- | :----------------- | :------------------------------------- | :------------------------------------------------- |
| A1   | `npm run lint:css` | `PASSED`, zero inline style violations | Pass. 29 files checked, 0 violations               |
| A2   | `npx tsc --noEmit` | No output, exit 0                      | Pass. Clean over `src` and `test`                  |
| A3   | `npm test`         | All tests pass                         | Pass. 16 of 16 in 295ms, node environment          |
| A4   | `npm run build`    | `built in` with no error               | Pass. 1607 modules, `index-JB-8Fz8r.mjs` 219.90 kB |

Re-run them yourself before signing off. They are cheap and they are the only part of this review
that cannot be fooled by a stale screenshot.

### 3.1. Design System Drift Checks

The three CSS files under review are verbatim slices of the reference design system, each carrying
its own provenance header. A drift check that prints nothing is a pass.

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

### 3.2. Binding Rule Spot Checks

| Check | Rule                                              | Command                                                                                                                                        | Agent result                                                                                       |
| :---- | :------------------------------------------------ | :--------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------- |
| A8    | Zero hardcoded hex outside the two verbatim files | `grep -rEi "#[0-9a-f]{3,8}\b" src --include=*.css --include=*.tsx --include=*.ts` filtered to exclude `design-tokens.css` and `components.css` | Pass, no matches                                                                                   |
| A9    | Zero unicode emoji, zero em-dash, zero en-dash    | Codepoint scan over `src`, `test`, and the touched docs                                                                                        | Pass, clean                                                                                        |
| A10   | Exactly one `.primary-cta` per view               | `grep -rn "primary-cta\|variant=\"primary\"" src`                                                                                              | Pass. One, in `HomeTab.tsx`. Builder, Manage, and Settings have none yet, which is within the rule |

---

## 4. Part B: Static Verification Per Task

One row per ledger task. "Done when" is quoted from PRD section 15.2. The agent column records what
was mechanically confirmed, which is never the same as a visual pass.

| #    | Task                             | Done when, per PRD                                                  | Agent verified                                                                                                        | Needs human                            |
| :--- | :------------------------------- | :------------------------------------------------------------------ | :-------------------------------------------------------------------------------------------------------------------- | :------------------------------------- |
| 0.1  | Fix the lint script path defect  | `npm run lint:css` executes                                         | Pass. Script resolves to `.agents/scripts/lint-zero-inline-css.js` and runs                                           | No                                     |
| 0.2  | Copy the reference design tokens | Imported by `main.tsx`, tokens resolve in devtools                  | Partial. Import present at `main.tsx:12`, all three token layers reach `dist/assets/index-*.css`                      | Yes, QA-07                             |
| 0.3  | Create `docs/development-docs/`  | Exists, satisfying the mandatory rule                               | Pass. Directory, `README.md` index, `_TEMPLATE.md`, and two written docs                                              | No                                     |
| 0.4  | Build the four-part shell        | Header, tab bar, scroll area, footer all render at 360x640          | Partial. Four components plus barrel exist, geometry present in CSS at 48px, 36px, and 40px                           | Yes, QA-01 and QA-02                   |
| 0.5  | Build the shared UI kit          | Nine named components                                               | Pass on existence. All nine export from `src/components/ui/index.ts`                                                  | Yes, QA-12. See the gap in section 7.4 |
| 0.6  | Wire the theme hook              | Switching Framer theme re-renders with no hardcoded hex             | Partial. Hook exists, zero hex confirmed by A8                                                                        | Yes, QA-07 to QA-09                    |
| 0.7  | Add the four empty tabs          | Home, Builder, Manage, Settings navigate and persist the active tab | Partial. Four tab components, one registry in `tabs.ts`, persistence to `localStorage` under `memberframe.active-tab` | Yes, QA-03 and QA-04                   |
| 0.8  | Add the SDK mock                 | Unit tests run with no Framer desktop app                           | **Pass, fully.** 16 of 16 in a node environment, no Framer process                                                    | No, see section 7.3                    |
| 0.9  | Add the collapse toggle          | Collapses to 48px, restores to 640px                                | Partial. Constants are 360, 640, and 48 in `App.tsx`, passed to `framer.showUI`                                       | Yes, QA-05 and QA-06                   |
| 0.10 | Write `CLAUDE.md`                | Rules load each session                                             | Pass. In commit `68fee92`                                                                                             | No                                     |
| 0.11 | Write the ledger                 | File exists                                                         | Pass. In commit `68fee92`                                                                                             | No                                     |
| 0.12 | Create the five sub-agents       | `.claude/agents/*.md`                                               | Pass. Five files on disk, five in `68fee92`                                                                           | No                                     |

Task 0.8 is the only build row the agent can close by itself, because its done-when is literally
"tests run without the desktop app" and that is a command, not a pixel.

---

## 5. Part C: Manual Test Cases

Run every case. Fill in Result and Notes. A tester name is required on each row.

### QA-01: Panel Opens At The Right Size

|          |                                                                                                           |
| :------- | :-------------------------------------------------------------------------------------------------------- |
| Covers   | 0.4, 0.9, exit criteria                                                                                   |
| Steps    | Open the development plugin in Framer                                                                     |
| Expected | Panel docks top right, 360px wide, 640px tall. No horizontal scrollbar. No layout shift after first paint |
| Result   |                                                                                                           |
| Notes    |                                                                                                           |

### QA-02: Four-Part Shell Geometry

|          |                                                                                                                                                                                                        |
| :------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Covers   | 0.4                                                                                                                                                                                                    |
| Steps    | Inspect the panel top to bottom                                                                                                                                                                        |
| Expected | Header 48px with the plugin name and two icon buttons. Tab bar 36px with four tabs plus an account button. Content area scrolls. Footer 40px pinned to the bottom and does not scroll with the content |
| Result   |                                                                                                                                                                                                        |
| Notes    |                                                                                                                                                                                                        |

### QA-03: All Four Tabs Navigate

|          |                                                                                                                                                                                                                           |
| :------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Covers   | 0.7, exit criteria                                                                                                                                                                                                        |
| Steps    | Click Home, Builder, Manage, Settings in turn, then click back to Home                                                                                                                                                    |
| Expected | Each click swaps the content area. The clicked tab shows the selected state. No flash of empty panel. Home shows a primary call to action, Builder and Manage show an empty state, Settings shows the panel theme control |
| Result   |                                                                                                                                                                                                                           |
| Notes    |                                                                                                                                                                                                                           |

### QA-04: Active Tab Survives A Reopen

|          |                                                                                                                                  |
| :------- | :------------------------------------------------------------------------------------------------------------------------------- |
| Covers   | 0.7                                                                                                                              |
| Steps    | Select Manage. Close the plugin with the header close button. Reopen it                                                          |
| Expected | Manage is still selected. Persistence is `localStorage`, not plugin data, because that permission is not declared until task 5.6 |
| Result   |                                                                                                                                  |
| Notes    |                                                                                                                                  |

### QA-05: Collapse To 48px

|          |                                                                                                                                                                                                                                    |
| :------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Covers   | 0.9                                                                                                                                                                                                                                |
| Steps    | Click the collapse button in the header                                                                                                                                                                                            |
| Expected | Window shrinks to 48px tall. Only the header remains. The tab bar, content, and footer leave the DOM rather than hide, so nothing is reachable by keyboard inside the collapsed window. The button label changes to "Expand panel" |
| Result   |                                                                                                                                                                                                                                    |
| Notes    |                                                                                                                                                                                                                                    |

### QA-06: Restore To 640px

|          |                                                                                                      |
| :------- | :--------------------------------------------------------------------------------------------------- |
| Covers   | 0.9                                                                                                  |
| Steps    | From the collapsed state, click expand                                                               |
| Expected | Window returns to exactly 640px tall. The previously active tab is still selected, not reset to Home |
| Result   |                                                                                                      |
| Notes    |                                                                                                      |

### QA-07: Theme Follows The Framer Workspace

|          |                                                                                                                                                           |
| :------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Covers   | 0.2, 0.6, exit criteria                                                                                                                                   |
| Steps    | Leave the panel theme on Auto. Switch the Framer workspace between light and dark, both directions                                                        |
| Expected | The panel repaints to match on both switches. Surfaces, borders, and text all move together. No element keeps its old colour. No flash of the wrong theme |
| Result   |                                                                                                                                                           |
| Notes    |                                                                                                                                                           |

### QA-08: Manual Theme Override, Including The Known Defect Case

|          |                                                                                                                                                                                                                                                                                                                                                                                                       |
| :------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Covers   | 0.6                                                                                                                                                                                                                                                                                                                                                                                                   |
| Steps    | Go to Settings. Set panel theme to Dark while the Framer workspace is Light. Then set it to Light while the workspace is Dark. Then back to Auto                                                                                                                                                                                                                                                      |
| Expected | The override wins in both directions. This is the exact case that a specificity defect in the reference token CSS would break: the light layer outranks the forced-dark layer, so workspace Light plus panel Dark would resolve to light. The hook works around it by writing the override attribute to both `html` and `body`. **Test this case deliberately, it is the one most likely to regress** |
| Result   |                                                                                                                                                                                                                                                                                                                                                                                                       |
| Notes    |                                                                                                                                                                                                                                                                                                                                                                                                       |

### QA-09: Theme Preference Persists

|          |                                                                                                      |
| :------- | :--------------------------------------------------------------------------------------------------- |
| Covers   | 0.6                                                                                                  |
| Steps    | Set panel theme to Dark. Close and reopen the plugin                                                 |
| Expected | Still Dark. Setting it back to Auto clears the stored preference rather than storing the word "auto" |
| Result   |                                                                                                      |
| Notes    |                                                                                                      |

### QA-10: WCAG AA Contrast In Both Themes

|          |                                                                                                                                                                                                 |
| :------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Covers   | 0.6, exit criteria                                                                                                                                                                              |
| Steps    | In each theme, sample body text, muted or secondary text, the primary call to action label, tab labels in both selected and unselected state, and footer links                                  |
| Expected | Every pair meets 4.5:1 for normal text and 3:1 for large text. The primary call to action is the 180 degree gradient from `#5271ff` to `#3b51b8`, never a flat `#5271FF`, which fails at 4.07:1 |
| Result   |                                                                                                                                                                                                 |
| Notes    |                                                                                                                                                                                                 |

### QA-11: Keyboard And Focus

|          |                                                                                                                                                                                                         |
| :------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Covers   | 0.4, 0.5                                                                                                                                                                                                |
| Steps    | Tab through the panel from the top. Use arrow keys on the tab bar and on the panel theme control                                                                                                        |
| Expected | A visible focus ring on every interactive element. The tab bar exposes `role="tablist"` with the label "Plugin sections" and each panel is linked to its tab. No focus trap. No element reachable twice |
| Result   |                                                                                                                                                                                                         |
| Notes    |                                                                                                                                                                                                         |

### QA-12: UI Kit Renders

|          |                                                                                                                                                                                                |
| :------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Covers   | 0.5                                                                                                                                                                                            |
| Steps    | Inspect the five kit components that a view actually mounts: Button on Home, EmptyState on Home, Builder, and Manage, FieldRow and Segmented on Settings, IconButton in the header and tab bar |
| Expected | Each renders at the documented size. Form controls follow the field row pattern: label left, control right, 30px tall, 8px radius                                                              |
| Result   |                                                                                                                                                                                                |
| Notes    | Four of the nine are not mounted anywhere. See section 7.4                                                                                                                                     |

### QA-13: Console Is Clean

|          |                                                                                                                                                   |
| :------- | :------------------------------------------------------------------------------------------------------------------------------------------------ |
| Covers   | exit criteria                                                                                                                                     |
| Steps    | With devtools open, repeat QA-03 and QA-05 through QA-09, then read the whole console                                                             |
| Expected | Zero errors and zero React warnings. A `FramerPluginClosedError` after pressing close is expected and documented as safe. Anything else is a Fail |
| Result   |                                                                                                                                                   |
| Notes    |                                                                                                                                                   |

### QA-14: Close Plugin

|          |                                                                                         |
| :------- | :-------------------------------------------------------------------------------------- |
| Covers   | 0.4                                                                                     |
| Steps    | Click the close button in the header                                                    |
| Expected | The panel closes cleanly. The throw is caught, so no uncaught error reaches the console |
| Result   |                                                                                         |
| Notes    |                                                                                         |

### QA-15: Footer Links

|          |                                                                                                                                                                                                                            |
| :------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Covers   | 0.4                                                                                                                                                                                                                        |
| Steps    | Read the footer. Do not expect the links to resolve                                                                                                                                                                        |
| Expected | Version reads 1.0.0 and matches `framer.json`. Company name reads Pixelfic. **Both URLs are known placeholders** and are marked Deferred to PRD task 8.8. Confirm they are placeholders, do not file them as a defect here |
| Result   | Deferred                                                                                                                                                                                                                   |
| Notes    | Tracked in section 7.5                                                                                                                                                                                                     |

---

## 6. Part D: Phase 0 Exit Criteria Sign-Off

Quoted from PRD section 15.2. All six must pass before Phase 1 task 1.1 starts.

| #   | Criterion                                      | Source       | Result |
| :-- | :--------------------------------------------- | :----------- | :----- |
| E1  | Panel opens in Framer with zero console errors | QA-01, QA-13 |        |
| E2  | All four tabs navigate                         | QA-03        |        |
| E3  | Theme switches cleanly                         | QA-07, QA-08 |        |
| E4  | `npm run lint:css` passes                      | A1           | Pass   |
| E5  | `tsc --noEmit` passes                          | A2           | Pass   |
| E6  | `npm run build` succeeds                       | A4           | Pass   |

Three of six are closed by machine. The other three need a tester.

---

## 7. Open Items Carried Into This Review

These are known before you start. Do not re-file them as new defects.

### 7.1. Ledger Discrepancy, Needs A Decision

The Phase 0 table currently marks rows 0.4 to 0.9 as `done` with an empty commit column, while
line 51 of the same file still reads "Six further Phase 0 rows (0.4 to 0.9) sit at `awaiting
review`" and the summary counter still reads 6 done, which counts only the rows that have a commit.

`CLAUDE.md` is explicit that a `done` row with no matching commit is a defect in the record, to be
reported rather than quietly corrected. `git log --oneline` confirms no commit exists for any of
those six rows, and `git status` confirms the work is unstaged.

Either flip the six back to `awaiting review` until the commit lands, or commit and backfill the
SHAs. Until one of those happens the ledger disagrees with itself and this review cannot cite it as
the source of truth.

### 7.2. Reference Design System Specificity Defect

In the reference token CSS the light layer has specificity (0,2,1) and the forced-dark layer has
(0,1,2), so the light layer wins. Without a workaround, workspace Light plus panel Dark resolves to
light. The `:not()` in the light layer reads the override attribute on `body` while the forced-dark
rule reads it on `html`, so `useFramerTheme` writes the attribute to both elements. That makes the
`:not()` fail as intended and leaves the copied CSS byte-identical to the reference.

The defect is in the shared reference, not in this repo, and it is still there. QA-08 exercises it.

### 7.3. Mock Fidelity Is Unverifiable, By Construction

Task 0.8 fixtures typecheck against the SDK type declarations, which proves they match what Framer
**declares**, not what it **returns**. Nobody can close that gap without running against a live app
and comparing field by field. It does not block Phase 0, because the task's done-when is that tests
run without the desktop app, and they do. Revisit when a feature first reads one of those calls for
real.

The reference mock sample in the skills directory disagrees with SDK 3.10.3 in three places, so it
was deliberately not copied. Two tests assert the absent fields stay absent.

### 7.4. Four Kit Components Are Not Mounted Anywhere

Task 0.5 requires nine components and all nine exist and compile. But Banner, Checkbox, Toggle, and
the toast provider are not rendered by any view, so a tester cannot see them in the panel. The
toast provider in particular is not wired into `App.tsx`, which means `useToast` would throw if a
feature called it today.

This is not a 0.5 failure, since the done-when is the component set. It is a coverage gap in this
review. Recommendation: the first Phase 1 task that needs a toast wires the provider, and the
Builder tab picks up the field controls, which puts Toggle and Checkbox on screen. Do not build a
throwaway gallery view for it.

### 7.5. Two Placeholder URLs

`companyUrl` and `changelogUrl` in [`src/config/branding.ts`](../../src/config/branding.ts) are
marked UNCONFIRMED in the file itself. The PRD names only the backend host and never gives a
marketing site or a changelog location. Both are centralised so the fix is one line. Due at PRD
task 8.8, before packaging.

### 7.6. Product Blocker Found By Task 0.8

PRD section 13 sources the telemetry field `userEmail` from `framer.getCurrentUser()`, and the SDK
exposes no email on `User`. No other SDK call provides one. This breaks the F20 data contract and
the creator account model in PRD section 12, because a creator identified only by a hashed id
cannot be emailed about a failed payment. Three candidate resolutions are in
[`00-test-harness.md`](../development-docs/00-test-harness.md) section 8.2. Needs a product
decision, not a QA result.

### 7.7. Duplicate Font Request

`framer-plugin/framer.css` loads Inter, and the copied token layer loads Inter again plus DM Sans.
Two requests for the same family. Harmless to function, worth one line of cleanup before packaging.

---

## 8. Defects Found During This Review

Add one row per Fail. Keep the QA id so the fix can be traced back.

| ID  | QA case | Severity | What was observed | Expected | Owner | State |
| :-- | :------ | :------- | :---------------- | :------- | :---- | :---- |
|     |         |          |                   |          |       |       |

Severity: Blocker stops Phase 1, Major breaks a done-when, Minor is cosmetic.

---

## 9. Sign-Off

Phase 0 is accepted when Part A is green, every Part C row has a result, every Part D criterion has
a result, and section 8 holds no open Blocker or Major.

| Role           | Name | Date | Verdict |
| :------------- | :--- | :--- | :------ |
| QA tester      |      |      |         |
| Reviewer, code |      |      |         |
| Accepted by    |      |      |         |

On acceptance: update the Phase 0 rows in [`docs/IMPLEMENTATION-STATUS.md`](../IMPLEMENTATION-STATUS.md)
with their commit SHAs, resolve section 7.1, and record the tester name against tasks 0.2, 0.4 to
0.7, and 0.9 in the human verification table at the bottom of the ledger.
