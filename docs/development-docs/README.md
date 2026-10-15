# MemberFrame Development Docs Index

Per-feature technical development documentation, mandated by [`.agents/rules/feature-development-docs.md`](../../.agents/rules/feature-development-docs.md).

**The rule is absolute**: never build a feature without producing its development doc in the same step. Copy [`_TEMPLATE.md`](_TEMPLATE.md) to start a new one.

Each file is the engineering record for one feature. The authoritative product specification lives in [`docs/memberframe-complete-prd.md`](../memberframe-complete-prd.md) section 8. These docs record how it was actually built: real file paths, real property controls, real data contracts, and a ticked verification checklist.

---

## How This Fits The Workflow

```
PRD section 8 (what to build)
   -> development-docs/NN-slug.md  (how it was built, written BEFORE the code)
   -> source files
   -> three gates: lint:css, tsc --noEmit, build
   -> commit referencing the task ID
   -> tick the row in ../IMPLEMENTATION-STATUS.md
```

Writing the doc before the code is deliberate. It forces the property controls, data contract, and acceptance criteria to be settled while they are still cheap to change.

---

## Feature Doc Status

Status values: `planned`, `in progress`, `done`.

| Doc | Feature | PRD | Phase | Priority | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `00-plugin-shell.md` | Plugin Shell, UI Kit, and Theme Sync | section 7, no F number | 0 | P0 | in progress |
| `00-test-harness.md` | Test Harness and Framer SDK Mock | section 16.1, no F number | 0 | P0 | in progress |
| `00-api-client.md` | Backend API Client | sections 10.1 and 10.6, no F number | 1 | P0 | in progress |
| `00-member-data-model.md` | Member Data Model, And Why Not The CMS | sections 10, 11, 14.1, no F number | 1 | P0 | in progress |
| `01-member-gate.md` | Zero-Code Visual Canvas Gating | F01 | 1 | P0 | in progress |
| `02-member-tier-cockpit.md` | In-Plugin Member and Tier Cockpit | F02 | 1 | P0 | in progress |
| `03-tri-gateway-payments.md` | Tri-Gateway Smart Payment Connect | F03 | 1 and 2 | P0 | in progress |
| `04-live-preview-studio.md` | Live Preview Studio with State Simulator | F04 | 1 | P0 | in progress |
| `05-member-auth.md` | Multi-Provider Auth, Passwordless OTP, and Email Password | F05, feature plan FP-02 | 1 | P0 | in progress |
| `06-connect-and-pages.md` | Connect Handshake and Automatic Page Scaffolding | FP-01, FP-02 | 1 | P0 | in progress |
| `07-panel-restructure-plan.md` | Panel Restructuring: Cockpit, Studio, Settings & Vault | Architectural Restructure | 1 | P0 | in progress |
| `08-google-oauth-setup.md` | Google OAuth Sign-In Setup and Runtime Architecture | F05, OAuth 2.0 | 1 | P0 | done |
| `09-github-oauth-setup.md` | GitHub OAuth Sign-In Setup and Runtime Architecture | F05, OAuth 2.0 | 1 | P0 | done |
| `10-apple-signin-setup.md` | Apple Sign-In Setup and Runtime Architecture | F05, OAuth 2.0 | 1 | P0 | done |
| `11-discord-oauth-setup.md` | Discord OAuth Sign-In Setup and Runtime Architecture | F05, OAuth 2.0 | 1 | P0 | done |
| `06-member-dashboard.md` | Canvas-Native Member Billing Portal | F06 | 3 | P0 | planned |
| `07-metered-paywall.md` | Dynamic Metered Soft Paywall | F07 | 2 | P1 | planned |
| `08-schema-injection.md` | SEO-Preserving Schema.org Injection | F08 | 2 | P1 | planned |
| `09-cms-gated-template.md` | Framer CMS Item-Level Gating | F09 | 3 | P1 | planned |
| `10-protected-download.md` | Expiring Secure Asset Vault | F10 | 3 | P1 | planned |
| `11-creator-lms-suite.md` | Creator LMS Suite | F11 | 2 | P1 | planned |
| `12-team-management.md` | B2B Team Accounts and Seat Invites | F12 | 3 | P2 | planned |
| `13-donation-slider.md` | Pay-What-You-Want Donation Slider | F13 | 4 | P1 | planned |
| `14-member-bookmarks.md` | Member Bookmarks and Saved Tray | F14 | 4 | P2 | planned |
| `15-member-directory.md` | Member Directory with Tier Badges | F15 | 4 | P2 | planned |
| `16-onboarding-modal.md` | Custom Profile Fields and Progressive Onboarding | F16, feature plan FP-09 | 3 | P2 | in progress |
| `17-announcement-bar.md` | Targeted Member Announcement Bar | F17 | 4 | P2 | planned |
| `18-grace-and-dunning.md` | Grace Period and Automated Dunning | F18 | 2 | P1 | planned |
| `19-pro-lock-and-trial.md` | Client Pro-Lock and Trial Licensing | F19 | 2 | P0 | planned |
| `20-site-telemetry.md` | Framer Site Telemetry Sync | F20 | 2 | P0 | planned |
| `21-bot-defense.md` | Bot Defense on Auth Endpoints | F21 | 2 | P1 | planned |
| `22-shared-password.md` | Shared Password Access | F22 | 3 | P2 | planned |
| `23-localization.md` | Multi-Language Localization | F23 | 4 | P2 | planned |
| `24-outbound-webhooks.md` | Outbound Webhooks and Zapier Events | F24 | 4 | P3 | planned |

24 features, 24 docs, plus three `00-` infrastructure docs that have no F number: the shell, the test harness, and the API client.

PRD task 8.7 requires all 24 feature docs complete before packaging.

**Task 2.8, development docs for F01 through F05, is met.** All five exist and all five are `in progress` rather than `done`, which is accurate: every one of them carries an unticked human verification table, because nothing in Phase 1 has been seen rendered in Framer or spoken to a backend.

---

## Scheduled Writing Tasks

The PRD batches doc writing so it never lags more than one phase behind the code:

| Task | Covers | Due |
| :--- | :--- | :--- |
| 2.8 | F01 to F05 | End of Phase 1 |
| 4.11 | F07, F08, F11, F18 to F21 | End of Phase 2 |
| 6.5 | F06, F09, F10, F12, F16, F22 | End of Phase 3 |
| 8.7 | F13, F14, F15, F17, F23, F24 and any gaps | End of Phase 4 |

Those are the deadlines, not the intent. Write each doc when you build the feature.

---

## Companion Docs Not In This Directory

Required by [`instruction/Doc-Instruction.md`](../../instruction/Doc-Instruction.md) and tracked as PRD task 8.6. These are user-facing, not engineering records:

- `docs/help/` plain-language setup and troubleshooting guides
- `docs/highlighted-features/` marketplace and landing page feature copy
