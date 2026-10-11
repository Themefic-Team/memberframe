# MemberFrame

Framer plugin: native membership, gating, and recurring monetization. React 18 + Vite 6 + TypeScript 5.7 + `framer-plugin` SDK 3.10.

This file is loaded automatically every session. It is an **index, not the content**. Pull only what the current task needs.

---

## Start Of Every Session

1. Read [`docs/IMPLEMENTATION-STATUS.md`](docs/IMPLEMENTATION-STATUS.md). It is the single source of truth for what is done.
2. The user names a task ID, for example "do task 1.4". Find it there, then read the matching PRD section.
3. Read the feature's doc in `docs/development-docs/`. If it does not exist, write it **before** the code.

Do not re-derive decisions. They are already made and recorded. If the PRD and this file disagree, this file is a summary and the PRD wins.

---

## Source Precedence (Binding)

When documents conflict, higher wins:

1. `.agents/rules/` mandatory engineering standards
2. `.agents/skills/framer-plugin-suite/references/` implementation references
3. `instruction/` company doc and writing standards
4. `docs/memberframe-complete-prd.md` the product specification
5. `docs/final-feature-specifications.md`, `docs/list-the-features-of-the-competitors.md`, `docs/missing-scopes-we-can-implement.md` superseded inputs, historical only

Seven known conflicts are already resolved in PRD section 17. Never silently re-resolve one. If you find a new conflict, surface it and ask.

---

## The Per-Task Loop

```
read status row -> read PRD section -> write/update development doc -> code
  -> npm run lint:css && npx tsc --noEmit && npm test && npm run build
  -> set the status row to "awaiting review"
  -> PROPOSE a commit message and stop
```

### The Agent Does Not Commit

**Never run `git commit`, `git push`, or `git add`.** The user reviews every change before it enters history. This is absolute: it holds even when a task is finished, the gates are green, and committing looks like the obvious next step. There is no implied permission.

At the end of a task, output a proposed message in a fenced block, one task per commit, and say plainly that the work is unstaged and waiting:

```
feat(F01): task 1.4 canvas code generator

What changed and why, in prose.

Gates: lint:css, tsc --noEmit, test, build all pass.
Needs human verification: <anything the agent could not check>
```

Use `git status`, `git diff`, and `git log` freely. Those are reads.

### Recording The SHA

The user commits, so the agent cannot know the SHA in the same turn. Backfill it at the **start** of the next session: read `git log --oneline`, match the task ID in the subject, and move the row from `awaiting review` to `done` with the SHA.

`git log --oneline | grep task` is the second ledger and it cannot be faked. A `done` row with no matching commit is a defect in the record: report it, do not quietly fix it.

---

## Gates

| Command | Checks |
| :--- | :--- |
| `npm run lint:css` | Zero `style={{ }}` in JSX. Mandatory, no exceptions |
| `npx tsc --noEmit` | Types in `src` and `test` |
| `npm test` | `vitest run` over `test/**/*.test.ts` |
| `npm run build` | `tsc && vite build` |
| `npm run dev` | HTTPS on :5173, self-signed cert |

`vitest` 5.0.3 arrived with task 0.8 and covers layer 1 of the PRD section 16 triad: pure logic, node environment, no DOM. **`jsdom` and a testing library are still not installed**, so no test renders a React component yet. Adding them is unscheduled work: ask first.

Never import the `framer` singleton as a value in a test. It posts to a parent window that does not exist. Use `createFramerMock` from [`src/utils/framerMock.ts`](src/utils/framerMock.ts), and read [`docs/development-docs/00-test-harness.md`](docs/development-docs/00-test-harness.md) section 8 before widening it: the company reference mock contradicts the installed SDK in three places and must not be copied.

---

## Binding Rules, Compressed

Full text in [`.agents/rules/framer-sdd-standards.md`](.agents/rules/framer-sdd-standards.md). These are the ones most easily violated:

- **Zero inline CSS.** Never `style={{ }}` in JSX. External `.css` only. Semantic class names and state classes (`.is-active`, `.is-locked`). Canvas components consolidate styling into a `cssContent` string injected via `<style>`.
- **Zero hardcoded hex.** Use design tokens: `var(--framefic-page-bg)`, `var(--framefic-surface)`, `var(--title)`, `var(--paragraph)`, `var(--framefic-surface-border)`, `var(--secondary-default)`.
- **Exactly one `.primary-cta` per view.** Brand gradient 180deg `#5271ff` to `#3b51b8`. Never flat `#5271FF` as a button fill, it fails WCAG AA at 4.07:1.
- **Icons: Lucide React or Framer SVG only.** Zero unicode emoji anywhere, including docs and UI copy. All icons `stroke="currentColor"`.
- **Window geometry**: `framer.showUI({ position: "top right", width: 360, height: 640 })`. Collapse goes to height 48.
- **Four-part shell**: Header 48px, Tab Bar 36px, Content Scroll Area, Footer 40px.
- **Form controls**: `.field-row` pattern, label left and control right, 30px tall, 8px radius, control width 160px or `.fill`.
- **Theme sync**: honor `body[data-framer-theme]` and `html[data-user-theme]`. Both themes must hit WCAG AA.
- **`framer.mode` guardrail**: always check before `framer.getCodeFiles()`. Never call it during `configureManagedCollection` or `syncManagedCollection`.
- **2kB limit** on `setPluginData`. Use differential compression.
- **Phase order**: Pro-Lock and trial licensing (F19) come **after** the core workflow works. Building licensing before the product it licenses is prohibited.

### Writing Rules

From [`instruction/INSTRUCTION.md`](instruction/INSTRUCTION.md), applies to UI copy and every markdown file:

- **No em-dashes or en-dashes.** Anywhere. Use commas, colons, or separate sentences.
- Title Case for headings, sentence case for buttons and labels.
- Button copy: verb plus object, 2 to 4 words, 25 characters or fewer.
- Never surface raw enum values to users (`past_due` becomes "Payment failed").

---

## Read Before You Touch

| Working on | Read first |
| :--- | :--- |
| Any UI or CSS | `.agents/skills/framer-plugin-suite/references/design-tokens.css`, PRD section 7 |
| A canvas code component | `.agents/.../canvas-component-template.md`, PRD sections 8 and 9 |
| Pro-Lock, trial, watermark | `.agents/.../pro-lock-engine.md`, `pricing-and-trial-lifecycle.md`, PRD section 12 |
| Telemetry or plugin data | `.agents/.../telemetry-and-tracking.md`, PRD section 13 |
| Account or subscription UI | `.agents/.../profile-and-subscription-ui.md` |
| API calls | PRD section 10. **The backend does not exist yet and is out-of-repo** |
| Data shapes | PRD section 11. The shared `isEntitled` resolver is defined there, do not fork it |
| Tests or packaging | `.agents/.../tdd-and-verification.md`, PRD section 16 |

---

## Repo Facts That Bite

- **`src/` holds the Phase 0 shell**: four-part shell, UI kit, theme hook, four tabs. The feature directories in PRD section 6.3 (`manage/`, `studio/`, `account/`, `canvas-components/`, `services/`) are still unbuilt.
- **The three CSS files under `src/styles/` plus `App.css` are verbatim slices** of `.agents/skills/framer-plugin-suite/references/design-tokens.css`. Each carries a provenance header with the exact `diff` command that proves it has not drifted. Do not hand-edit them. New styling goes in a per-feature file like `shell.css`.
- **`framer.json` permissions is `[]`.** Declare each permission in the task that first needs it (tasks 1.6 and 5.6), not preemptively. This is why the active tab and theme preference persist to `localStorage`: `setPluginData` is not permitted until 5.6.
- **The dev server is HTTPS with a self-signed cert** (`@vitejs/plugin-basic-ssl`). The agent's browser pane cannot load it. Server-side checks work, but only in this exact shape: `curl -sk --http1.1 https://127.0.0.1:5173/...`. Both flags matter, and `localhost` fails where `127.0.0.1` succeeds. Vite's own log (via preview logs) is the better signal: a transform error shows up there.
- **`Framer-Agent/` and `instruction/` are vendored copies** of the agent ecosystem where `.agent/` is the correct directory name. The live copy is `.agents/`. Do not "fix" paths inside those two trees.
- **`.github/agents/` is GitHub Copilot format**, not Claude Code. Claude Code agents live in `.claude/agents/`.

## What The Agent Cannot Verify

State this plainly rather than implying a check happened:

- **Rendered pixels in the Framer desktop app.** Every "renders correctly", contrast, and layout criterion needs a human.
- **Live gateway behavior.** Stripe, Lemon Squeezy, Razorpay sandbox runs and webhook delivery.
- **Anything behind the backend API**, because it is not built.

Record the human verification in section 7 of each development doc.

---

## Open Questions That Block Work

PRD section 18 lists nine. Three change the data model, so they must be answered before Phase 1 schema work: member caps per tier, what happens to a creator's paying subscribers when the creator's own subscription lapses, and the GDPR controller and processor split.
