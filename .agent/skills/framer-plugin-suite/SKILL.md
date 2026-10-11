---
name: framer-plugin-suite
description: Authoritative framework for developing company Framer plugins with unified UI design layout, multi-agent frontend orchestrator ecosystem, client-side Pro-Lock monetization, Framer Canvas API integration, Framer site telemetry, and Spec-Driven Development (SDD). Use when creating, refactoring, or monetizing any Framer plugin.
---

# Company Framer Plugin Suite: Unified Frontend Architecture & SDD Workflow

This skill provides the authoritative engineering standard for building production-grade **Framer Plugins** with a shared design layout, multi-agent frontend orchestration, client-side telemetry tracking, the **Mandatory `.primary-cta` Button Standard**, the **Strict Zero Inline CSS Rule (External CSS Only)**, the **Light Mode & Dark Mode Color Synchronization Guidelines**, and the bulletproof **Frontend Pro-Lock Licensing & Trial System**.

This skill is designed to build **10 to 15+ plugins** with total brand consistency, rapid scaffolding, and zero visual bugs.

---

## 1. Quick Navigation & References

Before creating or modifying a Framer plugin, consult the reference documents in this skill:
- **Orchestrator & Sub-Agent Ecosystem**: [references/orchestrator-and-subagents.md](references/orchestrator-and-subagents.md)
  * Multi-agent hierarchy: `framer-orchestrator`, `framer-frontend-ui`, `framer-canvas-codegen`, `framer-licensing-lock`, `framer-telemetry-tracking`.
  * Feature research intake protocol, living task plans, and live Agent Work Preview table.
- **Frontend Site Telemetry & Tracking**: [references/telemetry-and-tracking.md](references/telemetry-and-tracking.md)
  * `getSiteInfo()` metadata extraction (`siteId`, `siteName`, `siteUrl`, `userId`, `userEmail`), frontend sync to `/api/user/site-info`, `componentsCount` telemetry, `framer.mode` safety guardrails, and 2kB storage differential compression.
- **Client Pricing & Trial Lifecycle**: [references/pricing-and-trial-lifecycle.md](references/pricing-and-trial-lifecycle.md)
  * 3-Tier catalog (Monthly $4.99, Yearly $49.99, Lifetime $99.99), 7-day trial anti-abuse engine (`email`, `site_id`, `framer_user_id`), sticky top countdown ticker, 1-instance limit enforcement, trial watermark injection, and instant automatic removal post-purchase.
- **Company Plugin Architectural Patterns**: [references/plugin-case-studies.md](references/plugin-case-studies.md)
  * Architectural breakdown of media comparison sliders, external data/CMS connectors, and promotional widget builders.
- **Pro-Lock Engine Blueprint**: [references/pro-lock-engine.md](references/pro-lock-engine.md)
  * Complete source code patterns for `useAuth`, `usePaymentFlow`, CodeFile Auto-Lock File Patching (`enforceLockState`), and Canvas Watermark banners.
- **Design System Tokens & Styles**: [references/design-tokens.css](references/design-tokens.css)
  * CSS variables, light/dark themes (`data-framer-theme`), `.primary-cta` signature double-gradient border, inputs, and layout wrappers.
- **Profile Page & Subscription Management UI**: [references/profile-and-subscription-ui.md](references/profile-and-subscription-ui.md)
  * Complete drop-in `ProfilePage.tsx` & `SubscriptionPage.tsx`, avatar segmented rings, Pro/Trial badges, Stripe customer portal redirect, and plan upgrade cards.
- **TDD & Quality Verification Guide**: [references/tdd-and-verification.md](references/tdd-and-verification.md)
  * Framer SDK mocking (`framerMock.ts`), zero inline CSS linter test, 2kB compression tests, and pre-pack verification checklist.
- **Plugin UI Kit Components & Home Tab**: [references/plugin-components.md](references/plugin-components.md)
  * Standard components (HeroCard, HelpTile, FrameficCard, Badges, Button & Actions System, IconButton, FrameficShell, Form Controls: FieldRow, TextField, SelectField, Checkbox, Toggle, SegmentedControl) from Company Foundations v0.3.7.
- **Canvas Code Component Master Template**: [references/canvas-component-template.md](references/canvas-component-template.md)
  * Authoritative canvas React component template with Property Controls, external CSS string template injection, 1-instance duplicate limit (`window.__instances__`), Frosted Pro Lock banner, and automatic trial watermark removal.
- **Environment Variables Reference Guide**: [references/env-template.md](references/env-template.md)
  * Standard frontend `.env.example` definitions, dynamic fallback patterns, and client-side security boundaries.
- **Spec-Driven Development (SDD) Template**: [references/sdd-template.md](references/sdd-template.md)
  * Standard `SDD.md` specification template required for every new plugin.
- **Plugin Scaffolding Runbook**: [references/boilerplate-scaffolder.md](references/boilerplate-scaffolder.md)
  * Zero-to-one guide to bootstrap Vite + React + Framer Plugin SDK + Stripe.

---

## 2. Core Architectural Pillars

> [!IMPORTANT]
> **Mandatory Pre-Flight Check: `design-tokens.css` & Ecosystem Reference Adherence**
> Before designing, coding, or styling any component:
> 1. **Inspect for Design Tokens**: The agent MUST check whether `src/design-tokens.css` (or `src/styles/variables.css`) exists in the target plugin or references (`references/design-tokens.css`).
> 2. **Strict Adherence**: If design tokens exist, ALL styling MUST strictly adhere to the exact CSS variables and rules defined in the project. Never introduce outside, arbitrary, or ungrounded styles.
> 3. **Follow Ecosystem References & SKILL.md**: When triggered, the orchestrator and all sub-agents MUST follow all reference folders in the ecosystem (`references/` and existing plugins in the workspace) and this `SKILL.md`.

Every Framer plugin built in this ecosystem conforms to four non-negotiable pillars:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        FRAMER PLUGIN WORKSPACE                         │
├──────────────────────────┬─────────────────────────────────────────────┤
│ 1. Frontend Multi-Agent  │ • framer-orchestrator: master conductor     │
│    Ecosystem & Preview   │ • Step 0: Feature analysis & scope intake   │
│                          │ • 4 Specialized sub-agents (UI, CodeGen,    │
│                          │   Licensing/Lock, Site Telemetry)           │
│                          │ • Real-time Agent Work Preview table        │
├──────────────────────────┼─────────────────────────────────────────────┤
│ 2. Unified Design Layout │ • 360x640 Framer window (top-right)         │
│    & Standard Navigation │ • 4-Part Shell: Header (48px) + Tab bar     │
│                          │   (36px) + Content Area + Footer (40px)     │
│                          │ • Header (Logo 24px, Name, Collapse, Close) │
│                          │ • Tabs: Home | [Builder/Work] · Profile 👤  │
│                          │ • Sticky Trial Countdown Banner (live tick) │
│                          │ • Mandatory .primary-cta on all action CTAs │
│                          │ • Strict Zero Inline CSS (External CSS only)│
│                          │ • Light & Dark Mode Color Synchronization   │
│                          │ • Pinned Footer: @Pixelfic ↗, version tag   │
├──────────────────────────┼─────────────────────────────────────────────┤
│ 3. Client Pro-Lock       │ • Layer 1: Client UI lockout (.primary-cta) │
│    & Trial Engine        │ • Layer 2: CodeFile Regex Auto-Patching     │
│    (Wired in Phase 4)    │ • Layer 3: Runtime In-Canvas Lock Watermark │
│                          │ • 7-Day Auto-Trial & Live Countdown Expiry  │
│                          │ • 1-Instance Limit per component on trial   │
│                          │ • Trial watermark badge on canvas           │
│                          │ • Auto-watermark removal on paid purchase   │
├──────────────────────────┼─────────────────────────────────────────────┤
│ 4. Site Telemetry & SDD  │ • getSiteInfo() extraction & fallbacks      │
│    Engineering Workflow  │ • POST /api/user/site-info sync             │
│                          │ • componentsCount usage metrics             │
│                          │ • framer.mode guardrails (avoid sync bugs)  │
│                          │ • 6-Phase SDD: Intake -> Spec -> UI ->      │
│                          │   Canvas Component -> Lock -> Pack          │
└──────────────────────────┴─────────────────────────────────────────────┘
```

---

## 3. Mandatory `.primary-cta` Button Specification

The AI agent **MUST ALWAYS** use `.primary-cta` for every primary call-to-action button in all plugins. Never generate generic or ad-hoc primary buttons.

### 3.1. The Signature Double-Gradient Border Technique
```css
.primary-cta {
  font-family: var(--font-sans, "Inter", sans-serif);
  font-size: 13px;
  font-weight: 500 !important;
  letter-spacing: 0.22px;
  line-height: 1;
  width: 100%;
  height: 36px;
  padding: 0 16px;

  /* Signature Double-Gradient Border */
  background: linear-gradient(var(--secondary-default, #5271ff), var(--secondary-default, #5271ff)) padding-box,
              linear-gradient(180deg, #708aff 0%, #3358ff 100%) border-box;
  color: #ffffff !important;
  border: 2px solid transparent !important;
  border-radius: var(--radius-md, 8px);

  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  position: relative;
  cursor: pointer;
  box-sizing: border-box;
  text-decoration: none;
  user-select: none;
  outline: none;
  transition: opacity 0.15s ease, box-shadow 0.2s ease, transform 0.1s ease;
}

.primary-cta:hover:not(:disabled) {
  opacity: 0.96;
  box-shadow: 0 4px 14px rgba(82, 113, 255, 0.32);
}

.primary-cta:active:not(:disabled) {
  transform: scale(0.985);
  box-shadow: 0 2px 6px rgba(82, 113, 255, 0.2);
}

.primary-cta:focus-visible {
  box-shadow: 0 0 0 3px rgba(112, 138, 255, 0.45);
}

.primary-cta:disabled,
.primary-cta[disabled] {
  opacity: 0.55;
  cursor: not-allowed;
  transform: none !important;
  box-shadow: none !important;
  filter: grayscale(0.2);
}

.primary-cta svg {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  stroke: currentColor;
}
```

---

## 4. Light Mode & Dark Mode Color Synchronization Guidelines

All plugins **MUST** support seamless real-time color synchronization between Framer Dark Mode and Light Mode.

### 4.1. The 2-Tier Synchronization Mechanism
1. **Framer Host Canvas Theme**: Framer injects `data-framer-theme="light"` or `data-framer-theme="dark"` onto `<body>`.
2. **Plugin User Setting**: The user selects `System | Dark | Light` in `SettingsPage.tsx`, setting `data-user-theme` on `<html>`.

```css
/* 1. Dark Theme Default */
:root { ... }

/* 2. Light Theme: Framer is Light OR user selected Light */
body[data-framer-theme="light"]:not([data-user-theme="dark"]),
html[data-user-theme="light"] body { ... }

/* 3. Dark Override: user forces Dark even if Framer is Light */
html[data-user-theme="dark"] body { ... }
```

### 4.2. Authoritative Token Mapping
- App Background: `var(--framefic-page-bg)` (Dark: `#201f1f` | Light: `#f4f7fb`)
- Surfaces / Cards: `var(--framefic-surface)` (Dark: `#201f1f` | Light: `#ffffff`)
- Inner Cards / Inputs: `var(--bg-card-inner)` (Dark: `#2b2b2b` | Light: `#f1f4f9`)
- Dividers & Borders: `var(--framefic-surface-border)` (Dark: `#3b3a3a` | Light: `#d2dae5`)
- Headings & Primary Text: `var(--title)` (Dark: `#edf0f7` | Light: `#18202b`)
- Paragraph Text: `var(--paragraph)` (Dark: `#c7ccd6` | Light: `#48525b`)
- Brand Accent: `var(--secondary-default)` (Dark: `#708aff` | Light: `#5271ff`)

### 4.3. Strict Icon Standard: Lucide Icons or Framer Icons Only — Strictly NO Emojis
1. **Permitted Icons**: Use ONLY official icons from `lucide-react` (e.g., `<UserRound />`, `<Crown />`, `<Lock />`, `<Plus />`, `<Sparkles />`, `<HelpCircle />`, `<ExternalLink />`, `<Check />`, `<X />`, `<ChevronDown />`) or Framer SVG icons.
2. **STRICT PROHIBITION**: NEVER use unicode emojis anywhere in plugin UI panels, navigation tabs, action buttons, dialogs, badges, or canvas components.
3. **Theme Inheritance**: All icons must use `stroke="currentColor"` or `fill="currentColor"` so they adapt to light/dark themes seamlessly.

---

## 5. Strict Zero Inline CSS Rule: External CSS Only

The AI agent **MUST NEVER USE INLINE CSS (`style={{ ... }}`) IN REACT JSX**. All styling must reside exclusively in external `.css` stylesheet files.

1. **No `style={{ ... }}` in React JSX**:
   - ❌ **FORBIDDEN**: `<div style={{ display: "flex", gap: "8px" }}>`
   - ✅ **REQUIRED**: `<div className="form-row-group">` with styles in external `.css`.
2. **Dedicated Modular Stylesheets**:
   Every component must have a corresponding imported `.css` file (`App.css`, `AuthModal.css`, `Customizer.css`, etc.).
3. **Canvas Code Components**:
   - In code generated for Framer canvas, all CSS is organized in a dedicated stylesheet module injected as a `<style>` string with semantic class names, never scattered inline styles.

---

## 6. The Frontend Pro-Lock Engine & Trial Lifecycle (Wired in Phase 4)

1. **Layer 1: Client UI Gating**: Replace primary CTA dynamically based on auth & subscription status.
2. **Layer 2: Automated CodeFile Regex Patching**: Inside `App.tsx`, `enforceLockState` dynamically rewrites:
   - `const IS_LOCKED = (true|false);`
   - `const IS_TRIAL = (true|false);`
   - `// @plugin-lock-state: (locked|unlocked)`
   - `// @plugin-trial-state: (trial|paid)`
3. **Layer 3: Runtime In-Canvas Lock Watermark Banner**: Render Frosted Pro Lock Banner on canvas if locked.
4. **The 1-Instance Limit during Trial**: Trial users can add each component only 1 time. Further attempts switch the CTA to `<Crown /> Upgrade to Add More` and block insertions. Duplicate canvas copies display `.framefic-duplicate-limit-container`.
5. **Company Watermark on Trial**: Displays subtle watermark on canvas during trial.
6. **Automatic Watermark Removal**: Immediately upon purchasing any paid plan, `enforceLockState` rewrites `IS_TRIAL = false`, permanently deleting the watermark from all canvas components and lifting all instance limits.

---

## 7. Frontend Site Telemetry & API Guardrails

1. **`getSiteInfo()` Metadata Extraction**:
   Extract `siteId`, `siteName`, `siteUrl`, `userId`, `userEmail` strictly using official Framer SDK calls (`framer.getProjectInfo()`, `framer.getPublishInfo()`, `framer.getCurrentUser()`).
2. **Site Info Sync to Backend**:
   POST to `/api/user/site-info` upon login/registration and subscription check to update user logins and payments with `framer_site_name` and `framer_site_url`.
3. **Usage Metrics (`componentsCount`)**:
   Pass `componentsCount` in query parameters to `/api/subscription-status`.
4. **`framer.mode` Guardrail**:
   Always verify `framer.mode` before calling `framer.getCodeFiles()`. Skip code file scans when `framer.mode === "configureManagedCollection"` or `"syncManagedCollection"` to prevent fatal sandbox permission errors.
5. **2kB Storage Differential Compression**:
   When storing widget configurations in `framer.setPluginData()`, save only diffs that deviate from default values to respect Framer's 2kB payload limit.

---

## 8. Phased Development Workflow

```
[Step 0: Feature Intake] ➔ [Phase 1: SPEC & SDD] ➔ [Phase 2: UI Panel & Customizer] ➔ [Phase 3: Canvas Component] ➔ [Phase 4: Pro-Lock & Trial] ➔ [Phase 5: Telemetry & Pack]
```

1. **Step 0: Feature Research & Intake**:
   - Ask user for feature analysis, instructions, reference plugin preferences, and customization scope.
2. **Phase 1: Specification & Design (`SPEC.md` & `SDD.md`)**:
   - Define plugin purpose, Framer API permissions needed in `framer.json`, component property controls, and TDD plan.
3. **Phase 2: UI Panel & Customizer Implementation**:
   - Build 360x640 window, navigation tabs, customizer form, external CSS, theme sync, and `.primary-cta`.
4. **Phase 3: Canvas Component Generation**:
   - Generate React canvas template with Property Controls and external CSS template.
5. **Phase 4: Pro-Lock, Trial & Subscription Wiring**:
   - Wire client Pro-Lock, 7-day trial ticker, 1-instance check, duplicate protection, and watermark auto-removal.
6. **Phase 5: Telemetry, Verification & Pack**:
   - Wire `getSiteInfo()`, test light/dark themes, run zero-inline-CSS linter, and run `npm run pack`.

---

## 9. Feedback System: Toast, Banner & Empty State (Figma Nodes 13085:8408, 13085:8413, 13085:8422)

All plugins must follow the authoritative 3-tier feedback system:
1. **Toast (`.plugin-toast` / `<Toast />` / `useToast()`)**:
   - Used exclusively for brief confirmation that an action finished (e.g. `Calculator added. Uses your site styles.`).
   - Length ≤ 45 characters. Optional `Undo` action in `var(--px-color-text-brand)`.
   - Auto-dismisses after ≥ 5s, pauses on hover or keyboard focus.
   - Glass background (`var(--px-toast-bg)` with 16px backdrop blur) + popover shadow (`var(--px-toast-shadow)`).
   - Accessibility: `role="status"` (polite), or `role="alert"` for error toasts.
2. **Banner (`.plugin-banner` / `<Banner />`)**:
   - Used for persistent screen states that require user awareness:
     - `info`: Blue subtle background (`var(--px-color-info-subtle)`), Info icon (`var(--px-color-info)`).
     - `success`: Green subtle background (`var(--px-color-success-subtle)`), Check icon (`var(--px-color-success)`).
     - `warning`: Amber subtle background (`var(--px-color-warning-subtle)`), Warning icon (`var(--px-color-warning)`).
     - `danger`: Red subtle background (`var(--px-color-danger-subtle)`), Alert icon (`var(--px-color-danger)`), `role="alert"`.
   - 14px radius, 12px padding, 10px gap, 12px Semi-Bold title, 12px Medium description, optional action button.
   - Never show more than 2 banners on a screen at once.
3. **Empty State (`.empty-state` / `<EmptyState />`)**:
   - Used when a list or view has no content yet.
   - 16px radius, hairline divider border, 40×40 icon tile with 20px icon in `bg/tertiary`, 14px Semi-Bold title, 12px Medium description, and exactly one next-step action button (`.primary-cta.btn-sm` or `.btn-secondary.btn-sm`).
   - Never leave blank areas without an Empty state.

