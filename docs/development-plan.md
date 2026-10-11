# MemberFrame Development Plan

This is the single roadmap for MemberFrame. When another document disagrees with this file on scope, order, or timing, this file wins.

- How each feature is designed and built: [implementation-guide.md](implementation-guide.md)
- What exists today: [project-review.md](project-review.md)
- How to do one task, step by step: [../work-precess/work-process.md](../work-precess/work-process.md)
- What is done: [../work-precess/progress-tracker.md](../work-precess/progress-tracker.md)

Plan version 2, 2026-10-11. Version 1 planned a large backend with Stripe Connect and 15 features. Version 2 narrows the product to three core features managed fully inside Framer, with a small MySQL backend.

---

## 1. Scope

### In scope

The creator manages everything inside the Framer plugin. The backend stores data and tracks Pro subscriptions. The creator never opens a backend screen.

| # | Feature | Summary |
| :--- | :--- | :--- |
| 1 | Login and registration | `MemberAuth` on the canvas. New members appear in the Members tab. |
| 2 | Tiers and pricing | Creator makes tiers with prices in the Tiers tab. `PricingTable` shows them on the canvas. |
| 3 | Access rules | New Access tab. Creator ticks which tiers see which pages and which sections. |
| 4 | Pro subscription | Owner admin screen in the backend to track which sites are Pro. |

### Parked

These are in `final-feature-specifications.md` and stay there as ideas. They are not planned until the four features above are released: metered paywall, SEO paywall schema, CMS item gating, protected downloads, LMS suite, team seats, donation slider, bookmarks, member directory, Lemon Squeezy and Razorpay, social sign-in, Preview Studio.

The prototype components for parked features (`MeteredPaywall`, `CMSGatedTemplate`, `ProtectedDownload`, `CourseProgress`, `DonationSlider`, `MemberDashboard`) are removed from the Builder tab in M0 so the plugin only offers what works. The files stay in the repo.

---

## 2. Decisions

### Decided

| ID | Decision | Answer |
| :--- | :--- | :--- |
| D1 | Database | One shared MySQL database for all sites. Every row carries `site_id`. |
| D2 | Storage model | Site configuration as JSON objects in `site_meta` (option meta model). Members as rows in `members`. |
| D3 | Creator login | None. The plugin registers the site and keeps a secret site key in Framer plugin data. |
| D4 | Source of truth | The backend. `localStorage` is not used for tiers or members. |
| D5 | Page restriction | A site script installed by the plugin with `framer.setCustomCode`. |
| D6 | Section restriction | `MemberGate` linked by a section key to a rule in the Access tab. |
| D7 | Protection level | Visual protection for pages and sections. Stated honestly in the product. |
| D8 | Backend location | A separate repository. This repo stays frontend only. |

### Open

These are questions Q1 to Q6 in the implementation guide, section 11. Each blocks the milestone shown.

| ID | Question | Blocks |
| :--- | :--- | :--- |
| Q6 | Backend hosting and domain | M1 |
| Q5 | Email and password, or email code login | M3 |
| Q2 | Email service for password reset | M3 (task M3-7 only) |
| Q3 | What the Free plan limits | M6 |
| Q4 | How creators pay for Pro | M6 |
| Q1 | How members pay creators | M7 |

---

## 3. Milestones

No dates are fixed yet. Add them in the tracker when Q6 is answered. Tasks marked **(BE)** are done in the backend repository. All others are in this repo.

### M0. Clean Foundation

Goal: the prototype is tidy and only shows what will be built.

| Task | Work |
| :--- | :--- |
| M0-1 | Delete `.agents/`. Keep `.agent/`. |
| M0-2 | One type system. Tabs import types from `src/types/index.ts`. Update the types to match the implementation guide, section 2.3. |
| M0-3 | Tabs use the UI kit in `src/components/ui/`. Remove repeated modal and field markup. |
| M0-4 | Remove `as any` in `framerCanvasService.ts`. Use the typed API and `framer.isAllowedTo`. |
| M0-5 | Builder tab lists only in-scope components. Delete unused `PreviewStudio` and `base-component-styles.ts`. |
| M0-6 | Add `npm run check` (lint, type check, build) and `npm run pack`. |
| M0-7 | Add Vitest. First test: the access rule check ("can this tier see this page"). |
| M0-8 | Fit six tabs in the tab bar. Add an empty Access tab. |

Exit: `npm run check` passes. The plugin opens in Framer with six tabs.

### M1. Backend Base

Goal: the backend can register a site and store objects.

| Task | Work |
| :--- | :--- |
| M1-1 | **(BE)** Project setup, MySQL, the five tables from the guide, section 2.2. |
| M1-2 | **(BE)** `POST /api/sites/register` and `GET /api/sites/{siteId}`. Site key hashing. |
| M1-3 | **(BE)** Meta endpoints: read, add or replace, delete. Size limit per object. |
| M1-4 | **(BE)** CORS, rate limiting, one shared `site_id` filter, error format. |
| M1-5 | **(BE)** Tests: site A cannot read or write site B. |
| M1-6 | Write the final request and response shapes into the guide, section 3. |

Exit: with a tool such as Postman, register a site, save a `tiers` object, and read it back.

### M2. Plugin Connected

Goal: the plugin talks to the backend. Nothing is saved in `localStorage`.

| Task | Work |
| :--- | :--- |
| M2-1 | `src/services/apiClient.ts`: typed client, site key header, error handling, mock mode for offline work. |
| M2-2 | Site registration on first open. Keys saved in plugin data. Duplicate project check. |
| M2-3 | `useSiteMeta(key)` hook: load, save, loading and error states. |
| M2-4 | Settings tab saves the `settings` object. |
| M2-5 | Tiers tab: add, edit, delete, reorder, default tier. Saves the `tiers` object. |
| M2-6 | Home tab shows real counts and the plan badge. |

Exit: create a tier in Framer, close the plugin, open it on another computer, and the tier is there.

### M3. Login and Registration (Feature 1)

| Task | Work |
| :--- | :--- |
| M3-1 | **(BE)** `register`, `login`, `logout`, `me`. Password hashing. Session tokens. |
| M3-2 | **(BE)** Member endpoints for the plugin: list with search and paging, add, change, delete. |
| M3-3 | Code generator writes `MF_SITE_ID` and `MF_API` into each component at insert time. |
| M3-4 | `MemberAuth`: login and register forms, all states, property controls from the guide, section 6. |
| M3-5 | `MemberAccount` component: profile, change password, logout. |
| M3-6 | Members tab on real data: list, search, paging, add, change tier, block, delete. |
| M3-7 | Password reset: backend endpoints and the "Forgot password" view. Needs Q2. |
| M3-8 | Development doc `05-member-auth.md`. |

Exit: on a published test site, a visitor registers, logs out, logs in, and appears in the Members tab.

### M4. Tiers on Canvas (Feature 2)

| Task | Work |
| :--- | :--- |
| M4-1 | **(BE)** `GET /api/public/{siteId}/config` returning tiers, rules, and paths. Short cache. |
| M4-2 | `PricingTable` component with property controls and canvas preview. |
| M4-3 | Button behaviour per tier and "Current plan" marker. |
| M4-4 | Safe tier delete: move members, clean access rules. |
| M4-5 | Development doc `17-pricing-table.md`. |

Exit: change a price in the Tiers tab and see it on the published site without republishing.

### M5. Access Rules (Feature 3)

| Task | Work |
| :--- | :--- |
| M5-1 | Access tab, Pages list: read pages from Framer, tier checkboxes, save `access_rules`. |
| M5-2 | `guard.js` site script: rule match, hide, session check, redirect, `window.MemberFrame`, page change handling. |
| M5-3 | Builder tab: "Enable membership on this site" installs the script with `setCustomCode`. Add the permission to `framer.json`. |
| M5-4 | Rebuild `MemberGate`: section key, three locked modes, canvas preview default Unlocked. |
| M5-5 | Access tab, Sections list: "Add Protected Section" saves the rule and inserts the gate with its key. |
| M5-6 | "Publish your site to apply page changes" notice. Lock the login, register, and no-access rows. |
| M5-7 | Confirm custom code works on each Framer site plan. Build `PageGuard` fallback if it does not. |
| M5-8 | Unit tests for rule matching, including CMS paths. Development docs `01-member-gate.md` and `16-access-rules.md`. |

Exit: the five-page example in the guide, section 8, behaves exactly as its table says for a visitor, a Free member, a Pro member, and a Premium member.

**M5 is the first version that can be shown to real creators.**

### M6. Pro Subscription (Feature 4)

| Task | Work |
| :--- | :--- |
| M6-1 | **(BE)** Owner admin login and the Sites, Site detail, and Subscriptions screens. |
| M6-2 | **(BE)** Free plan limits enforced in the API. Needs Q3. |
| M6-3 | **(BE)** Checkout and webhook that sets the plan. Needs Q4. |
| M6-4 | Plugin: plan badge, limit messages, "Upgrade to Pro" button, refresh plan on focus. |

Exit: a test payment turns a site to Pro and the plugin unlocks within a minute.

### M7. Member Payments

Planned after Q1 is answered. Version 1 before this milestone: payment link per tier and manual tier change in the Members tab.

### M8. Release

| Task | Work |
| :--- | :--- |
| M8-1 | Full QA: light and dark theme, UX writing rules from `instruction/INSTRUCTION.md`. |
| M8-2 | Help documentation as described in `instruction/Doc-Instruction.md`. |
| M8-3 | `npm run pack` and Framer Marketplace submission. |

---

## 4. Feature Guideline

Every feature follows the same rules. A feature that skips one is not done.

### 4.1. Status words

Use only these five words, in the tracker and in every development doc.

| Status | Meaning |
| :--- | :--- |
| Not started | No code. |
| Prototype | UI exists. Data is simulated. |
| In progress | Being connected to real data. |
| Done | Works with real data. Passes every item in 4.2. |
| Verified | Done, and tested on a published Framer site by a second person. |

Never write "Implemented" or "Verified" for a prototype.

### 4.2. Definition of Done

- [ ] Works against the real API. The mock mode still works too.
- [ ] Loading, empty, and error states exist and read as full sentences.
- [ ] `npm run check` passes (zero inline CSS, zero type errors, build succeeds).
- [ ] Logic has unit tests.
- [ ] Tested inside Framer in light and dark theme.
- [ ] Canvas components: tested on a published site, not only on the canvas.
- [ ] Property control names in code match the development doc.
- [ ] Development doc in `docs/development-docs/` updated in the same change.
- [ ] Tracker row updated.

### 4.3. Code rules

The full rules are in `.agent/rules/framer-sdd-standards.md`. The short version:

- No `style={{ }}` in JSX. CSS files in the plugin, CSS strings in canvas components.
- Primary buttons use `.primary-cta`.
- Lucide icons in the plugin. Inlined SVG in canvas components. No emoji.
- Plugin window is 360 by 640.
- Canvas components are one self-contained file each. They cannot import from `src/hooks` or `src/services`.
- Types come from `src/types/index.ts`. Do not redefine them in a component.
- Plugin network calls go through `apiClient`. No `fetch` in tabs.
- Tiers, members, and rules are never stored in `localStorage`. Only the member's session token is.
- The site key never appears in a canvas component or in the site script.

### 4.4. Development doc rules

- One doc per feature, named `NN-feature-slug.md`. Numbers follow the roster in `development-docs/README.md` and are never reused.
- Follow the template in `.agent/rules/feature-development-docs.md`.
- First lines state the status using a word from 4.1.
- Links are relative. Never `file:///d:/...`.
- Tick a checklist item only after doing the check.
