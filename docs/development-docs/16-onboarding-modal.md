# Feature: Custom Profile Fields and Progressive Onboarding

Technical development specification, user flow, architectural wiring, and testing checklist for custom member profile fields and the `<OnboardingModal>` that collects them.

**PRD reference**: [F16](../memberframe-complete-prd.md) section 8, component row 14 in section 9.2
**Feature plan**: [FP-09](../features-plan/9.%20Custom%20Profile%20Field.md)
**Status**: in progress
**Tasks**: 6.3, and FP-09 in the feature plan track (see [`../IMPLEMENTATION-STATUS.md`](../IMPLEMENTATION-STATUS.md))

> **Onboarding Modal removed (2026-10-18):** at the product owner's request, `<OnboardingModal>` is gone: its canvas component (`OnboardingModal.tsx`), Builder entry, generator descriptor, config type, and the onboarding-only helpers `needsOnboarding` and `planSteps` with their tests. Profile fields stay: creators define them in Settings, Fields, members answer them in the Member Dashboard's Profile Form, and creators read them in the Manage flyout. Nothing on the server changed. A project that added the modal keeps its `OnboardingModal` file, which the plugin no longer updates; delete the instance from the page and the file from Assets. Sections below that describe the modal are history.
>
> **Appearance and sizing (2026-10-15):** Theme (Light by default), Colors, Typography, Layout, and Labels controls, fixed default size, and the shared colour sanitizer are documented once in [`00-canvas-appearance.md`](00-canvas-appearance.md). Redeploy from the Builder to update an existing file.

---

## 1. Overview and Problem Solved

- **Feature Name**: Custom Profile Fields, with the Progressive Onboarding Questionnaire
- **Target Audience**: Framer Creator (defines the fields), Site Member (answers them)
- **Value Proposition**: A design community needs a portfolio link, a coaching club needs a company and a team size. FrameAuth, Thenty, and Outseta all ship custom member fields, and all of them put every field on the sign-up form, which is where members drop off. MemberFrame keeps sign-in to one step and asks afterwards: required questions in a short modal, everything else on the member's own dashboard whenever they like.
- **Priority Tier**: P2, Creator Enhancement

---

## 2. User Flows

### 2.1. In-Plugin Configuration Flow (Framer Designer)

1. **Settings, Fields.** A fourth segment beside Config, Page Locks, and Integration. Empty, it shows one action: Add field.
2. **Add field.** A card opens with Label, Key, Type, Required, and Placeholder. The key is derived from the label as the creator types ("Portfolio URL" becomes `portfolio_url`) and stays editable until the first save.
3. **Type.** Short text, Long text, Web address, Phone number, Dropdown, Checkbox, Number. A dropdown shows an options list with one row per option. A required checkbox is explained as "must be ticked, like accepting terms".
4. **Show when.** Offered on any field below an unconditional dropdown or checkbox. One select lists every usable answer: "Role is Agency", "Newsletter is on". Choosing one makes the field conditional.
5. **Reorder and remove.** Up, down, and remove on every card. A move that would put a conditional field above its parent is refused. Removing a parent makes its dependants always shown rather than deleting them.
6. **Save fields.** The view's one `.primary-cta`. Disabled until something changed, and disabled with a reason while any card has a problem. Each problem is inline under its control, and a closed card with a problem says "needs a fix" in its summary line.
7. **After the first save the key locks**, with the reason on screen: members' answers are stored under it.
8. **Builder, Onboarding Modal, Add to canvas.** Deploys `<OnboardingModal>`. The creator places it once, on the page members land on after sign-in or in a shared layout.
9. **Manage, a member's row.** The flyout now shows a Profile section with every visible field and the member's answer, "Not answered" where there is none, and web addresses as links.

### 2.2. Visitor / Member Runtime Flow

1. A visitor signs in through `<MemberAuth>`. Nothing about sign-in changes.
2. On a page holding `<OnboardingModal>`, the component calls `GET /api/member/profile`. A 401, any error, or a member with every visible required field answered renders nothing at all.
3. Otherwise the modal opens over the page, focus moves to its heading, page scroll locks, and Tab cycles inside it.
4. **Step 1, welcome.** The creator's title and message, and an optional name field.
5. **Step 2, about you.** Every required field, plus any conditional field whose parent is required. Continue is refused with an inline error under each empty or invalid field. There is no skip.
6. **Step 3, a little more.** The optional fields. "Skip for now" submits without any of them.
7. The step line reads "Step 2 of 3" and is a polite live region, so a screen reader announces each step.
8. **Conditional fields** appear and disappear as the parent answer changes. A hidden field is neither checked nor sent.
9. **A reload mid-flow** reopens on the same step with the same answers, from a `sessionStorage` draft keyed by site and member.
10. **Finish** sends `PATCH /api/member/profile`. On success the draft is cleared, the modal closes, a `memberframe:profile-updated` event fires, and the member goes to `completionRedirect` if one is set. On a 400 the modal returns to the step holding the first problem and shows the server's message under the field.
11. **`<MemberDashboard>`** shows a Profile form below the account rows: name plus every visible field, prefilled, with Save profile. It reloads itself when the modal on the same page saves.

---

## 3. Architecture and File Inventory

- **Shared rules**: [`src/utils/customFields.ts`](../../src/utils/customFields.ts). Types, the value validator, visibility, the condition rule, editor helpers, step planning.
- **Plugin UI Components**:
  - [`src/components/settings/CustomFieldsPanel.tsx`](../../src/components/settings/CustomFieldsPanel.tsx), the field editor
  - [`src/components/tabs/SettingsTab.tsx`](../../src/components/tabs/SettingsTab.tsx), the Fields segment, draft state, and save
  - [`src/components/manage/MemberFlyout.tsx`](../../src/components/manage/MemberFlyout.tsx), the Profile section, threaded through `MembersTable` and `ManageTab`
  - [`src/components/studio/componentRegistry.ts`](../../src/components/studio/componentRegistry.ts) and [`BuilderTab.tsx`](../../src/components/tabs/BuilderTab.tsx), the picker entry and deploy branch
- **Canvas Code Components**:
  - [`src/canvas-components/OnboardingModal.tsx`](../../src/canvas-components/OnboardingModal.tsx), new
  - [`src/canvas-components/MemberDashboard.tsx`](../../src/canvas-components/MemberDashboard.tsx), the profile form
- **Generator**: `ONBOARDING_MODAL_DESCRIPTOR` and `normalizeOnboardingConfig` in [`canvasComponentCodeGenerator.ts`](../../src/services/canvasComponentCodeGenerator.ts); `showProfile` added to the dashboard's.
- **Backend API Endpoints**, in the sibling `memberframe-backend` repository:
  - `GET /api/member/profile` and `PATCH /api/member/profile`, which existed and now return `showWhen`
  - `PUT /api/site/settings`, which validates `customFields` including conditions
  - `GET /api/site/members` and `PATCH /api/site/members/:id`, which now return `metadata`
  - `lib/memberMetadata.ts`: `isFieldVisible`, and `applyMetadata` now drops hidden fields
  - `lib/siteSettings.ts`: `FieldCondition`, `conditionProblem`, parse, salvage, and store of `showWhen`
- **Styling**: `src/styles/settings.css` (`.custom-field-*`), `src/styles/manage.css` (`.member-profile-*`), tokens only. Canvas styling in each component's `cssContent`.

### 3.1. Four Copies of the Rules, and What Holds Them Together

A canvas component cannot import from this repository, so the value rules exist four times: server, plugin, dashboard, modal. The server is the rule. The others are hints that must agree with it, because a form that accepts what the server refuses shows a member an error about a field they filled in correctly.

| Pair | Compared by |
| :--- | :--- |
| Server and plugin: `isSafeUrl`, `isPhoneLike`, `checkValue`, `isFieldVisible`, `conditionProblem`, `isValidFieldKey`, five bounds | `memberframe-backend/test/parity.test.ts` |
| Plugin and both canvas components: the first four plus `toSubmittedValue`, `validateProfile`, three bounds; and `needsOnboarding`, `planSteps` for the modal | `test/customFieldsParity.test.ts` |

Both were proved able to fail by perturbation: one changed character in the dashboard's `isPhoneLike`, and one in the plugin's `conditionProblem`, each failed its test and was restored byte for byte.

The existing parity extractor would have compared `checkValue` vacuously. It counts braces from the first `{` after the function name, and `checkValue` returns `{ value } | { problem }`, so it would have extracted the signature and stopped. The new extractors match the parameter list and take the first brace that ends a line. A test asserts the extract reaches a rule deep in the body.

### 3.2. Decisions Made While Building

1. **Fields segment in Settings, not Manage.** FP-09 says "Manage, Custom Fields" in one place and "Settings, Custom Fields" in another. The definitions live in the settings document and save through the same versioned write as every other setting, so Settings. Manage keeps its two segments.
2. **The key locks after the first save.** Renaming a key orphans every stored answer, and the server drops orphaned values on the member's next save. Editable while new, locked once saved, label editable forever.
3. **One card open at a time.** At 360px an expanded list of eight fields is not something a creator can hold in their head.
4. **Conditions are one level deep.** The parent is an earlier, unconditional dropdown or checkbox. A chain is a questionnaire engine and produces fields that appear and vanish as a member goes back.
5. **A hidden field's value is dropped by the server**, and its `required` is not enforced. A freelancer with a stored team size would be shown to the creator as both.
6. **Steps follow the parent.** A conditional field joins its parent's step whatever its own required flag says. Placed earlier, it could never be shown, because the answer that shows it has not been asked.
7. **The modal opens only for a missing required answer.** FP-09's flow chart sends members with nothing required straight in. A creator with only optional fields never puts a modal in front of anyone.
8. **Escape does nothing in the modal.** It opens only because a required answer is missing. The optional step has its own skip, so nobody is trapped behind an optional question.
9. **The dashboard's profile is a separate request with its own state.** A profile failure leaves email, tier, and status on screen with one line saying the profile could not load.
10. **Avatar upload is not built.** FP-09 step 1 asks for one, and there is no upload endpoint or storage. Step 1 asks for a name only.
11. **Number fields have no min or max.** FP-09 section 2 mentions bounds and its section 4.1 schema has nowhere to store them. Adding them is a schema change on both sides and was not made silently.

### 3.3. Conflicts

| # | Conflict | Resolved as |
| :-- | :--- | :--- |
| C31 | FP-09's flow chart branches ("Agency selected, show Team Size") and section 5 tests conditional fields, but the section 4.1 schema has no field that can express a condition | Added `showWhen: { key, value } \| null` to the definition on both sides, optional so every stored document reads back unchanged. The server validates it on write, salvages it on read, and applies it in `applyMetadata` |
| C32 | PRD section 9.2 lists a `steps` property control on `<OnboardingModal>`. The questions are the profile fields, defined in Settings and read at runtime | `steps` is not a control. A second list of questions in Framer's sidebar could only disagree with the first. Steps are derived from the fields. Same reasoning as C30 for the gate |

---

## 4. Framer Property Controls Specification

### 4.1. `<OnboardingModal>`

| Control Title | Control Type | Default Value | Description |
| :--- | :--- | :--- | :--- |
| Welcome title | `ControlType.String` | `Welcome aboard` | Heading of step 1 |
| Welcome text | `ControlType.String` | `A few quick questions help us tailor the site to you.` | Body of step 1 |
| Step indicator | `ControlType.Boolean` | `true` | Shows "Step N of M" and the progress bar |
| Allow skip | `ControlType.Boolean` | `true` | "Skip for now" on the optional step. Required fields are never skippable |
| After finish | `ControlType.String` | empty | Site-relative path to go to on completion. Anything else is dropped by the generator and ignored at runtime |
| Accent | `ControlType.Color` | `#5271ff` | Sanitized before reaching the style block |
| Corner radius | `ControlType.Number` | `12` | 0 to 32 px |

`apiBaseUrl` and `siteKey` are baked in by the generator and not exposed. `displayTextArea` and `placeholder` were tried and removed: the repository's hand-written `framer` shim does not declare them, and widening a shim nothing can verify was not worth two cosmetic options.

### 4.2. `<MemberDashboard>`, Added

| Control Title | Control Type | Default Value | Description |
| :--- | :--- | :--- | :--- |
| Profile form | `ControlType.Boolean` | `true` | The editable name and custom fields |

---

## 5. Data Contracts and Core User Schema

```typescript
// Settings document, customFields[]. Replaced wholesale on save.
interface CustomFieldDefinition {
  key: string;            // ^[a-z][a-z0-9_]{0,48}$, not __proto__ / constructor / prototype
  label: string;          // 1 to 120 characters
  type: "text" | "textarea" | "url" | "phone" | "select" | "boolean" | "number";
  required: boolean;      // for "boolean": must be ticked
  options: string[];      // "select" only, 1 to 50
  placeholder: string;
  order: number;          // position; the editor writes 0..n-1
  showWhen?: { key: string; value: string } | null;  // C31; "true"/"false" for a checkbox parent
}

// Member.metadata, a JSON column. Only keys with a definition whose condition is met.
type MemberMetadata = Record<string, string | number | boolean | null>;

// GET /api/member/profile
//   200 { member, tiers, fields: Omit<CustomFieldDefinition, "order">[], metadata }
//   401 when signed out
// PATCH /api/member/profile   body { name?: string | null, metadata?: Record<string, unknown> }
//   200 { member, fields, metadata }
//   400 { reason: "invalid_profile", problems: [{ key, message }] }
// GET /api/site/members       each member now carries `metadata`

// The modal's draft, sessionStorage["memberframe:onboarding:<siteKey>:<memberId>"]
interface Draft { step: number; name: string; values: MemberMetadata }
```

Bounds: short text 255, long text 2000, web address 2048, http and https only. Phone: an optional plus, a digit, then 5 to 24 digits, spaces, dashes, dots, or parentheses. **That pattern refuses "(415) 555-0123"**, the common US form, because it must open with a digit. It is the server's rule and is pinned by a test rather than changed here. Loosening it is a product call and a server change first.

---

## 6. Verification and Testing Checklist

- [ ] Light mode and dark mode color contrast verified with `data-framer-theme`. **Needs a human.**
- [x] Zero inline CSS compliance verified (`npm run lint:css`, 85 files).
- [ ] Framer Property Controls render cleanly in canvas sidebar. **Needs a human.**
- [ ] Backend API endpoints return proper status codes and handle network errors gracefully. Handled in code for 200, 400, 401, and network failure; **never run against a server.**
- [x] Exactly one `.primary-cta` in the Fields view. The canvas components follow the existing components' own button styles.
- [x] Lucide icons only, `stroke="currentColor"`, zero emoji.
- [ ] PRD F16 acceptance criteria. Logic proved; behaviour needs a browser:
  - Partial progress survives a reload: the draft code exists and is pinned by test; the reload itself is unobserved.
  - A skipped optional step does not block completion: skip sends no optional keys, and the server enforces only what is sent.
  - Conditional fields appear and hide: `isFieldVisible` tested both ways in plugin and server.
  - Collected metadata appears in the Manage tab: the flyout renders it; the endpoint change is unexercised.
  - Step announced as "Step 2 of 4": the live region and its text are pinned by test; no screen reader has heard it.
- [x] `tsc --noEmit` and `npm run build` pass. Build warns that the bundle passed 500 kB, see section 7.

Automated coverage:

| File | Tests | What it proves |
| :--- | :--- | :--- |
| `test/customFields.test.ts` | 43 | FP-09 section 5's four items, the editor rules, step planning, display text |
| `test/customFieldsParity.test.ts` | 23 | Plugin and both canvas copies identical, and the comparison can fail |
| `test/onboardingModal.test.ts` | 23 | Standalone imports, storage confined to the draft helpers, lock lines, accessibility hooks, generator output parses and matches the config interface, unsafe redirect and colour dropped |
| `memberframe-backend/test/memberMetadata.test.ts` | 9 added | Hidden fields neither enforced nor stored, parent settled first, UTF-8 intact |
| `memberframe-backend/test/siteSettings.test.ts` | 7 added | Conditions validated with the field named, stored, salvaged, malformed ones dropped |
| `memberframe-backend/test/parity.test.ts` | 12 added | Server and plugin rules identical |

---

## 7. Verified By Whom

| Check | Verified by | Date | Evidence |
| :--- | :--- | :--- | :--- |
| Automated gates, frontend | agent | 2026-10-15 | lint:css 85 files, `tsc --noEmit` clean, 621 tests, build succeeds |
| Automated gates, backend | agent | 2026-10-15 | `tsc --noEmit` clean, 179 tests |
| Parity tests able to fail | agent | 2026-10-15 | One-character perturbation in each repo failed, files restored and compared byte for byte |
| Fields editor renders at 360px, both themes | | | |
| Saving fields against a real backend, including a refused condition | | | |
| Modal opens only with a required answer missing, and never for a signed-out visitor | | | |
| Reload mid-flow resumes the same step | | | |
| Focus trap, heading focus on step change, "Step 2 of 3" announced | | | |
| Dashboard profile save, server problem shown under its field | | | |
| Manage flyout shows answers, links open | | | |
| `Member.metadata` round trips UTF-8 through MySQL | | | |
| Bundle size: the build now warns at 539.74 kB, over Vite's 500 kB line. The two components' raw source adds about 69 kB | | | Decide whether to split |
