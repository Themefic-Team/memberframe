# MemberFrame Implementation Status

The task ledger. One row per numbered task in [`memberframe-complete-prd.md`](memberframe-complete-prd.md) section 15.

**Read this first in every session.** It is the single source of truth for what is done. The PRD says what to build; this says where we are.

Last updated: 2026-10-11

---

## How To Use This File

**Status values**: `todo`, `in progress`, `done`, `blocked`.

**The loop**, also in [`../CLAUDE.md`](../CLAUDE.md):

```
read the row -> read the PRD section -> write the development doc -> code
  -> npm run lint:css && npx tsc --noEmit && npm run build
  -> commit:  feat(F01): task 1.4 canvas code generator
  -> set status to done and paste the commit SHA into this file
```

**Rules for this file:**

- A row goes to `done` only when the gates passed and a commit exists. No SHA means not done.
- Never mark `done` on the strength of code being written. Written is not verified.
- Rows whose verification needs a human (rendered pixels, live gateways) stay `in progress` until that person signs section 7 of the feature's development doc.
- `git log --oneline | grep task` cross-checks this file. A `done` row with no matching commit is a defect in the record.

---

## Progress

| Phase | Scope | Tasks | Done |
| :--- | :--- | :--- | :--- |
| 0 | Scaffold from the clean slate | 12 | 5 |
| 1 | Foundation and core gating (weeks 1 to 2) | 16 | 0 |
| 2 | Global payments, paywalls, LMS (weeks 3 to 4) | 18 | 0 |
| 3 | B2B, CMS, member self-service (weeks 5 to 6) | 11 | 0 |
| 4 | Community, localization, packaging (weeks 7 to 8) | 15 | 0 |
| **Total** | | **72** | **5** |

69 tasks come from PRD section 15. Tasks 0.10 to 0.12 were added on 2026-10-11 and are marked `added` below.

---

## Phase 0: Scaffold From The Clean Slate

PRD section 15.2. Brings `src/` to a working shell without building any feature.

| # | Task | Output | Status | Commit |
| :--- | :--- | :--- | :--- | :--- |
| 0.1 | Fix the lint script path defect | `package.json` | done | |
| 0.2 | Copy the reference design tokens into the project | `src/styles/design-tokens.css` | todo | |
| 0.3 | Create `docs/development-docs/` | directory plus README index | done | |
| 0.4 | Build the four-part shell | `src/components/shell/*` | todo | |
| 0.5 | Build the shared UI kit | `src/components/ui/*` | todo | |
| 0.6 | Wire the theme hook | `src/hooks/useFramerTheme.ts` | todo | |
| 0.7 | Add the four empty tabs | `src/components/tabs/*` | todo | |
| 0.8 | Add the SDK mock | `src/utils/framerMock.ts` | todo | |
| 0.9 | Add the collapse toggle | `src/App.tsx` | todo | |
| 0.10 | Write `CLAUDE.md` so the rules load each session (added) | `CLAUDE.md` | done | |
| 0.11 | Write this ledger (added) | `docs/IMPLEMENTATION-STATUS.md` | done | |
| 0.12 | Create the five sub-agents in Claude Code format (added) | `.claude/agents/*.md` | done | |

**Exit criteria**: panel opens in Framer with zero console errors, all four tabs navigate, theme switches cleanly, `npm run lint:css` passes, `tsc --noEmit` passes, `npm run build` succeeds.

**Note on 0.8**: the SDK mock needs a test runner. `vitest` is not installed and there is no `test` script. PRD section 16 mandates the triad. Installing it is unscheduled: confirm before adding the dependency.

---

## Phase 1: Foundation And Core Gating

PRD section 15.4. **Goal**: a creator can configure a tier, gate a frame, and take a Stripe payment.

### Week 1

| # | Task | Feature | Files | Status | Commit |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1.1 | Build the Live Preview Studio with the five-state switcher | F04 | `components/studio/PreviewStudio.tsx`, `StateSwitcher.tsx` | todo | |
| 1.2 | Build the simulated session context | F04 | `hooks/useMemberSession.ts` | todo | |
| 1.3 | Build the Builder tab customizer using `.field-row` | F01, F04 | `components/tabs/BuilderTab.tsx` | todo | |
| 1.4 | Build the canvas code generator service | F01 | `services/canvasComponentCodeGenerator.ts` | todo | |
| 1.5 | Build the Framer canvas service wrapper | F01 | `services/framerCanvasService.ts` | todo | |
| 1.6 | Declare the first `framer.json` permissions | F01 | `createCodeFile`, `CodeFile.setFileContent`, `addComponentInstance`, `setParent` | todo | |
| 1.7 | Author `<MemberGate>` with all seven property controls | F01 | `canvas-components/MemberGate.tsx` | todo | |
| 1.8 | Implement the shared `isEntitled` resolver | F01 | `utils/entitlement.ts` | todo | |

### Week 2

| # | Task | Feature | Files | Status | Commit |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 2.1 | Build the API client with the five-case error contract | All | `services/apiClient.ts`, `config/backend.ts` | blocked | |
| 2.2 | Build the Manage tab with the members and tiers segments | F02 | `components/tabs/ManageTab.tsx`, `manage/*` | todo | |
| 2.3 | Build the tier editor with rank uniqueness validation | F02 | `components/manage/TierEditor.tsx` | todo | |
| 2.4 | Build the Settings tab with the gateway key vault | F03 | `components/tabs/SettingsTab.tsx` | todo | |
| 2.5 | Author `<MemberAuth>` with OTP and Google SSO | F05 | `canvas-components/MemberAuth.tsx` | todo | |
| 2.6 | Wire Stripe checkout session creation | F03 | `services/checkoutService.ts` | todo | |
| 2.7 | Build the Home tab with the hero card and quick start | F02 | `components/tabs/HomeTab.tsx` | todo | |
| 2.8 | Write development docs for F01 through F05 | Rule | `docs/development-docs/01` to `05-*.md` | todo | |

**2.1 is blocked**: the backend does not exist. PRD section 10 defines the contract and marks it out-of-repo. Every task downstream of the API client inherits this block. Decide who builds the API before Phase 1 starts.

**Exit criteria**: a creator creates a tier, gates a frame with `<MemberGate>`, a visitor signs in by OTP, pays through Stripe, and the gate unlocks on the published site. Linter and typecheck pass. Five development docs exist.

---

## Phase 2: Global Payments, Paywalls, And LMS

PRD section 15.5. **Goal**: all three gateways live, metering and SEO shipped, licensing and telemetry in place.

### Week 3

| # | Task | Feature | Files | Status | Commit |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 3.1 | Integrate Lemon Squeezy routing and key validation | F03 | `services/checkoutService.ts`, Settings vault | todo | |
| 3.2 | Integrate Razorpay with UPI, including the INR currency path | F03 | `services/checkoutService.ts` | todo | |
| 3.3 | Implement geolocation routing with a manual override | F03 | `services/gatewayRouter.ts` | todo | |
| 3.4 | Author `<MeteredPaywall>` with the counter pill | F07 | `canvas-components/MeteredPaywall.tsx` | todo | |
| 3.5 | Build encrypted client-side read tracking | F07 | `utils/meteredStorage.ts` | todo | |
| 3.6 | Build the Schema.org JSON-LD injector | F08 | `utils/schemaInjector.ts` | todo | |
| 3.7 | Implement the grace period banner and `past_due` handling | F18 | `canvas-components/shared/GraceBanner.tsx` | todo | |

### Week 4

| # | Task | Feature | Files | Status | Commit |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 4.1 | Author the LMS trio | F11 | `CourseProgress.tsx`, `LessonChecklist.tsx`, `VideoProgressListener.tsx` | todo | |
| 4.2 | Add origin-validated `postMessage` handlers for all three players | F11 | `utils/playerBridge.ts` | todo | |
| 4.3 | Implement the Pro-Lock engine and `enforceLockState` | F19 | `hooks/useProLock.ts`, `utils/lockPatcher.ts` | todo | |
| 4.4 | Implement the trial ticker banner and eligibility flow | F19 | `components/account/TrialBanner.tsx` | todo | |
| 4.5 | Implement the 1-instance limit and duplicate protection | F19 | `services/instanceGuard.ts` | todo | |
| 4.6 | Implement the trial watermark in every canvas component | F19 | all canvas components | todo | |
| 4.7 | Build the account sheet with checkout for the three plans | F19 | `components/account/AccountSheet.tsx` | todo | |
| 4.8 | Implement telemetry sync with the mode guardrail | F20 | `hooks/useSiteTelemetry.ts` | todo | |
| 4.9 | Implement 2kB differential compression | F20 | `utils/compression.ts`, `services/storageService.ts` | todo | |
| 4.10 | Implement bot defense on the auth surface | F21 | `canvas-components/MemberAuth.tsx`, Settings | todo | |
| 4.11 | Write development docs for F07, F08, F11, F18 to F21 | Rule | `docs/development-docs/*` | todo | |

**Exit criteria**: a buyer in India completes UPI checkout. The meter blocks at article 4. JSON-LD validates in Google's Rich Results Test. The trial counts down, the watermark appears, the 1-instance limit blocks a second insert, and purchasing removes the watermark from existing canvas components.

---

## Phase 3: B2B, CMS, And Member Self-Service

PRD section 15.6.

### Week 5

| # | Task | Feature | Files | Status | Commit |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 5.1 | Author `<MemberDashboard>` with billing portal integration | F06 | `canvas-components/MemberDashboard.tsx` | todo | |
| 5.2 | Implement invoice listing with cross-member access protection | F06 | Dashboard billing tab | todo | |
| 5.3 | Author `<CMSGatedTemplate>` with boolean and enum bindings | F09 | `canvas-components/CMSGatedTemplate.tsx` | todo | |
| 5.4 | Verify CMS gating on a 300-item collection with no per-item call | F09 | verification task | todo | |
| 5.5 | Author `<ProtectedDownload>` with signed URL handling | F10 | `canvas-components/ProtectedDownload.tsx` | todo | |
| 5.6 | Declare the remaining `framer.json` permissions | All | `CodeFile.remove`, `Node.remove`, `setPluginData`, `getPluginData` | todo | |

### Week 6

| # | Task | Feature | Files | Status | Commit |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 6.1 | Author `<TeamManagement>` embedded in the dashboard | F12 | `canvas-components/TeamManagement.tsx` | todo | |
| 6.2 | Implement seat allocation, invites, and revocation limits | F12 | `services/orgService.ts` | todo | |
| 6.3 | Author `<OnboardingModal>` with conditional steps | F16 | `canvas-components/OnboardingModal.tsx` | todo | |
| 6.4 | Implement shared password gating mode | F22 | `MemberGate.tsx`, Settings | todo | |
| 6.5 | Write development docs for F06, F09, F10, F12, F16, F22 | Rule | `docs/development-docs/*` | todo | |

**Exit criteria**: a member updates their card and downloads an invoice from the site. A mixed CMS collection gates correctly per item. A signed download URL dies at 61 seconds. A team owner invites and revokes seats within their allocation.

---

## Phase 4: Community, Localization, And Packaging

PRD section 15.7.

### Week 7

| # | Task | Feature | Files | Status | Commit |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 7.1 | Author `<BookmarkButton>` and `<BookmarksTray>` | F14 | `canvas-components/Bookmark*.tsx` | todo | |
| 7.2 | Author `<MemberDirectory>` with opt-in enforcement | F15 | `canvas-components/MemberDirectory.tsx` | todo | |
| 7.3 | Author `<DonationSlider>` with server-side amount validation | F13 | `canvas-components/DonationSlider.tsx` | todo | |
| 7.4 | Author `<MemberAnnouncementBar>` | F17 | `canvas-components/MemberAnnouncementBar.tsx` | todo | |
| 7.5 | Externalize every component string into locale maps | F23 | `locales/*.json` | todo | |
| 7.6 | Finalize agency pooled licensing across multiple sites | F19 | `hooks/useProLock.ts` | todo | |

### Week 8

| # | Task | Output | Status | Commit |
| :--- | :--- | :--- | :--- | :--- |
| 8.1 | Run the full TDD triad across all three layers | green test suite | todo | |
| 8.2 | Light and dark contrast audit on all 16 components | WCAG AA evidence | todo | |
| 8.3 | Zero-inline-CSS lint on `src` with zero violations | clean lint | todo | |
| 8.4 | Keyboard and screen reader pass on every modal and form | a11y sign-off | todo | |
| 8.5 | Cross-site and cross-member access penetration checks | security sign-off | todo | |
| 8.6 | Write the help docs and highlighted features | `docs/help/`, `docs/highlighted-features/` | todo | |
| 8.7 | Complete development docs for every remaining feature | 24 files total | todo | |
| 8.8 | `tsc --noEmit`, `vite build`, then `npm run pack` | `plugin.zip` | todo | |
| 8.9 | Marketplace listing copy, screenshots, and demo video | submission package | todo | |

**Exit criteria**: `npm run pack` produces a valid bundle, every checklist in PRD section 16 passes, and the listing is submitted.

**Note on 8.8**: there is no `pack` script in `package.json`. It must be added before this task can run.

---

## Tasks Needing Human Verification

The agent cannot check these. Assign an owner before the phase they fall in.

| Task | Why the agent cannot verify it |
| :--- | :--- |
| 0.4 to 0.7, 0.9 | Rendered panel in the Framer desktop app. The dev server is HTTPS with a self-signed cert |
| 2.6, 3.1, 3.2 | Live gateway sandbox transactions and webhook delivery |
| 3.6 | Google Rich Results Test |
| 4.2 | Real YouTube, Vimeo, and Mux player `postMessage` traffic |
| 8.2, 8.4 | Visual contrast and screen reader passes |
| 8.5 | Penetration testing against a running backend |
| 8.9 | Screenshots and demo video |

---

## Blockers

| # | Blocker | Blocks | Needed from |
| :--- | :--- | :--- | :--- |
| B1 | The backend API does not exist. PRD section 10 marks it out-of-repo | 2.1 and everything downstream, which is most of Phases 1 to 4 | A decision on who builds it |
| B2 | Member caps per tier are unspecified | Phase 1 data model, PRD section 11 | Product decision, PRD section 18 |
| B3 | Creator-lapse policy for their paying subscribers is unspecified | Phase 1 data model | Product decision, PRD section 18 |
| B4 | GDPR controller and processor split is unspecified | Phase 1 data model | Legal and product decision, PRD section 18 |
| B5 | No test runner installed | 0.8, 8.1 | Approval to add `vitest` |
| B6 | No `pack` script | 8.8 | Scheduling, small task |

B2 to B4 change the schema. Settling them after Phase 1 means reworking it.
