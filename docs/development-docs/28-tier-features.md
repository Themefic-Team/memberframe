# Feature: Tier Features

Each tier carries its own feature list, edited in Manage, Tiers, with every line marked included or not included. The pricing component shows it on that tier's card.

**PRD reference**: F02 (tiers), F03 (pricing), requested by the product owner 2026-10-20
**Status**: awaiting review
**Tasks**: unscheduled

---

## 1. Overview and Problem Solved

- **Feature Name**: Tier features
- **Target Audience**: Framer Creator
- **Value Proposition**: Feature lines lived in the pricing component's **Features** property, matched to a tier by typing its name. A renamed tier lost its lines, a new tier had none until the creator found the property, and two pricing components on two pages needed the same list typed twice. Now the list belongs to the tier, sits next to its prices, and every pricing component shows it.
- **Priority Tier**: P1, Creator Enhancement

### 1.1. Decisions

| Question | Decision | Why |
| :--- | :--- | :--- |
| Where the list lives | On the tier (`tiers.features`, JSON) | It describes the tier, like its prices. One edit reaches every pricing component |
| Line shape | `{ text, included }` | "Not included" lines are how a pricing table shows what an upgrade adds |
| Limits | 20 lines per tier, 120 characters each | Fits a card; refuses an absurd body |
| The component's old **Features** property | Removed (2026-10-20) | One place for a tier's lines. A tier with no list shows its card without lines |
| Removing a line | Opens a `ConfirmDialog`, even before Save | The delete rule (2026-10-19): nothing is removed on one click |

---

## 2. User Flows

### 2.1. In-Plugin Configuration Flow

1. **Manage**, **Tiers**, open a tier (or **Create tier**).
2. Under **Features**, **Add feature** adds a line: a checkbox (**Included**), the text, and a remove button.
3. Untick the checkbox for a line the tier does not include. It shows with a cross on the card.
4. Remove asks first: "Remove this feature?", **Remove feature** or **Keep feature**.
5. **Save tier**. The canvas shows the new list within about 15 seconds (22-canvas-real-data.md), the published site on its next load.

### 2.2. Visitor Runtime Flow

The pricing card lists the tier's lines in order: included lines with a check, the others muted with a cross.

---

## 3. Architecture and File Inventory

- **Backend**:
  - `prisma/schema.prisma`: `Tier.features Json?`. Migration `20261020000000_tier_features`.
  - `src/lib/tierFeatures.ts`: `tierFeaturesSchema` (zod) and `readTierFeatures` (a stored value read defensively: anything malformed is dropped).
  - `src/routes/site.ts`: `features` accepted on `POST /tiers` and `PATCH /tiers/:id` (absent on PATCH keeps the stored list), returned by `GET /tiers`.
  - `src/services/payments/checkoutService.ts`: `PublicTier.features`, so `/api/pricing` and `/api/preview` both carry it.
- **Plugin**:
  - `src/types/site.ts`: `TierFeature`, `SiteTierRecord.features`.
  - `src/components/manage/tierValidation.ts`: `TierFormDraft.features`, the limits, and a blank line counted as an error.
  - `src/components/manage/TierEditor.tsx`: the Features repeater and its remove popup.
  - `src/components/tabs/ManageTab.tsx`, `src/services/siteService.ts`: the list in the write body.
- **Canvas**: `src/canvas-components/MemberPricing.tsx`: `PublicTier.features`; `featuresFor` reads only the tier's list.

---

## 4. Framer Property Controls Specification

The **Features** property is removed (2026-10-20). Feature lines are set only in MemberFrame, Manage, Tiers.

---

## 5. Data Contracts

```
TierFeature = { text: string (1 to 120), included: boolean }

GET  /api/site/tiers            tiers[].features: TierFeature[]
POST /api/site/tiers            body.features?: TierFeature[] (max 20, default [])
PATCH /api/site/tiers/:id       body.features?: TierFeature[] (absent: unchanged)
GET  /api/pricing, /api/preview tiers[].features: TierFeature[]
```

---

## 6. Testing

- Backend: the schema's limits and defaults; `readTierFeatures` on stored junk; `publicPricing` carrying the list.
- Plugin: validation of blank and long lines and the count; the write body; the Features remove popup listed in `test/deleteConfirm.test.ts`; the component reading only the tier's list, with no Features property.

## 7. Human Verification

- [ ] Add, untick, and remove lines in Framer; the popup on remove.
- [ ] The canvas card updates within about 15 seconds; the published card on reload.
- [ ] The pricing component's sidebar has no Features property.
