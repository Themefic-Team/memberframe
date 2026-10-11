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
  -> npm run lint:css && npx tsc --noEmit && npm run build
  -> commit:  feat(F01): task 1.4 canvas code generator
  -> tick the row in docs/IMPLEMENTATION-STATUS.md with the commit SHA
```

One task per commit. `git log --oneline | grep task` is the second ledger and it cannot be faked. If the status file claims a task is done and no commit mentions it, that is a bug in the record.

---

## Gates

| Command | Checks |
| :--- | :--- |
| `npm run lint:css` | Zero `style={{ }}` in JSX. Mandatory, no exceptions |
| `npx tsc --noEmit` | Types |
| `npm run build` | `tsc && vite build` |
| `npm run dev` | HTTPS on :5173, self-signed cert |

No test runner is installed yet. PRD section 16 mandates a Vitest triad. Adding `vitest` is unscheduled work: ask first.

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

- **`src/` is a bare skeleton**: `main.tsx`, `App.tsx`, `App.css`. Everything else in PRD section 6.3 is unbuilt.
- **`framer.json` permissions is `[]`.** Declare each permission in the task that first needs it (tasks 1.6 and 5.6), not preemptively.
- **The dev server is HTTPS with a self-signed cert** (`@vitejs/plugin-basic-ssl`). The agent's browser pane cannot load it. Server-side checks with `curl -sk` work.
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
