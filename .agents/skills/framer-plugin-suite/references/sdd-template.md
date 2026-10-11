# [Plugin Name] — Software Design Document (SDD)

> **Document Status**: Draft / Approved / Implemented  
> **Author**: AI Pair Programmer & Lead Developer  
> **Ecosystem**: Company Framer Plugin Standard  
> **Date**: YYYY-MM-DD  

---

## 1. Executive Summary & Problem Statement

Briefly describe what this Framer plugin accomplishes, the pain point it solves for Framer designers, and the business value.

- **Plugin Name**: `[Plugin Name]` (e.g., Announcement Bar, Slider Pro)
- **Plugin ID / Slug**: `[plugin-id]`
- **Target Audience**: Framer creators, e-commerce storefronts, agencies.
- **Monetization Model**: Free 7-Day Trial -> Monthly / Yearly / Lifetime Pro plans.

---

## 2. Framer Canvas Architecture & Permissions

### 2.1. Plugin Configuration (`framer.json`)
```json
{
  "id": "my-plugin-id",
  "name": "My Plugin Name",
  "modes": ["canvas"],
  "permissions": [
    "createCodeFile",
    "CodeFile.setFileContent",
    "CodeFile.remove",
    "addComponentInstance",
    "setParent",
    "Node.remove",
    "setPluginData"
  ],
  "icon": "/icon.png"
}
```

### 2.2. Generated Code Component Schema
- **File Name**: `MyPluginComponent.tsx`
- **Prefix**: `MyPlugin_*`
- **Property Controls**:
  - `variant`: ControlType.Enum
  - `accentColor`: ControlType.Color
  - `title`: ControlType.String

---

## 3. UI Navigation & Page Breakdown

Window Dimensions: `framer.showUI({ position: "top right", width: 360, height: 640 })`

| Tab | Title | Purpose |
| :--- | :--- | :--- |
| **Tab 1** | `Home` | Welcome banner, quick guide links, docs, cross-promo cards |
| **Tab 2** | `Editor / Builder` | Interactive configurator, real-time preview, 'Add to Canvas' CTA |
| **Tab 3** | `Settings` | Analytics tracking toggle, theme switcher (Light / Dark / System) |
| **Profile** | `Profile / Subscription` | User badge, active plan status, trial countdown, Stripe checkout |

---

## 4. Pro-Lock & Licensing Engine Integration

| Requirement | Implementation Detail |
| :--- | :--- |
| **UI Button Gating** | If `!isLoggedIn` -> "Sign In to Unlock" `<Lock />`<br>If `!hasSubscription` -> "Upgrade to Unlock" `<Lock />` |
| **CodeFile Auto-Patching** | Regex patch `const IS_LOCKED = (true\|false);` in `App.tsx` on status change |
| **Canvas Banner** | Frosted glass lock card when `IS_LOCKED === true` |
| **Trial System** | Auto-start 7-day trial on registration, sticky live countdown banner |
| **Stripe Flow** | Stripe Elements modal, `/api/create-payment-intent`, override cache |

---

## 5. Backend API Contracts & Data Storage

- **Base URL**: `https://api.myplugin.framefic.com` (configured in `config/backend.ts`)
- **Endpoints**:
  - `POST /api/auth/send-otp` -> `{ email, siteId, framerUserId, framerSiteName, framerSiteUrl }`
  - `POST /api/auth/verify-otp` -> `{ email, code }` -> `{ token, user }`
  - `GET /api/subscription-status` -> `?siteId=...&userId=...&email=...` -> `{ isPaid, plan, status, trialSecondsRemaining }`
  - `POST /api/create-payment-intent` -> `{ plan, siteId, userId, email }` -> `{ clientSecret, publishableKey }`
  - `POST /api/user/site-info` -> Non-blocking site metadata sync

---

## 6. Telemetry & Analytics Tracking Matrix

1. **`componentsCount`**: Read via `framer.getCodeFiles()` (skips in `configureManagedCollection` mode).
2. **`trackPaymentCompletion`**: Dispatched post-Stripe confirmation.
3. **`sync_users_to_crm.js`**: Background sync to CRM webhook.
4. **Lifecycle Emails**: Signup, payment success, recurring billing, trial ended.

---

## 7. Quality Assurance & Verification Checklist

- [ ] Plugin loads without console errors in Framer developer sandbox.
- [ ] Theme switches seamlessly between Light mode and Dark mode.
- [ ] Unauthenticated state renders "Sign In to Unlock".
- [ ] Signing up initiates 7-day trial and displays countdown in top sticky banner.
- [ ] Canvas code component compiles cleanly in Framer canvas without missing exports.
- [ ] Lock state toggle correctly swaps `const IS_LOCKED = true;` and displays the Pro Lock banner on canvas.
- [ ] `npx framer-plugin-tools@latest pack` succeeds and generates `plugin.zip`.
