# MemberFrame: End-to-End Development Work Process Guide

A comprehensive, step-by-step engineering roadmap for building MemberFrame from scratch. This guide covers local environment setup, workspace architecture, prioritized feature implementation, canvas component codegen, headless backend orchestration, and continuous technical documentation.

---

## 1. Executive Overview and Architecture Principles

MemberFrame is designed to solve the primary friction point of existing Framer membership tools: **forcing creators onto external dashboards**.

### Core Engineering Principles
1. **100% In-Framer Cockpit:** The creator manages members, tiers, pricing, and gateway keys directly inside the 360x640 Framer plugin panel. No external dashboard is ever required.
2. **Visual Canvas Gating:** Visual frame slot components (`<MemberGate>`) replace brittle code overrides.
3. **Strict Zero Inline CSS Rule:** All styling lives in modular external CSS files or CSS string templates. Zero `style={{ ... }}` blocks in React JSX.
4. **Light and Dark Mode Synchronization:** Every component dynamically inherits Framer workspace theme tokens via `data-framer-theme` and `design-tokens.css`.
5. **Continuous Feature Documentation:** Every single feature developed automatically produces a dedicated technical document in `docs/development-docs/<feature-name>.md`.
6. **0% Platform Transaction Fees:** Creators keep 100% of their earnings across all plans.

---

## 2. Part 1: Beginner-to-Developer Setup and Workspace Orientation

### 2.1. Local Environment Prerequisites
Before writing code, verify your machine has the required development tooling installed:
- **Node.js:** v18.0.0 or later (LTS recommended).
- **Package Manager:** npm v9+ or pnpm.
- **Framer Desktop App or Framer Web Account:** Required to run and test plugins in developer mode.
- **Git:** Version control.

### 2.2. Plugin Manifest Configuration (`framer.json`)
The `framer.json` manifest defines plugin permissions, window modes, and marketplace metadata:
> [!IMPORTANT]
> **Framer Manifest ID Rule:** Framer developer manifests strictly enforce that the `"id"` property must be **exactly 6 characters long** (e.g. `"memfrm"`). Using shorter or longer IDs causes Framer to reject the plugin with `Failed to load framer.json "id" property must be 6 characters long`.

```json
{
  "id": "memfrm",
  "name": "MemberFrame",
  "version": "1.0.0",
  "description": "The ultimate native membership and recurring monetization suite for Framer.",
  "icon": "icon.png",
  "main": "dist/index.html",
  "modes": ["canvas"],
  "permissions": [
    "createCodeFile",
    "CodeFile.setFileContent",
    "CodeFile.remove",
    "addComponentInstance",
    "setParent",
    "Node.remove",
    "setPluginData",
    "getPluginData"
  ]
}
```

### 2.3. Window Geometry Initialization
In `src/App.tsx`, always initialize the plugin window geometry to standard 360x640 dimensions:
```typescript
import { framer } from "framer-plugin";

framer.showUI({
  position: "top right",
  width: 360,
  height: 640,
});
```

### 2.4. Directory Architecture and File Orientation
Organize the codebase with clear separation between plugin UI, canvas code components, and backend client services:

```
d:/project/Framer APP/memberframe/
├── .agent/                                          # Agent skills, rules, and scripts
│   ├── rules/
│   │   ├── framer-sdd-standards.md                 # SDD and design standards
│   │   └── feature-development-docs.md             # Automatic feature documentation rule
│   ├── scripts/
│   │   └── lint-zero-inline-css.js                 # Zero Inline CSS automated linter
│   └── skills/
│       ├── framer-plugin-suite/                    # Unified Framer plugin framework
│       └── feature-dev-docs/                       # Feature documentation templates
├── .github/agents/                                  # 9 Specialized Sub-Agents
│   ├── architect.agent.md                          # Architecture and data contracts
│   ├── backend.agent.md                            # Headless API and webhooks
│   ├── documentation.agent.md                      # Feature docs in docs/development-docs/
│   ├── frontend.agent.md                           # 360x640 UI and theme sync
│   ├── orchestrator.agent.md                       # Master conductor and living plan
│   ├── planner.agent.md                            # Task breakdown and estimates
│   ├── reviewer.agent.md                           # Code review and linter auditing
│   ├── security.agent.md                           # Encryption and session tokens
│   └── tester.agent.md                             # Mock tests and npm run pack
├── docs/                                            # Public documentation
│   ├── list-the-features-of-the-competitors.md     # Market research
│   ├── missing-scopes-we-can-implement.md           # Gap analysis
│   ├── final-feature-specifications.md             # Authoritative feature specifications
│   ├── work-process.md                             # Work process guide link
│   └── development-docs/                           # Dedicated feature documents
│       ├── 01-member-gate.md                       # Feature 1 technical document
│       ├── 02-in-plugin-cockpit.md                 # Feature 2 technical document
│       └── ...                                     # Additional feature documents
├── work-precess/                                    # Master work process directory
│   └── work-process.md                             # This master work process document
├── src/                                             # Plugin source code
│   ├── App.tsx                                     # Main entry point and window geometry
│   ├── App.css                                     # Base layout and shell styles
│   ├── components/                                 # In-plugin UI components
│   │   ├── shell/                                  # PluginShell (Header, Tabs, Content, Footer)
│   │   ├── tabs/                                   # Home, Builder, Members, Tiers, Settings
│   │   ├── preview/                                # Live Preview Studio and state simulator
│   │   └── ui/                                     # Buttons, inputs, modals, toasts, banners
│   ├── canvas-components/                          # Code files inserted onto Framer canvas
│   │   ├── MemberGate.tsx                          # Gating slot container
│   │   ├── MemberAuth.tsx                          # SSO and OTP login form
│   │   ├── MemberDashboard.tsx                     # Member billing and account portal
│   │   ├── MeteredPaywall.tsx                      # Soft paywall with counter pill
│   │   ├── CMSGatedTemplate.tsx                    # Dynamic CMS item gating
│   │   ├── ProtectedDownload.tsx                   # Expiring asset vault
│   │   ├── CourseProgress.tsx                      # LMS progress bar and checklist
│   │   ├── DonationSlider.tsx                      # Pay-what-you-want contribution slider
│   │   └── templates/                              # Master external CSS strings
│   ├── hooks/                                      # React hooks for auth, site info, telemetry
│   ├── services/                                   # API connectors to MemberFrame Cloud
│   └── styles/                                     # Global variables and design tokens
└── package.json                                    # Dependencies and build scripts
```

### 2.5. Design System and Token Integration
1. **Canonical Token File:** Import `design-tokens.css` into `src/App.tsx`.
2. **Dual-Theme Synchronization:** Support real-time light and dark switching:
   ```css
   /* Dark Theme Default (:root) */
   :root {
     --framefic-page-bg: #201f1f;
     --framefic-surface: #201f1f;
     --framefic-surface-border: #3b3a3a;
     --title: #edf0f7;
     --paragraph: #c7ccd6;
     --secondary-default: #5271ff;
   }

   /* Light Theme Synced with Framer Workspace */
   body[data-framer-theme="light"]:not([data-user-theme="dark"]),
   html[data-user-theme="light"] body {
     --framefic-page-bg: #f4f7fb;
     --framefic-surface: #ffffff;
     --framefic-surface-border: #d2dae5;
     --title: #18202b;
     --paragraph: #48525b;
     --secondary-default: #5271ff;
   }
   ```
3. **Mandatory `.primary-cta` Button Standard:** Every primary button uses the signature double-gradient border with zero ad-hoc styling.
4. **Strict Icon Standard:** Exclusively Lucide React (`lucide-react`) and Framer SVG icons with `stroke="currentColor"`. Zero unicode emojis.

---

## 3. Part 2: Feature Prioritization Architecture

To deliver MemberFrame efficiently within a 14-day development timeframe, features are structured into three strict priority tiers:

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                             FEATURE EXECUTION PHASING                            │
├────────────────────────┬────────────────────────┬────────────────────────────────┤
│ PHASE 1: CORE MVP (P0) │ PHASE 2: ADVANCED (P1) │ PHASE 3: SCALE & GLOBAL (P2)   │
│ Days 1 to 5            │ Days 6 to 10           │ Days 11 to 14                  │
├────────────────────────┼────────────────────────┼────────────────────────────────┤
│ • In-Plugin Shell      │ • Metered Soft Paywall │ • Lemon Squeezy (EU VAT / MoR) │
│ • In-Plugin Tiers Tab  │ • SEO Schema.org Gating│ • Razorpay & Instant UPI / QR  │
│ • In-Plugin Members Tab│ • CMS Item-Level Gating│ • Geolocation Currency Routing │
│ • <MemberGate> Slot    │ • Creator LMS Suite    │ • B2B Team Multi-Seat Invites  │
│ • <MemberAuth> (OTP)   │ • Asset Download Vault │ • Pay-What-You-Want Slider     │
│ • Stripe Checkout      │ • Live Preview Studio  │ • Member Directory & Bookmarks │
│ • <MemberDashboard>    │ • Differential Storage │ • Pro-Lock Auto Watermark Pack │
└────────────────────────┴────────────────────────┴────────────────────────────────┘
```

### Rationale for Feature Phasing
- **Phase 1 (Core MVP):** Without these foundational features, a membership plugin cannot function. A creator must be able to create tiers, gate a visual frame, authenticate visitors with email OTP, accept Stripe payments, and view subscribers.
- **Phase 2 (Creator Enhancements):** Features that provide decisive competitive differentiation over FrameAuth and Thenty, including metered paywalls, SEO preservation, course progress tracking, and protected downloads.
- **Phase 3 (Scale and Global Reach):** Expands the addressable market globally with Lemon Squeezy and Razorpay, adds B2B team licensing, and finalizes marketplace packaging.

---

## 4. Part 3: Step-by-Step Implementation Guide for Each Feature

---

### Step 1: Plugin Shell and Navigation Architecture (P0)

* **Objective:** Establish the 360x640 window geometry, 4-part shell layout, and navigation tabs.
* **Files to Create:**
  - `src/components/shell/PluginShell.tsx`
  - `src/components/shell/PluginShell.css`
  - `src/components/tabs/HomeTab.tsx`
* **Implementation Flow:**
  1. Initialize `framer.showUI` at 360x640 in `src/App.tsx`.
  2. Build `<PluginShell>` with:
     - Header (48px): 24px logo, title, collapse toggle, and close button calling `framer.closePlugin()`.
     - Tab Bar (36px): Tabs for `Home`, `Builder`, `Members`, `Tiers`, `Settings`, with active gradient pill indicator.
     - Scroll Area: `.framefic-content-area` with custom scrollbar.
     - Pinned Footer (40px): Author link `@Framefic` and version badge.
  3. Wire theme synchronization with `data-framer-theme`.
* **Feature Documentation:** Generate `docs/development-docs/00-plugin-shell.md`.
* **Verification:** Run `node .agent/scripts/lint-zero-inline-css.js` and verify zero styling errors.

---

### Step 2: In-Plugin Tier Configuration Cockpit (P0)

* **Objective:** Enable creators to create and edit membership tiers directly inside Framer.
* **Files to Create:**
  - `src/components/tabs/TiersTab.tsx`
  - `src/components/tabs/TiersTab.css`
  - `src/services/TierService.ts`
* **Implementation Flow:**
  1. In `TiersTab.tsx`, display existing tiers (Free, Silver, Gold, VIP) as responsive cards.
  2. Provide an "Add New Tier" button opening an in-plugin modal or form row.
  3. Fields include: Tier Name, Monthly Price, Annual Price, Access Key Tag, and Description.
  4. On save, post tier data to `POST /api/site/tiers` linked to `siteId`.
* **Feature Documentation:** Generate `docs/development-docs/02-in-plugin-cockpit.md`.
* **Verification:** Test saving a tier, verify network payload, and check state persistence.

---

### Step 3: In-Plugin Member Management Cockpit (P0)

* **Objective:** Allow creators to search, view, and modify active subscribers without an external website.
* **Files to Create:**
  - `src/components/tabs/MembersTab.tsx`
  - `src/components/tabs/MembersTab.css`
  - `src/services/MemberService.ts`
* **Implementation Flow:**
  1. In `MembersTab.tsx`, render the members roster with search input and tier filter pills.
  2. Each row displays member email, name, tier badge, status, and join date.
  3. Clicking a row opens action options: `Change Tier`, `Grant Lifetime Access`, `Cancel Subscription`, or `Resend Login Link`.
* **Feature Documentation:** Update `docs/development-docs/02-in-plugin-cockpit.md`.
* **Verification:** Verify search filtering, status badge styling, and action triggers.

---

### Step 4: Visual Canvas Content Gating (`<MemberGate>`) (P0)

* **Objective:** Provide a zero-code visual frame slot component that gates content on published sites.
* **Files to Create:**
  - `src/canvas-components/MemberGate.tsx`
  - `src/canvas-components/templates/CanvasCssTemplates.ts`
* **Implementation Flow:**
  1. In `MemberGate.tsx`, define Framer Property Controls with `ControlType.ComponentInstance` for `contentSlot`.
  2. Add controls for `requiredTier` (`signed_in`, `free`, `silver`, `gold`, `vip`) and `fallbackAction` (`blur`, `hide`, `redirect`, `custom_card`).
  3. In runtime execution, read visitor auth state via `useMemberSession()`.
  4. If unauthorized, render `.memberframe-blur-overlay` with lock card and `.primary-cta` unlock button.
  5. If authorized, render the slotted frame clearly.
* **Feature Documentation:** Generate `docs/development-docs/01-member-gate.md`.
* **Verification:** Test inside Framer preview; verify that changing tiers in properties updates the gate state.

---

### Step 5: Multi-Provider Authentication and Passwordless OTP (`<MemberAuth>`) (P0)

* **Objective:** Enable one-click social SSO and 6-digit email OTP login on published sites.
* **Files to Create:**
  - `src/canvas-components/MemberAuth.tsx`
  - `src/services/AuthService.ts`
* **Implementation Flow:**
  1. Build `<MemberAuth>` supporting both modal popup and inline embed modes.
  2. Include Google SSO, Apple Sign In, GitHub, and email input.
  3. When an email is submitted, dispatch `POST /api/auth/otp/send` to send a 6-digit verification code.
  4. Display a 6-digit input form with a live 60-second countdown ticker for code resend.
  5. Upon verification, set a secure HTTP-only session cookie and persist the JWT token.
* **Feature Documentation:** Generate `docs/development-docs/05-member-auth.md`.
* **Verification:** Test OTP generation, rate limiting, and cookie session persistence.

---

### Step 6: Stripe Payment Gateway Integration (P0)

* **Objective:** Enable recurring subscription checkouts and billing management via Stripe.
* **Files to Create:**
  - `src/components/tabs/SettingsTab.tsx`
  - `src/services/StripeService.ts`
  - Backend Webhook Handler: `stripeWebhook.ts`
* **Implementation Flow:**
  1. In `SettingsTab.tsx`, provide input fields for Stripe Publishable Key and Secret Key.
  2. Validate keys by calling Stripe's account balance endpoint.
  3. In canvas components, initiate checkout sessions via `POST /api/checkout/stripe/create-session`.
  4. Backend webhook listener processes `customer.subscription.created` and `invoice.payment_succeeded`, updating member tier records in PostgreSQL.
* **Feature Documentation:** Generate `docs/development-docs/03-tri-gateway-payments.md`.
* **Verification:** Use Stripe test cards (4242...) to complete checkout and confirm real-time member unlock.

---

### Step 7: Canvas-Native Member Dashboard (`<MemberDashboard>`) (P0)

* **Objective:** Provide a self-serve account portal where members update payment cards and manage profiles.
* **Files to Create:**
  - `src/canvas-components/MemberDashboard.tsx`
* **Implementation Flow:**
  1. Scaffold `<MemberDashboard>` with tabs: `Overview`, `Subscription`, `Invoices`, `Profile`.
  2. Display active plan name, renewal date, and billing history.
  3. Clicking "Manage Billing" generates a Stripe Customer Portal link and opens it cleanly.
  4. Allow members to update their display name and profile avatar.
* **Feature Documentation:** Generate `docs/development-docs/06-member-dashboard.md`.
* **Verification:** Test opening the customer portal and verify billing history display.

---

### Step 8: Dynamic Metered Soft Paywall (`<MeteredPaywall>`) (P1)

* **Objective:** Allow visitors to read X free articles per month before displaying a paywall.
* **Files to Create:**
  - `src/canvas-components/MeteredPaywall.tsx`
* **Implementation Flow:**
  1. Add Framer Property Controls for `freeQuotaCount` (default: 3) and `quotaPeriod` (`monthly` or `weekly`).
  2. Track viewed article slugs in encrypted localStorage keyed to visitor device fingerprints.
  3. Render a floating counter pill: "Article 2 of 3 free articles this month".
  4. On quota exhaustion, blur content after paragraph 2 and display the upgrade lock card.
* **Feature Documentation:** Generate `docs/development-docs/07-metered-paywall.md`.
* **Verification:** Read 3 test articles; verify the paywall triggers on article 4.

---

### Step 9: SEO-Preserving Schema.org Paywall Integration (P1)

* **Objective:** Allow Google to index full article text while restricting human visitors.
* **Files to Update:**
  - `src/canvas-components/MemberGate.tsx`
  - `src/canvas-components/MeteredPaywall.tsx`
* **Implementation Flow:**
  1. When `Enable SEO Schema` is toggled in sidebar property controls, dynamically inject JSON-LD into the document head:
     ```json
     {
       "@context": "https://schema.org",
       "@type": "NewsArticle",
       "isAccessibleForFree": "False",
       "hasPart": {
         "@type": "WebPageElement",
         "isAccessibleForFree": "False",
         "cssSelector": ".memberframe-gated-body"
       }
     }
     ```
  2. Mask human view using accessible CSS frosted blur overlays.
* **Feature Documentation:** Generate `docs/development-docs/08-seo-paywall-schema.md`.
* **Verification:** Inspect page DOM in browser; verify `<script type="application/ld+json">` is present and valid.

---

### Step 10: Native Framer CMS Item-Level Gating (`<CMSGatedTemplate>`) (P1)

* **Objective:** Gate individual items in a shared Framer CMS collection template.
* **Files to Create:**
  - `src/canvas-components/CMSGatedTemplate.tsx`
* **Implementation Flow:**
  1. Add property control `premiumBinding` accepting dynamic Framer CMS variables.
  2. If the bound CMS boolean is true, enforce the required tier; if false, render openly.
* **Feature Documentation:** Generate `docs/development-docs/09-cms-gated-template.md`.
* **Verification:** Create sample CMS collection with mixed free/premium items; confirm correct gating behavior.

---

### Step 11: Creator LMS Suite (Progress Bar, Checklist, Video Listener) (P1)

* **Objective:** Enable lesson completion tracking, video playback listeners, and progress bars.
* **Files to Create:**
  - `src/canvas-components/CourseProgress.tsx`
  - `src/canvas-components/LessonChecklist.tsx`
  - `src/canvas-components/VideoProgressListener.tsx`
* **Implementation Flow:**
  1. `<CourseProgress>` renders a percentage bar calculated from completed lessons.
  2. `<LessonChecklist>` provides interactive checkboxes syncing to `PATCH /api/member/progress`.
  3. `<VideoProgressListener>` listens to YouTube, Vimeo, and Wistia iframe postMessage events, automatically checking off lessons when video ends.
* **Feature Documentation:** Generate `docs/development-docs/11-creator-lms-suite.md`.
* **Verification:** Watch a test video; verify lesson automatically marks complete upon finish.

---

### Step 12: Expiring Secure Digital Asset Vault (`<ProtectedDownload>`) (P1)

* **Objective:** Protect downloadable files with time-expiring signed URLs.
* **Files to Create:**
  - `src/canvas-components/ProtectedDownload.tsx`
  - Backend API: `signDownloadUrl.ts`
* **Implementation Flow:**
  1. Creator inputs private asset ID and allowed tiers in Framer property controls.
  2. Member clicks "Download Resource".
  3. Backend verifies member entitlement and generates a signed S3 / Cloudflare R2 URL with 60-second expiration.
* **Feature Documentation:** Generate `docs/development-docs/10-protected-download.md`.
* **Verification:** Attempt downloading as guest (fails); download as paid member (succeeds); reuse link after 60s (expired).

---

### Step 13: In-Plugin 360x640 Live Preview Studio (P1)

* **Objective:** Provide a real-time component customizer and auth state simulator inside the plugin panel.
* **Files to Create:**
  - `src/components/preview/PreviewStudio.tsx`
  - `src/components/preview/PreviewStudio.css`
  - `src/components/tabs/BuilderTab.tsx`
* **Implementation Flow:**
  1. Inside `BuilderTab.tsx`, render `<PreviewStudio>` with a responsive viewport.
  2. Add an interactive auth state dropdown (`Logged Out`, `Free Member`, `Silver Tier`, `VIP`, `Expired`).
  3. Changes to radii, colors, and button copy update the preview in real time.
* **Feature Documentation:** Generate `docs/development-docs/04-live-preview-studio.md`.
* **Verification:** Toggle states in preview; verify instantaneous visual updates.

---

### Step 14: Global Multi-Gateway Expansion (Lemon Squeezy & Razorpay/UPI) (P2)

* **Objective:** Support EU VAT compliance via Lemon Squeezy and UPI payments via Razorpay.
* **Files to Update:**
  - `src/components/tabs/SettingsTab.tsx`
  - `src/services/GatewayService.ts`
* **Implementation Flow:**
  1. Add Lemon Squeezy Store ID and API key inputs; add Razorpay Key ID and Secret inputs.
  2. Auto-detect visitor country via IP geolocation and route to the optimal gateway.
  3. Process Lemon Squeezy and Razorpay webhooks in the backend service.
* **Feature Documentation:** Update `docs/development-docs/03-tri-gateway-payments.md`.
* **Verification:** Test test-mode checkout for Lemon Squeezy and Razorpay; verify webhook processing.

---

### Step 15: B2B Team Accounts and Multi-Seat Invitations (`<TeamManagement>`) (P2)

* **Objective:** Allow corporate buyers to purchase team plans and invite coworkers.
* **Files to Create:**
  - `src/canvas-components/TeamManagement.tsx`
* **Implementation Flow:**
  1. When an organization plan is active, display a "Team Seats" tab inside `<MemberDashboard>`.
  2. Company managers enter coworker emails to send invites.
  3. Coworkers click invite links to register under the company account without payment.
* **Feature Documentation:** Generate `docs/development-docs/12-b2b-team-management.md`.
* **Verification:** Send an invitation to a test email; verify seat allocation decrements.

---

### Step 16: Pay-What-You-Want Donation Slider (`<DonationSlider>`) (P2)

* **Objective:** Support flexible contributions and tiered donations.
* **Files to Create:**
  - `src/canvas-components/DonationSlider.tsx`
* **Implementation Flow:**
  1. Provide slider controls for min, max, and preset amounts.
  2. Support one-time and monthly recurring billing toggles.
* **Feature Documentation:** Generate `docs/development-docs/13-donation-slider.md`.
* **Verification:** Slide amount; verify prefilled checkout session opens with the selected amount.

---

### Step 17: Community Bookmarks and Member Directory (P2)

* **Objective:** Deliver bookmarking trays and searchable community rosters.
* **Files to Create:**
  - `src/canvas-components/BookmarksTray.tsx`
  - `src/canvas-components/MemberDirectory.tsx`
* **Implementation Flow:**
  1. `<BookmarkButton>` toggles optimistic saved states.
  2. `<MemberDirectory>` displays member avatar cards with tier filter pills and search.
* **Feature Documentation:** Generate `docs/development-docs/14-member-bookmarks.md` and `docs/development-docs/15-member-directory.md`.
* **Verification:** Bookmark an item; verify it appears in the tray immediately.

---

## 5. Part 4: Continuous Feature Documentation Workflow

To maintain absolute documentation integrity across all conversations and tasks:

1. **Rule Enforcement:** Every code change triggers `.agent/rules/feature-development-docs.md`.
2. **Sub-Agent Execution:** The `documentation.agent.md` sub-agent writes or updates the corresponding file in `docs/development-docs/<feature-name>.md`.
3. **Mandatory Review:** The `reviewer.agent.md` verifies that no feature code is merged without matching documentation.

---

## 6. Part 5: Quality Assurance, Packaging, and Marketplace Release

Before generating the production plugin package:

1. **Zero Inline CSS Linting:**
   ```bash
   node .agent/scripts/lint-zero-inline-css.js src
   ```
   Must exit with code 0 and zero violations.

2. **Dual-Theme Contrast Verification:**
   Verify WCAG AA contrast (≥ 4.5:1) in both Framer Light and Dark modes.

3. **Client Pro-Lock Verification:**
   - 7-day trial ticker countdown active.
   - 1-instance limit enforced on trial.
   - Trial watermark displayed on canvas.
   - Automatic watermark removal verified upon simulated upgrade.

4. **Marketplace Packaging:**
   ```bash
   npm run pack
   ```
   Generates the production `plugin.zip` ready for Framer Marketplace review.
