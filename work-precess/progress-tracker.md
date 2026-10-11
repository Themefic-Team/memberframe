# MemberFrame Progress Tracker

The single record of what is done. Update it in the same commit as the work. Rules for updating are in [work-process.md](work-process.md), steps 2 and 8.

Last updated: 2026-10-11 (plan version 2)

Status words: `Not started`, `Prototype` (UI with simulated data), `In progress`, `Done` (real data, all checks pass), `Verified` (tested on a published site by a second person). `Blocked` may be added in the note.

Tasks marked **(BE)** are done in the backend repository. Track them here anyway, so one page shows everything.

---

## 1. Overall

| Milestone | Status | Tasks done | Finished on |
| :--- | :--- | :--- | :--- |
| Research and specification | Done | 3 of 3 | 2026-10-11 |
| Prototype (panel and 8 components, mock data) | Done | 6 of 6 | 2026-10-11 |
| Review and planning | Done | 2 of 2 | 2026-10-11 |
| M0. Clean Foundation | Not started | 0 of 8 | |
| M1. Backend Base | Not started | 0 of 6 | |
| M2. Plugin Connected | Not started | 0 of 6 | |
| M3. Login and Registration | Not started | 0 of 8 | |
| M4. Tiers on Canvas | Not started | 0 of 5 | |
| M5. Access Rules | Not started | 0 of 8 | |
| M6. Pro Subscription | Not started | 0 of 4 | |
| M7. Member Payments | Not planned yet | | |
| M8. Release | Not started | 0 of 3 | |

**Current milestone: M0.** Next task: M0-1.

---

## 2. Completed Work

| ID | Task | Result | Date |
| :--- | :--- | :--- | :--- |
| R-1 | Competitor research | `docs/list-the-features-of-the-competitors.md` | 2026-10-11 |
| R-2 | Gap analysis | `docs/missing-scopes-we-can-implement.md` | 2026-10-11 |
| R-3 | Feature specification (15 features) | `docs/final-feature-specifications.md` | 2026-10-11 |
| P-1 | Workspace: Vite, React, TypeScript, Framer manifest, HTTPS dev server | Builds and loads | 2026-10-11 |
| P-2 | Design tokens, `.primary-cta`, theme sync, zero inline CSS linter | Linter passes, 35 files | 2026-10-11 |
| P-3 | Plugin shell: header, 5 tabs, footer, collapse, close | Works | 2026-10-11 |
| P-4 | Tabs: Home, Builder, Members, Tiers, Settings | Prototype with sample data | 2026-10-11 |
| P-5 | 8 canvas components with property controls | Prototype with simulated behaviour | 2026-10-11 |
| P-6 | Insert component into Framer through `createCodeFile`, copy code | Works | 2026-10-11 |
| A-1 | Project review, first plan, work process, this tracker | `docs/project-review.md` | 2026-10-11 |
| A-2 | Plan version 2: scope narrowed to 4 features, MySQL option meta model, implementation guide | `docs/implementation-guide.md`, `docs/development-plan.md` | 2026-10-11 |

---

## 3. Feature Status

### In scope

| # | Feature | Part | Status | Built in | Dev doc |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 0 | Plugin shell and theme | Panel | Done | Prototype | `00-plugin-shell.md` |
| 1 | Login and registration | Backend member API | Not started | M3 | |
| 1 | | `MemberAuth` component | Prototype (fake code login, to be replaced) | M3 | `05-member-auth.md`, not written |
| 1 | | `MemberAccount` component | Not started | M3 | |
| 1 | | Members tab | Prototype (sample members) | M3 | `02-in-plugin-cockpit.md` |
| 2 | Tiers and pricing | Tiers tab | Prototype (no edit, `localStorage`) | M2 | `02-in-plugin-cockpit.md` |
| 2 | | `PricingTable` component | Not started | M4 | `17-pricing-table.md`, not written |
| 3 | Access rules | Access tab, pages | Not started | M5 | `16-access-rules.md`, not written |
| 3 | | Access tab, sections | Not started | M5 | |
| 3 | | Site script `guard.js` | Not started | M5 | |
| 3 | | `MemberGate` component | Prototype (hard-coded tiers, 2 bugs, to be rebuilt) | M5 | `01-member-gate.md` |
| 4 | Pro subscription | Owner admin screen | Not started | M6 | |
| 4 | | Plan badge and upgrade in plugin | Not started | M6 | |
| - | Backend | Tables, site registration, meta endpoints | Not started | M1 | |
| - | Plugin to backend connection | `apiClient`, site keys | Not started | M2 | |
| - | Settings tab | Paths, registration switch | Prototype (Stripe key field, to be replaced) | M2 | `02-in-plugin-cockpit.md` |
| - | Automated tests | | Not started | M0 | |

### Parked

Not planned until M8 is finished. Prototype files stay in the repo and are hidden from the Builder tab in task M0-5.

| Feature | Current state |
| :--- | :--- |
| `MemberDashboard` (billing portal) | Prototype file |
| `MeteredPaywall` | Prototype file |
| `CMSGatedTemplate` | Prototype file |
| `ProtectedDownload` | Prototype file |
| `CourseProgress` and LMS suite | Prototype file (1 of 3) |
| `DonationSlider` | Prototype file |
| SEO paywall schema, team seats, bookmarks, member directory, extra gateways, social sign-in, Preview Studio | No code |

---

## 4. Task List

Task details are in the development plan, section 3.

### M0. Clean Foundation

| ID | Task | Status | Started | Done | Note |
| :--- | :--- | :--- | :--- | :--- | :--- |
| M0-1 | Delete `.agents/`, keep `.agent/` | Not started | | | Run `git rm -r .agents` |
| M0-2 | One type system, matching the guide | Not started | | | |
| M0-3 | Tabs use the UI kit | Not started | | | |
| M0-4 | Remove `as any` in `framerCanvasService.ts` | Not started | | | |
| M0-5 | Builder tab lists only in-scope components, delete dead files | Not started | | | |
| M0-6 | Add `npm run check` and `npm run pack` | Not started | | | |
| M0-7 | Add Vitest and the access rule test | Not started | | | |
| M0-8 | Six tabs in the tab bar, empty Access tab | Not started | | | |

### M1. Backend Base

| ID | Task | Status | Started | Done | Note |
| :--- | :--- | :--- | :--- | :--- | :--- |
| M1-1 | (BE) Project setup, MySQL, five tables | Not started | | | Needs Q6 |
| M1-2 | (BE) Site register and site info endpoints | Not started | | | |
| M1-3 | (BE) Meta read, add or replace, delete | Not started | | | |
| M1-4 | (BE) CORS, rate limits, shared `site_id` filter | Not started | | | |
| M1-5 | (BE) Tests: one site cannot touch another | Not started | | | |
| M1-6 | Final request and response shapes written in the guide | Not started | | | |

### M2. Plugin Connected

| ID | Task | Status | Started | Done | Note |
| :--- | :--- | :--- | :--- | :--- | :--- |
| M2-1 | `apiClient` with mock mode | Not started | | | |
| M2-2 | Site registration on first open, duplicate project check | Not started | | | |
| M2-3 | `useSiteMeta` hook | Not started | | | |
| M2-4 | Settings tab saves `settings` | Not started | | | |
| M2-5 | Tiers tab: add, edit, delete, reorder, default | Not started | | | |
| M2-6 | Home tab real counts and plan badge | Not started | | | |

### M3. Login and Registration

| ID | Task | Status | Started | Done | Note |
| :--- | :--- | :--- | :--- | :--- | :--- |
| M3-1 | (BE) Register, login, logout, me | Not started | | | Needs Q5 |
| M3-2 | (BE) Member endpoints for the plugin | Not started | | | |
| M3-3 | Generator writes site ID into components | Not started | | | |
| M3-4 | `MemberAuth` login and register forms | Not started | | | |
| M3-5 | `MemberAccount` component | Not started | | | |
| M3-6 | Members tab on real data | Not started | | | |
| M3-7 | Password reset | Not started | | | Needs Q2 |
| M3-8 | Dev doc `05-member-auth.md` | Not started | | | |

### M4. Tiers on Canvas

| ID | Task | Status | Started | Done | Note |
| :--- | :--- | :--- | :--- | :--- | :--- |
| M4-1 | (BE) Public config endpoint | Not started | | | |
| M4-2 | `PricingTable` component | Not started | | | |
| M4-3 | Button behaviour and current plan marker | Not started | | | |
| M4-4 | Safe tier delete | Not started | | | |
| M4-5 | Dev doc `17-pricing-table.md` | Not started | | | |

### M5. Access Rules

| ID | Task | Status | Started | Done | Note |
| :--- | :--- | :--- | :--- | :--- | :--- |
| M5-1 | Access tab, Pages list | Not started | | | |
| M5-2 | `guard.js` site script | Not started | | | |
| M5-3 | "Enable membership on this site" with `setCustomCode` | Not started | | | |
| M5-4 | Rebuild `MemberGate` with section key | Not started | | | Fixes the 2 known bugs |
| M5-5 | Access tab, Sections list and gate insert | Not started | | | |
| M5-6 | Publish notice, locked rows for login pages | Not started | | | |
| M5-7 | Confirm custom code on each Framer plan, `PageGuard` fallback | Not started | | | |
| M5-8 | Rule matching tests, dev docs 01 and 16 | Not started | | | |

### M6. Pro Subscription

| ID | Task | Status | Started | Done | Note |
| :--- | :--- | :--- | :--- | :--- | :--- |
| M6-1 | (BE) Owner admin screens | Not started | | | |
| M6-2 | (BE) Free plan limits | Not started | | | Needs Q3 |
| M6-3 | (BE) Checkout and webhook | Not started | | | Needs Q4 |
| M6-4 | Plugin plan badge, limits, upgrade button | Not started | | | |

### M8. Release

| ID | Task | Status | Started | Done | Note |
| :--- | :--- | :--- | :--- | :--- | :--- |
| M8-1 | Full QA pass | Not started | | | |
| M8-2 | Help documentation | Not started | | | |
| M8-3 | Pack and submit to Marketplace | Not started | | | |

---

## 5. Blockers and Open Questions

Questions are explained in the implementation guide, section 11.

| Date | ID | Blocks | Question | Answer | Resolved |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 2026-10-11 | Q6 | M1 | Where is the backend hosted, and under which domain? | | |
| 2026-10-11 | Q5 | M3 | Email and password, or email code login? | | |
| 2026-10-11 | Q2 | M3-7 | Which service sends password reset emails? | | |
| 2026-10-11 | Q3 | M6 | What does the Free plan limit? | | |
| 2026-10-11 | Q4 | M6 | How do creators pay for Pro? | | |
| 2026-10-11 | Q1 | M7 | How do members pay creators? | | |

---

## 6. Done Log

Newest first. One line per finished task.

| Date | ID | What was finished |
| :--- | :--- | :--- |
| 2026-10-11 | A-2 | Plan version 2. Wrote the implementation guide. Rewrote the development plan and this tracker for the narrowed scope. |
| 2026-10-11 | A-1 | Reviewed all docs and source. Wrote project review, first plan, work process, and tracker. |
| 2026-10-11 | P-1 to P-6 | Prototype of the plugin panel and 8 canvas components. |
| 2026-10-11 | R-1 to R-3 | Research and feature specification. |
