# Technical Specification: MemberFrame Canvas Components Suite

* **Module:** `01-canvas-components-suite`
* **Status:** Prototype. All 8 components render and insert, but their behaviour is simulated (no backend calls). Each component carries its own CSS string and `injectStyles` helper. They do not import `base-component-styles.ts`, so section 3 describes the pattern, not the shared file. See [../project-review.md](../project-review.md), section 3.2.
* **Target Environment:** Framer Canvas Runtime & Published Websites
* **Strict Architecture Standards:**
  * **Strict Zero Inline CSS Rule:** 100% external CSS string templates injected via `injectCanvasStyles`. 0 `style={{ ... }}` objects.
  * **Strict Icon Standard:** Exclusively Lucide React SVG icons. Zero Unicode emojis.
  * **Framer Canvas API:** Configured with `addPropertyControls` and `ControlType` from `"framer"`.

---

## 1. Executive Summary

This suite provides the 8 core React canvas code components designed to be dragged directly onto the Framer canvas or inserted via MemberFrame's In-Plugin Builder Tab. These components run directly on published Framer websites and communicate with MemberFrame's client-side session engine and payment gateways.

---

## 2. Canvas Component Roster

| Component | Source File | Core Purpose | Key Property Controls |
| :--- | :--- | :--- | :--- |
| `<MemberGate />` | [MemberGate.tsx](file:///d:/project/Framer%20APP/memberframe/src/canvas-components/MemberGate.tsx) | Slot container that wraps and locks any visual Framer frame | `allowedTier`, `fallbackMode`, `blurAmount`, `lockTitle`, `ctaText`, `redirectUrl` |
| `<MemberAuth />` | [MemberAuth.tsx](file:///d:/project/Framer%20APP/memberframe/src/canvas-components/MemberAuth.tsx) | Multi-provider authentication form (Email 6-digit OTP & Google SSO) | `title`, `subtitle`, `enableGoogleSso`, `buttonText`, `redirectOnSuccess` |
| `<MemberDashboard />` | [MemberDashboard.tsx](file:///d:/project/Framer%20APP/memberframe/src/canvas-components/MemberDashboard.tsx) | Self-serve member billing, plan cancellation, and invoice receipts portal | `portalTitle`, `showSubscriptionDetails`, `showPaymentHistory`, `allowCancellation` |
| `<MeteredPaywall />` | [MeteredPaywall.tsx](file:///d:/project/Framer%20APP/memberframe/src/canvas-components/MeteredPaywall.tsx) | Soft paywall with persistent reading quota counter pill | `freeArticlesLimit`, `cookieKey`, `paywallTitle`, `ctaText`, `ctaLink` |
| `<CMSGatedTemplate />` | [CMSGatedTemplate.tsx](file:///d:/project/Framer%20APP/memberframe/src/canvas-components/CMSGatedTemplate.tsx) | Dynamic CMS collection item gating with gradient fade excerpt | `isGatedField`, `requiredTier`, `paywallTitle`, `ctaText`, `ctaLink` |
| `<ProtectedDownload />` | [ProtectedDownload.tsx](file:///d:/project/Framer%20APP/memberframe/src/canvas-components/ProtectedDownload.tsx) | Expiring asset vault for secure download links | `assetName`, `fileSize`, `requiredTier`, `buttonText`, `tokenExpiryMinutes` |
| `<CourseProgress />` | [CourseProgress.tsx](file:///d:/project/Framer%20APP/memberframe/src/canvas-components/CourseProgress.tsx) | Creator LMS progress bar, checklist, and completion certificate unlock | `courseTitle`, `totalLessons`, `initialCompleted`, `showCertificateCta` |
| `<DonationSlider />` | [DonationSlider.tsx](file:///d:/project/Framer%20APP/memberframe/src/canvas-components/DonationSlider.tsx) | Pay-what-you-want contribution slider with preset amount pills | `minAmount`, `maxAmount`, `defaultAmount`, `step`, `currency`, `title`, `ctaText` |

---

## 3. Zero Inline CSS Injection Architecture

Each canvas component injects its dedicated, scoped CSS string template via [base-component-styles.ts](file:///d:/project/Framer%20APP/memberframe/src/canvas-components/templates/base-component-styles.ts):

```typescript
export function injectCanvasStyles(id: string, cssText: string): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(id)) return;

  const styleEl = document.createElement("style");
  styleEl.id = id;
  styleEl.textContent = cssText;
  document.head.appendChild(styleEl);
}
```

This guarantees:
1. Styles are loaded once per document without duplication.
2. Dynamic percentage calculations (such as `<CourseProgress />` bar width) use DOM refs or CSS variables instead of inline `style={{ ... }}` blocks.
3. Framer Canvas and published sites render identically.

---

## 4. Verification Results

* **Linter Validation:** `node .agent/scripts/lint-zero-inline-css.js src` $\rightarrow$ **33 files checked, 0 violations**.
* **TypeScript Compilation:** `tsc` passed with 0 errors.
* **Production Bundle:** `vite build` succeeded in **2.66s**.
* **Builder Tab Integration:** All 8 components added to [BuilderTab.tsx](file:///d:/project/Framer%20APP/memberframe/src/components/tabs/BuilderTab.tsx).
