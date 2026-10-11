# MemberFrame Project Review

Review date: 2026-10-11. Scope: every file in `docs/`, `work-precess/`, the agent folders, and all of `src/`.

This review describes what exists today. The plan that follows from it is in [development-plan.md](development-plan.md). Day-to-day steps are in [../work-precess/work-process.md](../work-precess/work-process.md), and live status is in [../work-precess/progress-tracker.md](../work-precess/progress-tracker.md).

---

## 1. Summary

The plugin panel and eight canvas components exist as a **working UI prototype**. It compiles, passes the CSS linter, and builds. Nothing is connected to real data yet: there is no API call anywhere in `src/`, and every login, payment, download, and member list is simulated.

The development docs describe this prototype as "Implemented and Verified". That label is the main problem found in this review, because it hides how much work remains.

Checks run during this review:

| Check | Result |
| :--- | :--- |
| `npm run lint:css` | Pass. 35 files, 0 violations. |
| `npx tsc --noEmit` | Pass. 0 errors. |
| `npx vite build` | Pass. 315 kB JS, 83 kB CSS. |
| Automated tests | None exist. |
| Run inside Framer | Not checked in this review. The docs say it was done, the repo cannot prove it. |

---

## 2. Repository Structure

| Path | What it is | Note |
| :--- | :--- | :--- |
| `src/` | Plugin source (46 files, about 10,200 lines) | See section 3. |
| `docs/` | Product research, feature spec, development docs | See section 4. |
| `work-precess/` | Work process | Folder name is a typo of "process". Kept as is because many docs link to it. |
| `.agent/` | Agent rules, skills, CSS linter | The one to keep. See section 5. |
| `.agents/` | Exact copy of `.agent/` | Duplicate. Delete. See section 5. |
| `.github/agents/` | 9 sub-agent definitions | Fine. |
| `instruction/` | Copy of the company agent instructions | Tracked copy of `Framer-Agent/`. |
| `Framer-Agent/` | Git clone of `Themefic-Team/Framer-Agent` | Ignored by git. Source of `.agent/` and `instruction/`. |
| `framer.json`, `vite.config.ts`, `package.json` | Plugin manifest and build | Fine. No `pack` script, although docs call `npm run pack`. |

---

## 3. Source Code: What Is Really Built

### 3.1. Plugin panel

| Part | Files | Real status |
| :--- | :--- | :--- |
| Shell (header, tabs, footer, collapse, close) | `components/shell/` | Works. |
| Theme sync | `hooks/useFramerTheme.ts` | Works. |
| Home tab | `tabs/HomeTab.tsx` | Static. "124 members" and "$1,420" are hard-coded text. |
| Tiers tab | `tabs/TiersTab.tsx` | Add and delete only. No edit. Saved to browser `localStorage`, not to the Framer project. |
| Members tab | `tabs/MembersTab.tsx` | Four sample members. Search and filters work on the sample. Saved to `localStorage`. |
| Settings tab | `tabs/SettingsTab.tsx` | Saves Stripe publishable key, currency, test mode to Framer plugin data. No key validation. |
| Builder tab | `tabs/BuilderTab.tsx` | Insert and copy buttons work through `createCodeFile`. The "MemberGate Defaults" form changes the small preview only. The values are not passed to the inserted component. |
| Preview Studio | `components/preview/` | Written but never imported. Dead code. |
| UI kit | `components/ui/*.tsx` | `Button`, `InputField`, `Modal`, and others are written but no tab uses them. Tabs repeat raw markup instead. |

### 3.2. Canvas components

All eight are self-contained files with their own CSS string and property controls. All eight are visual mocks.

| Component | What is simulated |
| :--- | :--- |
| `MemberGate` | Reads a `localStorage` flag. No server check. |
| `MemberAuth` | No email is sent. Any six digits are accepted. The Google button jumps straight to "success". |
| `MemberDashboard` | Hard-coded member (`alex.creator@example.com`), plan, and invoices. |
| `MeteredPaywall` | Counts page loads, not unique articles. No monthly reset. |
| `CMSGatedTemplate` | Same `localStorage` flag as the gate. |
| `ProtectedDownload` | A timer, then a "downloaded" message. No file. |
| `CourseProgress` | Local state only. |
| `DonationSlider` | A timer. No checkout. |

Not started: `LessonChecklist`, `VideoProgressListener`, `TeamManagement`, `BookmarkButton`, `BookmarksTray`, `MemberDirectory`, SEO schema injection, Pro-Lock and trial, any payment gateway, any backend client.

### 3.3. Bugs and design problems found

These are real defects in the current prototype, listed by impact.

1. **`MemberGate` is force-locked by default.** The property control default for `simulateState` is `"locked"` ([MemberGate.tsx:307](../src/canvas-components/MemberGate.tsx#L307)), while the function default is `"auto"`. Framer applies the control default, so a gate dropped on a page stays locked for everyone, including paying members, until the creator changes "Canvas Preview" to Auto.
2. **`all_paid` unlocks for any signed-in session.** [MemberGate.tsx:182](../src/canvas-components/MemberGate.tsx#L182) returns `true` without looking at the tier, so a free member passes an "All Paid Members" gate.
3. **Gating is cosmetic.** The protected content is always in the page. It is blurred or hidden with CSS. Setting one `localStorage` key in the browser console unlocks every gate. This is expected for a mock but it is also a product decision that is still open (see development plan, decision D7).
4. **Tiers are hard-coded in the components.** Property controls offer Silver, Gold, VIP only. Tiers created in the Tiers tab never reach the canvas components.
5. **Two type systems.** `types/index.ts` defines `MembershipTier` and `MemberRecord`. `TiersTab` and `MembersTab` each define their own different `MembershipTier` and `Member`. `useMemberSession` defines a third session shape that no component imports.
6. **Shared code that nothing uses.** `hooks/useMemberSession.ts`, `hooks/useSiteTelemetry.ts`, and the 727-line `templates/base-component-styles.ts` are not imported by any component. Canvas components must be single self-contained files, so they cannot import these. The suite doc says components use `injectCanvasStyles` from that file. They do not.
7. **Storage is split.** Settings use Framer plugin data. Tiers and members use `localStorage`, so they are per browser and not per Framer project.
8. **Storage size guard is wrong.** `storageService` warns at 250,000 characters. Framer plugin data allows only a few kB per key. Confirm the exact limit in the Framer docs before storing tier lists there.
9. **`framer as any` 17 times** in `framerCanvasService.ts`. `framer-plugin` 3.x already types `createCodeFile`, `addComponentInstance`, and `notify`.
10. **Site ID is random.** `useSiteTelemetry` invents `mf_xxxxxxx` with `Math.random()`. A real site ID must come from the backend.

---

## 4. Documentation Review

### 4.1. File by file

| File | Verdict |
| :--- | :--- |
| `list-the-features-of-the-competitors.md` | Good research. Keep unchanged. |
| `missing-scopes-we-can-implement.md` | Good gap analysis. Its 8-week roadmap conflicts with the 14-day roadmap elsewhere. |
| `final-feature-specifications.md` | Good product spec. Property control names do not match the code (spec: `requiredTier`, `fallbackAction`, `contentSlot`. Code: `allowedTier`, `fallbackMode`, `children`). Says "nine components", lists 15 features, code has 8. |
| `work-process.md` (in `docs/`) | Pointer page. Used a `file:///d:/...` link that only works on one computer. Fixed. |
| `development-docs/README.md` | Index listed 13 docs that do not exist as live links. Fixed with a status column. |
| `development-docs/00-workspace-setup-and-standards.md` | Accurate for setup. |
| `development-docs/00-plugin-shell.md` | Accurate. |
| `development-docs/01-canvas-components-suite.md` | Says "Implemented and Verified". Should say prototype. Describes a shared style injector the components do not use. |
| `development-docs/01-member-gate.md` | Says "Implemented and Verified" and that it calls `useMemberSession()`. It does not. |
| `development-docs/02-in-plugin-cockpit.md` | Checklist ticks "Stripe secret key with instant test validation". The code has no secret key field and no validation. |
| `work-precess/work-process.md` (old) | Mixed setup, roadmap, and 17 build steps in one file. No way to record progress. Replaced. |

### 4.2. Problems across all docs

- **Status is overstated.** "Implemented and Verified" is used for mock UI.
- **Three roadmaps disagree.** 14 days (feature spec), 14 days with different sprint contents (old work process), 8 weeks (missing scopes). Example: `MemberDashboard` is P0 in one and Sprint 2 in another.
- **Numbering collides.** Two docs start with `00-`, two with `01-`.
- **No backend is acknowledged.** `instruction/AGENTS.md` says this repo is frontend only and the backend is built separately. The 14-day plans count backend work (Stripe webhooks, OTP email, signed URLs) as if it were part of this repo.
- **Spec and code contradict on Stripe keys.** The spec has the creator paste the secret key into the plugin. The Settings tab says secret keys are never stored.
- **Absolute `file:///d:/` links** appear in several development docs. They break on any other machine.
- **No progress tracking anywhere.**

---

## 5. Why There Are Two Agent Folders

`.agent/` and `.agents/` are byte-for-byte identical (18 files each, `diff -r` reports no difference).

| Fact | Evidence |
| :--- | :--- |
| `.agent/` came first | Added in commit `5b4337c` at 11:49. It is the layout shipped by the company `Framer-Agent` repo. |
| `.agents/` is a later copy | Added in commit `75b597b` at 12:47. |
| Everything points to `.agent/` | `package.json` (`lint:css`), every doc, `instruction/AGENTS.md`, `.github/agents/reviewer.agent.md` and `tester.agent.md`. |
| Nothing points to `.agents/` | A search of the whole repo finds zero references. |

The repo does not record what created the copy. The usual cause is an AI coding tool that expects the plural folder name and made its own copy. Keeping both is a real risk: a rule edited in one folder silently differs from the other.

**Decision: keep `.agent/`, delete `.agents/`.**

```bash
git rm -r .agents
```

This command was not run during the review because the delete was blocked by the permission settings. It is safe: the folder is committed, so `git checkout HEAD -- .agents` restores it. If an AI tool you use only reads `.agents/`, do the opposite: keep `.agents/` and update the `lint:css` path in `package.json` and the doc references.

Related duplicate: `instruction/` is a tracked copy of the ignored `Framer-Agent/` clone. It is not harmful, but it will drift when the company repo updates. Re-copy it when you pull `Framer-Agent`.

---

## 6. What Changed in This Review

| File | Change |
| :--- | :--- |
| `docs/project-review.md` | New. This file. |
| `docs/development-plan.md` | New. One roadmap, open decisions, feature guideline. |
| `work-precess/work-process.md` | Rewritten as a step-by-step working process. |
| `work-precess/progress-tracker.md` | New. Status of every feature and task. |
| `docs/work-process.md` | Updated links. |
| `docs/development-docs/README.md` | Real status column, no broken links. |
| `docs/development-docs/01-*.md`, `02-*.md` | Status line corrected to "UI prototype". |

No source code was changed.
