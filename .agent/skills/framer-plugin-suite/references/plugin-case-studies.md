# Company Architectural Patterns & Frontend Reusability Guide

This document defines the proven frontend architectural patterns established across the company's plugin suite. Any engineer or agent building one of the company's **10 to 15+ Framer plugins** should leverage these patterns for instant implementation and unified branding.

---

## 1. Pattern A: Interactive Media & Canvas Components

### 1.1. Core Anatomy
Used for plugins that render dynamic, interactive visual components directly on the Framer canvas (e.g. before/after comparison sliders, image loupes, interactive carousels).

### 1.2. Architecture
- **Plugin UI Panel**:
  - Live interactive preview showing real-time updates as users tweak controls.
  - Multi-preset selection gallery.
  - Granular control fields: orientation toggles, drag handle styles, label inputs, divider colors.
- **Canvas React Component**:
  - Full touch, pointer, and keyboard event handlers.
  - Responsive container scaling.
  - Property Controls (`addPropertyControls`):
    - `ControlType.ResponsiveImage` for media assets.
    - `ControlType.Color` for visual accents.
    - `ControlType.Number` for handle position and transition speed.
- **Reusability Takeaway**:
  - Keep canvas components self-contained. Inject CSS styles via a `<style>` string with semantic classes rather than inline style objects.

---

## 2. Pattern B: External Storefront & CMS Collection Sync

### 2.1. Core Anatomy
Used for plugins that pull external data (e.g. e-commerce products, headless CMS items) into Framer canvas components or Framer CMS collections.

### 2.2. Architecture
- **Plugin UI Panel**:
  - Connection status dashboard.
  - Component library browser (Product Cards, Details Heroes, Grids, Cart Triggers).
  - Sync trigger view with progress indicators.
- **Canvas React Components**:
  - Flexible layout primitives (Grid, Card, Details Stack).
  - Responsive scaling utility ensuring components look great in both the 360px plugin preview and 1440px canvas frames.
- **Framer API Guardrail**:
  - **`framer.mode` safety**: Never call `framer.getCodeFiles()` during `configureManagedCollection` or `syncManagedCollection`. Always check `framer.mode` first to prevent fatal permission exceptions.

---

## 3. Pattern C: Promotional Announcement Topbars & Floating Widgets

### 3.1. Core Anatomy
Used for notification bars, sticky headers, countdown timer bars, coupon code copy banners, and floating promotional cards.

### 3.2. Architecture
- **Plugin UI Panel**:
  - Segmented widget picker (Topbars, Banners, Floating Cards).
  - Live design customizer (padding, border radius, gradients, countdown end date).
  - Preset library allowing 1-click styling.
- **Canvas React Component**:
  - External CSS module (`WidgetCss.ts`) injected into canvas code components.
  - Dynamic positioning (fixed top, sticky header, floating bottom-right card).
- **Pro-Lock Regex Auto-Patcher (`enforceLockState`)**:
  - Deployed CodeFiles contain standard hooks:
    ```typescript
    const IS_LOCKED = false;
    const IS_TRIAL = false;
    // @plugin-lock-state: unlocked
    // @plugin-trial-state: paid
    ```
  - `enforceLockState` in `App.tsx` regex-scans all files matching the plugin prefix and updates lock/trial flags in real time.

---

## 4. Rapid Plugin Development Matrix

To scaffold and release a new company Framer plugin in under **30 minutes**, reuse these standardized assets:

| Capability | Source Module | Description |
| :--- | :--- | :--- |
| **Window Geometry & Tabs** | `App.tsx` | Standard 360x640 window, 4 tabs (Home, Builder, Settings, Profile) |
| **Double-Gradient `.primary-cta`** | `variables.css` | Mandatory 2px border-box gradient primary button |
| **Theme Synchronization** | `variables.css` | Color tokens matching `data-framer-theme="light|dark"` |
| **Auth & Passwordless OTP** | `features/auth/` | `useAuth.ts`, `AuthModal.tsx`, `authService.ts` |
| **Client Pro-Lock & Trial** | `features/payment/` | `usePaymentFlow.ts`, `enforceLockState`, Sticky Trial Ticker |
| **Framer Site Info & Telemetry**| `lib/framer/project.ts` | `getSiteInfo()` & frontend sync to `/api/user/site-info` |
| **Framer Mode Guardrail** | `lib/framer/apiHelper.ts` | `framer.mode` safe wrapper avoiding CMS sync bugs |
