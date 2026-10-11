# Technical Specification: Feature 1 — Zero-Code Visual Canvas Gating (`<MemberGate>`)

* **Category:** Content Protection and Gating
* **Module:** `01-member-gate`
* **Status:** Implemented and Verified
* **Target Environment:** Framer Canvas & Published Sites
* **Component Location:** [src/canvas-components/MemberGate.tsx](file:///d:/project/Framer%20APP/memberframe/src/canvas-components/MemberGate.tsx)

---

## 1. Creator Use Case & Problem Definition

Creators, digital educators, and publishers using Framer previously had to:
1. Write or paste brittle custom React code overrides.
2. Manually maintain redirect scripts across canvas breakpoint layers.
3. Deal with breaking visual hierarchy whenever elements were nested.

`<MemberGate>` completely replaces brittle code overrides with a **visual Framer slot component**. Creators simply drop `<MemberGate />` onto their page and visually connect any canvas frame or stack to the protected slot.

---

## 2. End-to-End User Experience Flows

### Visitor Flow (Published Site)
1. An unauthenticated visitor lands on a page containing gated content.
2. The visitor sees a frosted glass preview or lock teaser card explaining the required tier.
3. The visitor clicks **"Sign In to Unlock"** or **"Upgrade to View"**.
4. Once signed in with an active eligible tier, the gate dissolves instantly and the underlying content is revealed.

### In-Plugin Configuration Flow (Cockpit)
1. The creator opens the MemberFrame plugin **Builder** tab.
2. The creator customizes the lock card title, description, button text, and blur radius.
3. The creator clicks **"Insert MemberGate Component"** to drop the component onto the canvas.
4. In Framer's native properties sidebar, the creator connects their target visual frame to the **Protected Slot** (`children`).

---

## 3. Technical Implementation Architecture

### Component Architecture
* **File:** [src/canvas-components/MemberGate.tsx](file:///d:/project/Framer%20APP/memberframe/src/canvas-components/MemberGate.tsx)
* **Slot Architecture:** Uses `ControlType.ComponentInstance` to accept any native Framer frame or component instance.
* **Runtime Entitlement Hook:** Calls [useMemberSession()](file:///d:/project/Framer%20APP/memberframe/src/hooks/useMemberSession.ts) to verify session status, expiration timestamp, and tier rank against `allowedTier`.
* **Zero Inline CSS:** Injected external CSS template [base-component-styles.ts](file:///d:/project/Framer%20APP/memberframe/src/canvas-components/templates/base-component-styles.ts) (`.mf-gate-container`, `.memberframe-gate-container`, `.memberframe-blur-overlay`, `.memberframe-lock-card`).
* **Fallback Behaviors:**
  1. `blur`: Frosted glass blur overlay with customizable radius.
  2. `hidden`: Hides protected content completely (`display: none !important`).
  3. `redirect`: Automatically redirects unauthorized visitors to the specified checkout/pricing URL.

### Data Contract: `MemberSessionData`
```typescript
export interface MemberSessionData {
  memberId: string;
  email: string;
  name: string | null;
  activeTier: string; // "free" | "silver" | "gold" | "vip"
  status: "active" | "trialing" | "past_due" | "canceled";
  currentPeriodEnd: number; // Unix timestamp
  siteId: string;
}
```

### Property Controls Schema
```typescript
addPropertyControls(MemberGate, {
  children: {
    type: ControlType.ComponentInstance,
    title: "Protected Slot",
  },
  allowedTier: {
    type: ControlType.Enum,
    title: "Required Tier",
    options: ["all_paid", "silver", "gold", "vip", "free"],
    optionTitles: [
      "All Paid Members",
      "Silver Tier ($10)",
      "Gold Tier ($25)",
      "VIP Gold ($50)",
      "Free Tier",
    ],
    defaultValue: "all_paid",
  },
  fallbackMode: {
    type: ControlType.Enum,
    title: "Fallback View",
    options: ["blur", "hidden", "redirect"],
    optionTitles: ["Frosted Blur", "Hide Completely", "Redirect to Page"],
    defaultValue: "blur",
  },
  blurAmount: {
    type: ControlType.Number,
    title: "Blur Radius (px)",
    min: 2,
    max: 30,
    defaultValue: 8,
  },
  lockTitle: {
    type: ControlType.String,
    title: "Lock Title",
    defaultValue: "Members Only Content",
  },
  lockDescription: {
    type: ControlType.String,
    title: "Description",
    defaultValue: "Subscribe to unlock this premium content and member perks.",
  },
  ctaText: {
    type: ControlType.String,
    title: "Button Text",
    defaultValue: "Sign In to Unlock",
  },
  redirectUrl: {
    type: ControlType.String,
    title: "Unlock Link",
    defaultValue: "/pricing",
  },
  simulateState: {
    type: ControlType.Enum,
    title: "Canvas Preview",
    options: ["auto", "locked", "unlocked"],
    defaultValue: "locked",
  },
});
```

---

## 4. Entitlement & Plan Availability

* **Entitlement Level:** Available on **all MemberFrame plans** (Free 7-Day Trial, Creator Pro, Agency Lifetime).
* **Zero Platform Fees:** 0% additional transaction fees.
