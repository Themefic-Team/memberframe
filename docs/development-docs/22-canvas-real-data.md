# Feature: Real Data On The Canvas

Components show the creator's own tiers, prices, profile questions, and files on the Framer canvas, instead of samples.

**PRD reference**: F04 (live preview), F03, F10, F16
**Status**: awaiting review
**Tasks**: unscheduled, requested 2026-10-18

---

## 1. Overview and Problem Solved

- **Feature Name**: Real data on the canvas
- **Target Audience**: Framer Creator
- **Value Proposition**: A creator with two tiers saw a pricing table of four sample plans on the canvas, and had to publish to see what visitors would. Designing against the real content is the point of a canvas.
- **Priority Tier**: P1, Creator Enhancement

### 1.1. Why The Components Could Not Just Fetch

On the published site each component reads from routes behind `resolveSite`, which checks the request's `Origin` against the site's allowlist. The canvas is on a Framer origin no site lists, so those requests are refused, and the components showed samples instead.

### 1.2. The Design

1. **`GET /api/preview?site=<siteKey>[&asset=<id>]`** (`memberframe-backend/src/routes/preview.ts`). Public and read-only. It finds the site by its public key alone and answers with what the published site shows any visitor: the pricing table (`publicPricing`, no country), the profile field definitions (`publicFieldDefinitions`), and, when asked, one file's label and plan (`publicAsset(...).asset`). No member, session, cookie, gateway, or storage detail. Mounted with `pluginCors` (wildcard origin, no credentials) ahead of the site check. 120 requests a minute per IP; `Cache-Control: public, max-age=15`.
2. **`mfCanvasPreview`**, one helper copied byte for byte into the four components that have site data to show, between `@memberframe-canvas-preview-start` and `-end`. One request per address per 15 seconds, shared by every component on the canvas through `window.__mfCanvasPreview`. No credentials, no custom headers (so no preflight), except the ngrok header a dev tunnel needs. Any failure answers null.
3. **Each component** renders its sample at once, then swaps in the real data when it arrives. When the site is not connected, the request fails, or the site has nothing (no tiers, no fields), the sample stays, so the canvas is never empty.

| Component | Real on the canvas | Still a sample |
| :--- | :--- | :--- |
| Member Pricing | Tiers, names, prices, currencies, test or live badge | Nothing |
| Onboarding Modal | The questions from Settings, Fields | The answers (none) |
| Member Dashboard | The site's tiers, with the preview member on the top one; the profile questions | The member's name and email, billing |
| Protected Download | The chosen file's type, size, and required plan | Nothing, once an Asset ID is set |
| Bookmarks Tray, Bookmark Button | Nothing | Saved items: they belong to a member, and there is none on the canvas |
| Member Auth, Soft Paywall | Already real: their content is the creator's own controls, and Full Access For lists the site's tiers | Nothing |

### 1.3. Conflicts

- **A wildcard-CORS route.** The member half deliberately allowlists origins. This route is the exception because it carries no cookie and answers only public data. It must stay that way: anything added to its response is readable from any origin with the site key, which every published page carries.

---

## 2. User Flows

### 2.1. In-Plugin Configuration Flow

None. A component added after this change shows real data on the canvas once the project is connected. One added earlier needs **Add to canvas** again to get the new file; instances keep their settings.

### 2.2. Visitor / Member Runtime Flow

Unchanged. The published site never calls `/api/preview`.

---

## 3. Architecture and File Inventory

- **Backend**: `src/routes/preview.ts`, mounted in `src/app.ts`.
- **Canvas components**: `MemberPricing.tsx`, `MemberDashboard.tsx`, `OnboardingModal.tsx`, `ProtectedDownload.tsx`.
- **Tests**: backend `test/preview.test.ts` (key lookup, response shape and nothing private, file label, unknown file, unknown or missing key); plugin `test/canvasRealData.test.ts` (copies identical, the helper compiled and run against a fake fetch: address, caching, no credentials, null on failure; each component's fallback).

---

## 4. Framer Property Controls Specification

No new controls.

---

## 5. Data Contracts

```typescript
// GET /api/preview?site=<siteKey>[&asset=<assetId>]
interface CanvasPreview {
  pricing: PublicPricing;                       // as GET /api/checkout/pricing, no country
  profileFields: PublicFieldDefinition[];       // as GET /api/member/profile's fields
  asset: PublicAsset | null;                    // as GET /api/assets/:id's asset
}
```

---

## 6. Verification and Testing Checklist

- [x] Backend and plugin tests above; all gates pass.
- [ ] Needs human verification in Framer: the pricing table on the canvas shows the site's tiers after **Add to canvas** again, and falls back to samples with the backend stopped. Framer's canvas fetching a `http://127.0.0.1` API in development depends on the browser allowing loopback from an https page, which the published site already relies on.
