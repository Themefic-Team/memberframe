# Feature: In-Plugin Member and Tier Admin Cockpit

Technical development specification, user flow, architectural wiring, and testing checklist for the MemberFrame In-Plugin Admin Cockpit.

**Status:** Prototype. Tiers and members are sample data saved in browser `localStorage`. Tiers can be added and deleted but not edited. The Settings tab stores the Stripe publishable key only. There is no secret key field, no key validation, and no magic link sending, so the flows in section 2 that mention them describe the target, not the current build. See [../project-review.md](../project-review.md), section 3.1.

---

## 1. Overview and Problem Solved
- **Feature Name**: In-Plugin Member and Tier Admin Cockpit
- **Target Audience**: Framer Creators, Agencies, and Community Managers
- **Value Proposition**: Solves the fundamental flaw of FrameAuth and Outseta by allowing creators to configure tiers, manage subscribers, view metrics, and adjust gateway keys 100% inside Framer without visiting an external website.
- **Priority Tier**: P0: Core MVP Foundation

---

## 2. User Flows
### 2.1. In-Plugin Configuration Flow (Framer Designer)
1. **Tier Management (`TiersTab`):**
   - The creator opens the Tiers tab to view active membership tiers (Free, Silver, Gold).
   - Clicking "Add Tier" opens an in-plugin modal to enter Tier Name, Monthly Price, Annual Price, Access Tag, and Description.
   - The tier saves instantly to local state and backend persistence.
2. **Subscriber Administration (`MembersTab`):**
   - The creator searches subscribers by name or email with instant live filtering.
   - The creator filters by status pills: All, Active, Past Due, and Canceled.
   - Clicking on a member row opens an action modal to change tiers, grant VIP status, cancel subscriptions, or send magic login links.
3. **Gateway Configuration (`SettingsTab`):**
   - The creator inputs their Stripe Publishable and Secret keys with instant test validation.
   - The creator toggles theme overrides between System, Dark, and Light.

### 2.2. Visitor / Member Runtime Flow
Members authenticate and purchase subscriptions on the published site; their entitlements immediately appear in real time inside this cockpit.

---

## 3. Architecture and File Inventory
- **Tiers Tab**: `src/components/tabs/TiersTab.tsx` and `TiersTab.css`
- **Members Tab**: `src/components/tabs/MembersTab.tsx` and `MembersTab.css`
- **Settings Tab**: `src/components/tabs/SettingsTab.tsx` and `SettingsTab.css`
- **Builder Tab**: `src/components/tabs/BuilderTab.tsx` and `BuilderTab.css`
- **Home Tab**: `src/components/tabs/HomeTab.tsx` and `HomeTab.css`

---

## 4. Framer Property Controls Specification
Not applicable (In-Plugin UI Panel components).

---

## 5. Data Contracts and Core User Schema
```typescript
export interface MembershipTier {
  id: string;
  name: string;
  priceMonthly: number;
  priceAnnual: number;
  tag: string;
  description: string;
  isPopular?: boolean;
}

export interface Member {
  id: string;
  email: string;
  name: string;
  tier: string;
  status: "active" | "past_due" | "canceled";
  joinedDate: string;
}
```

---

## 6. Verification and Testing Checklist
- [x] Tier creation, deletion, and local storage persistence work cleanly.
- [x] Subscriber search and filter pills update lists instantly without lag.
- [x] Member upgrade and status adjustment actions reflect in UI state.
- [x] Stripe key configuration and currency selector persist across sessions.
- [x] Zero inline CSS compliance verified with standalone linter script.
- [x] Strictly Lucide React icons used throughout all tabs.
