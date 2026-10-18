# Feature: Zero-Code Visual Canvas Gating and Page Locking

> **Removed 2026-10-17.** The `<MemberGate>` component, its generator, preview, and tests were deleted. Whole pages are locked by Page Locks and sections by Section Locks, both enforced by the Route Shield: see [19-section-locks.md](19-section-locks.md). This document is kept as history only; nothing below describes current code.

Technical development specification, user flow, architectural wiring, and testing checklist for `<MemberGate>`, the component that gates Framer frames without code overrides, along with full page route locking and seamless session lifecycle integration.

**PRD Reference**: F01, F04, F05, F06  
**Status**: Completed  
**Feature Plan**: `docs/features-plan/1. Lock Pages & On-Page Content.md`  

> **Appearance and sizing (2026-10-15):** Theme (Light by default), Colors, Typography, Layout, and Labels controls, fixed default size, and the shared colour sanitizer are documented once in [`00-canvas-appearance.md`](00-canvas-appearance.md). Redeploy from the Builder to update an existing file.

---

## 1. Overview and Problem Solved

- **Feature Name**: Zero-Code Visual Canvas Gating and Page Locking
- **Target Audience**: Framer Creators (to configure in-plugin), Site Visitors and Authenticated Members (at runtime)
- **Value Proposition**: 
  1. **On-Page Content Gating**: A creator gates any video lesson, resource stack, or whole section by dropping `<MemberGate>` onto the canvas and connecting a frame to its `contentSlot` (`ControlType.ComponentInstance`). No code overrides are required.
  2. **Page-Level Route Locking**: Creators can protect entire routes (such as `/dashboard` and `/private-content`) from the in-plugin **Page Locks** panel or by deploying redirect gates.
  3. **Seamless Auth and Session State Lifecycle**:
     - Logged-out visitors cannot view protected content or gated pages (rendered with Frosted Blur, Lock Card, or redirected).
     - Once signed in, all gates dissolve in real time and reveal protected content.
     - **Login Auto-Redirect**: If an already authenticated member visits the login page (`/login`), they never see the login form; they are immediately redirected to `/dashboard`.
     - **Clean Sign Out**: Signing out invalidates the session, broadcasts real-time state invalidation, re-gates content immediately, and navigates to the home page.
- **Priority Tier**: P0: Core MVP

---

## 2. User Flows

### 2.1. In-Plugin Configuration Flow (Framer Creator)

1. **On-Page Content Locking (Builder Tab)**:
   - Creator opens the **Builder** tab in the MemberFrame plugin.
   - Selects **Member Gate** in the component selector.
   - Observes the 5-state Live Preview Studio (`[Guest] [Free] [Silver] [VIP] [Failed]`).
   - Clicks **+ Add to canvas**. The plugin deploys and inserts `<MemberGate>` onto the active page.
   - In Framer's native properties panel, creator connects the target frame (section, video, article) to the **Protected Frame** slot (`contentSlot: ControlType.ComponentInstance`).
   - Selects the locked state treatment:
     - **Frosted Blur** (default): Keeps background visible with customizable CSS blur radius (2px to 20px) and a lock card overlay.
     - **Hide Completely**: Collapses the frame completely so it leaves zero empty space.
     - **Lock Card**: Displays an opaque "Members Only" card with a clickable "Sign in to unlock" action button.
     - **Page Redirect**: Immediately redirects unauthenticated visitors to the login path.

2. **Page-Level Protection Management (Settings Tab > Page Locks)**:
   - Creator opens the **Settings** tab and selects the **Page Locks** sub-tab.
   - **Dynamic Framer Canvas Page Discovery (`framerPagesService.ts`)**:
     - The plugin queries Framer canvas AST via `framer.getNodesWithType("WebPageNode")`.
     - Automatically extracts and normalizes all pages from the creator's Framer project (e.g. `Home (/)`, `Case Studies (/case-studies)`, `Experiments (/experiments)`, `About (/about)`, `Resume (/resume)`, `Login (/login)`).
   - **Page Selector Dropdowns**:
     - **Protected Path**: Creator selects any page from their Framer project directly from the dropdown. If they need a custom path not in the page list, selecting "Custom path..." displays an input field.
     - **Required Tier**: Configures minimum tier (`Any signed in`, `Free member`, `Tier 1: Silver`, `Tier 2: Gold`, `VIP member`).
     - **Locked Action**: Configures behavior when an unauthorized visitor opens the page:
       - `Redirect visitor away`: Forwards locked-out visitors before content renders.
       - `Frosted blur teaser`: Blurs content with an interactive unlock prompt.
       - `Members-only lock card`: Replaces page content with a locked card.
     - **Redirect Destination**: Dropdown of Framer project pages (defaulting to `/login`) or custom destination URL.
   - Creator clicks **Save page locks** (`.primary-cta`) to persist configuration into `SiteSettingsDocument.gatedPages`.
   - An in-plugin **On-Page Content Gating Guide** card is displayed with a direct one-click **+ Add Gate to Canvas** CTA.

### 2.2. Visitor and Member Runtime Flow

```
┌────────────────────────────────────────────────────────┐
│                   Visitor Lands on Site                │
└──────────────────────────┬─────────────────────────────┘
                           │
                 Is Visitor Authenticated?
                 (GET /api/member/session)
                /                         \
         No (Guest)                    Yes (Member)
        /                                  \
  Access Denied                      Access Granted
  • Locked Pages: Auto-redirect       • Page renders completely
    to /login                         • All <MemberGate> content
  • On-Page Content: Frosted blur,      slots dissolve immediately
    lock card, or hidden element      • Private sections revealed
        │                                  │
  Click "Sign in to unlock"           Member visits /login?
        │                             Auto-redirects to /dashboard!
  Complete Auth (<MemberAuth>)             │
        │                             Member clicks Sign Out?
  Dispatches session-updated event    • POST /api/member/logout
        │                             • Dispatches session-updated
  Gates instantly dissolve without    • All gates re-lock instantly
  requiring a full page reload        • Navigates to home (/)
```

1. **Page Load Evaluation**:
   - `<MemberGate>` mounts in its checking state (fails closed, renders locked state, never leaks unauthenticated content).
   - Module-scoped `loadSession()` checks `GET /api/member/session` with `credentials: "include"`.
   - Results are cached for 60 seconds at module scope so multiple gates on a single page make exactly one network call.
2. **Entitlement Resolution**:
   - `200 OK` with session resolves entitlement via `isEntitled()`.
   - When entitled, `<MemberGate>` renders the protected frame unmodified in the DOM.
   - If not entitled (`401`, `403`, network failure), the configured fallback is rendered.
3. **Interactive Sign-In Trigger**:
   - Clicking the "Sign in to unlock" CTA on the lock card emits `memberframe:open-auth` and navigates to the sign-in page (`CONFIG.loginPath`).
4. **Login Page Auto-Redirect**:
   - When an authenticated member visits `/login`, `<MemberAuth>` verifies session on mount.
   - Detecting an active session, it skips rendering the sign-in form and immediately calls `redirectAfterAuth()`, routing the member directly to `/dashboard`.
5. **Real-Time Dynamic Gating (No Reload Required)**:
   - When a member signs in, `<MemberAuth>` dispatches `memberframe:session-updated`.
   - `<MemberGate>` instances listen to this event, invalidate module cache (`cachedSession = null`), and re-evaluate entitlement. The locked treatment dissolves and reveals the content instantly.
6. **Sign Out Flow**:
   - When a member signs out via `<MemberDashboard>`, `POST /api/member/logout` revokes the session.
   - Dispatches `memberframe:session-updated` with `signedIn: false`.
   - All `<MemberGate>` components on the page re-lock immediately.
   - The browser navigates to `afterLogoutPath` (defaults to `/`).

---

## 3. Architecture and File Inventory

### 3.1. Files

| Path | Role |
| :--- | :--- |
| `src/canvas-components/MemberGate.tsx` | Authored canvas gate component deployed to creator project verbatim. Zero code overrides. |
| `src/canvas-components/MemberAuth.tsx` | Passwordless and password sign-in component with on-mount session check and auto-redirect. |
| `src/canvas-components/MemberDashboard.tsx` | Member account portal with working sign-out and session event broadcasting. |
| `src/components/settings/PageLocksPanel.tsx` | In-plugin management UI for full page locking and on-page content gating guide. |
| `src/components/tabs/SettingsTab.tsx` | Settings tab hosting Config, Page Locks, and Integration sub-tabs. |
| `src/types/connection.ts` | Data models for `GatedPageRule`, `SiteSettingsDocument`, and `SiteSettingsPatch`. |
| `backend/src/lib/siteSettings.ts` | Backend validation, default values, and merging for `gatedPages`. |
| `backend/src/routes/member.ts` | Session (`/session`), auth (`/login-password`), and logout (`/logout`) endpoints. |
| `src/services/canvasComponentCodeGenerator.ts` | Code generator serializing `loginPath` and configuration into canvas files. |
| `src/services/framerCanvasService.ts` | Canvas file creation and component instance insertion wrapper. |
| `src/services/framerPagesService.ts` | Queries active Framer canvas AST for `WebPageNode` entries and normalizes paths. |
| `src/utils/entitlement.ts` | Single source of truth for `isEntitled` resolution parity. |
| `src/styles/settings.css` | Modular stylesheet for Page Locks panel and on-page guide (Zero Inline CSS). |

---

## 4. Framer Property Controls Specification

`<MemberGate>` exposes 7 native Framer Property Controls configured in Framer's sidebar:

| Control Property | Type | Default | Hidden Condition | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `contentSlot` | `ControlType.ComponentInstance` | `undefined` | None | Slot connecting the protected Frame, Stack, or Component |
| `requiredTier` | `ControlType.Enum` | `"signed_in"` | None | Minimum tier required (`Any Signed In`, `Free Member`, `Tier 1: Silver`, `Tier 2: Gold`, `VIP Member`) |
| `fallbackAction` | `ControlType.Enum` | `"blur"` | None | Locked state treatment (`Frosted Blur`, `Hide Completely`, `Page Redirect`, `Lock Card`) |
| `redirectUrl` | `ControlType.Link` | `""` | `props.fallbackAction !== "redirect"` | Target URL or path when fallbackAction is redirect |
| `cardTitle` | `ControlType.String` | `"Members Only Content"` | `props.fallbackAction !== "custom_card"` | Custom lock card heading |
| `cardDescription` | `ControlType.String` | `"Join or sign in to read this full guide."` | `props.fallbackAction !== "custom_card"` | Custom lock card body copy |
| `blurIntensity` | `ControlType.Number` | `8` | `props.fallbackAction !== "blur"` | Blur radius in pixels (2px min, 20px max, step 1) |

---

## 5. Data Contracts and TypeScript Interfaces

### 5.1. Gated Page Rule (`src/types/connection.ts`)

```typescript
export type GatedPageFallbackAction = "redirect" | "blur" | "custom_card";
export type GatedPageTier = "signed_in" | "free_member" | "tier_1" | "tier_2" | "vip";

export interface GatedPageRule {
  path: string;
  enabled: boolean;
  requiredTier: GatedPageTier;
  fallbackAction: GatedPageFallbackAction;
  redirectPath?: string;
}
```

### 5.2. Runtime Session Contract (`/api/member/session`)

```typescript
export interface MemberSessionData {
  memberId: string;
  email: string;
  name: string | null;
  activeTier: "free_member" | "tier_1" | "tier_2" | "vip";
  status: "active" | "trialing" | "past_due" | "canceled";
  currentPeriodEnd: number;
  gracePeriodEndsAt: number;
  siteId: string;
}

export interface SessionResponse {
  member?: MemberSessionData;
  tiers: ReadonlyArray<TierLadderEntry>;
}
```

### 5.3. Custom Browser Events

| Event Name | Detail Payload | Dispatcher | Listener |
| :--- | :--- | :--- | :--- |
| `memberframe:open-auth` | None | `<MemberGate>` lock CTA button | `<MemberAuth>` modal handler |
| `memberframe:session-updated` | `{ signedIn: boolean }` | `<MemberAuth>` (on sign in), `<MemberDashboard>` (on sign out) | `<MemberGate>` instances to invalidate cache and refresh |

---

## 6. Verification and Testing Checklist

### 6.1. Automated Test Suites

1. **Frontend Root Test Suite (`cmd /c npm test`)**:
   - `test/memberGateParity.test.ts`: 32 tests passing. Verifies byte parity of `isEntitled`, exactly 1 fetch call, no token storage, and all 7 property controls.
   - `test/memberAuth.test.ts`: 86 tests passing. Verifies 3 fetch calls, origin security, and password submit clearing.
   - `test/canvasCodeGenerator.test.ts`: 26 tests passing. Verifies code generator replaces config block cleanly.
   - Total Frontend: **526 passed across 19 test files**.

2. **Backend Test Suite (`cmd /c npm test` in `backend`)**:
   - `test/siteSettings.test.ts`: 27 tests passing. Validates `gatedPages` defaults, safe path validation, and clean merges.
   - `test/parity.test.ts`: 17 tests passing. Confirms three-way parity across plugin, canvas, and backend.
   - Total Backend: **133 passed across 8 test files**.

3. **Zero Inline CSS Compliance (`cmd /c npm run lint:css`)**:
   - Verified across 81 files: **0 inline style violations found**.

4. **TypeScript Verification (`cmd /c npx tsc --noEmit`)**:
   - Clean compilation with zero type errors.

### 6.2. Standing Verification Checklist

- [x] Zero inline CSS compliance verified (`npm run lint:css`).
- [x] TypeScript type checking clean (`npx tsc --noEmit`).
- [x] Real-time session event dispatching and listening verified.
- [x] On-mount session check in `MemberAuth.tsx` with auto-redirect to `/dashboard` for logged-in users.
- [x] Sign-out flow in `MemberDashboard.tsx` revokes session, emits update, and re-gates content.
- [x] In-plugin Page Locks management panel implemented in `SettingsTab.tsx`.
- [x] On-page content gating guide integrated with one-click canvas deploy button.
- [x] Automated tests updated and 100% passing (526 frontend, 133 backend).
