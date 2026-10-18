# Feature: Dynamic Tiers And One Site Currency

Tiers are the creator's own: any name, an ID made from it, one Free tier and any number of Paid ones, all priced in one site currency set in Payments.

**PRD reference**: F02 (tiers), F03 and FP-16 (payments), section 11.2 and 11.3 (rank and entitlement)
**Status**: awaiting review
**Tasks**: unscheduled, requested 2026-10-18

---

## 1. Overview and Problem Solved

- **Feature Name**: Dynamic tiers, one site currency
- **Target Audience**: Framer Creator
- **Value Proposition**: The editor offered four built in tier types (Free, Silver, Gold, VIP) beside a "Custom" choice, a currency per tier, and extra prices per currency. A creator saw types they never chose and could price two tiers in two currencies, which no buyer can compare.
- **Priority Tier**: P0, Core MVP

### 1.1. Decisions (asked and answered 2026-10-18)

| Question | Answer |
| :--- | :--- |
| How many Free tiers? | Exactly one. Every sign-up starts on it, and a member whose paid plan ends returns to it. It can be renamed, not deleted, not priced |
| Extra prices in other currencies ("Add currency")? | Removed. One site currency for every tier |
| Changing the site currency when tiers have prices? | Allowed. Every tier switches and keeps its numbers, rounded to the new currency's decimals; the panel warns before saving |

### 1.2. The Model, With No Migration

- **The Free tier is the tier at rank 0.** Ranks are already unique per site, so there can be one. It has no prices. It is found by rank, never by key: existing sites keep `free_member`, new sites get `free`, and a renamed Free tier keeps whichever it has.
- **Paid tiers are rank 1 and up**, with at least one price above zero.
- **A tier's ID is its key**, made from its name when created (`Gold Plus` becomes `gold_plus`; a clash gets `_2`), and never changed after: gates, locks, Full Access For, webhooks, and members' `activeTier` all name it. Built in keys on existing tiers (`tier_1`, `vip`) stay as they are.
- **The site currency is `PaymentSettings.defaultCurrency`.** The server writes it onto every tier it saves, whatever the request says. `Tier.currency` stays as a column so every reader keeps working.
- **Extra prices**: no longer written or read. A tier save and a currency change delete the tier's `tier_prices` rows, and pricing ignores any left from before.

### 1.3. What Changed Where

**Backend**
- `routes/site.ts`: tier create and update. Currency from Payments; `extraPrices` gone; rules: rank 0 has no prices, rank 1 and up needs one price, prices at least 1 minor unit, a tier cannot move onto or off rank 0.
- `routes/payments.ts` and `lib/currencies.ts`: a changed site currency rewrites every tier (currency, amounts rescaled by the exponent difference, rounded) and deletes extra prices. `currencyExponent` joins the backend list.
- `lib/tiers.ts` (new): `freeTierKey(siteId)`, the rank 0 tier's key, `free_member` when a site has none. Used by sign up (`memberAuthService`, `routes/member.ts`) and by a paid plan ending (`payments/apply.ts`).
- `creatorAuthService`: a new site's Free tier is `free`.
- `payments/checkoutService.ts`: one currency per tier, no country swap.
- `lib/entitlement.ts`: `TierKey` is any string.

**Plugin**
- `TierEditor` and `tierValidation`: Type (Free or Paid; Free only while the site has none), Name, ID (read only, shown as it will be saved), Level for paid tiers, prices labelled with the site currency, Visible. No Tier type list, no Currency, no Add currency.
- `ManageTab`: reads the site currency from Payments for the editor and the save.
- `PaymentsPanel`: **Site currency**, a searchable list, with a warning while a change is unsaved.
- `ui/SearchSelect` (new kit component, design rule section 9): a select with a filter box, for long lists.
- Every check for `free_member` became a check for rank 0: section locks, member filters, the session hook, and in the canvas components Soft Paywall (Any Paid Plan), Member Dashboard, Member Pricing.

---

## 2. User Flows

### 2.1. In-Plugin Configuration Flow

1. Manage, Payments, **Site currency**: type to filter, pick one, Save.
2. Manage, Tiers: the Free tier is listed with "Everyone starts here". **Create tier**: Type Paid, Name `Gold Plus`, ID shows `gold_plus`, Level, Monthly, Annual, Lifetime in the site currency, Save.
3. Every list that names tiers (Full Access For, Required tier, Who sees it, webhook plans) shows the new tier after the next Add to canvas or Save locks.

### 2.2. Visitor / Member Runtime Flow

Sign up lands on the Free tier, whatever its name. Buying a paid tier moves the member to it; the plan ending moves them back to the Free tier.

---

## 3. Architecture and File Inventory

See 1.3. Tests: plugin `test/tierValidation.test.ts`, `test/dynamicTiers.test.ts`; backend `test/dynamicTiers.test.ts`.

---

## 4. Framer Property Controls Specification

None new. Lists of tiers in controls are written from the site's tiers by the generator, as before.

---

## 5. Data Contracts

```typescript
// POST /api/site/tiers, PATCH /api/site/tiers/:id
interface TierBody {
  siteId: string;
  key: string;                    // POST only; from the name
  name: string;
  rank: number;                   // 0 is the Free tier
  monthlyPriceMinor: number | null;
  annualPriceMinor: number | null;
  lifetimePriceMinor: number | null;
  isActive: boolean;
  // currency: ignored, the site currency is used
}
```

---

## 6. Verification and Testing Checklist

- [x] Gates pass in both repositories: plugin lint, design lint, tsc, 877 tests, build; backend tsc, 382 tests.
- [x] Found and fixed on the way: `rememberSiteTiers` added a second, phantom Free tier to any site whose Free tier is not keyed `free_member`, which every new site would have been.
- [ ] Needs human verification: create a paid tier and see its ID; change the site currency and see every tier switch; sign up a new member and see them on the Free tier; the Site currency list filters as you type, by keyboard too.

---

## 7. Tier Cards, 2026-10-18

On request, the Tiers view now matches Payments' gateway cards. Each tier is an `integration-card`: the bar shows a Gift (Free) or Crown (Paid) icon, the name, the prices or "Everyone starts here", and Free or Paid and Hidden badges. Opening a card puts the form inside it, with Cancel and Save tier at the bottom of the card; before, the form appeared under the whole list. One card is open at a time. Create tier opens a "New tier" card where the button was. The single-primary rule still holds through `tierEditorCta`: while a card is open, its save is the primary and Create tier is hidden.

Files lost two lines of creator-irrelevant copy at the same time: the empty-list paragraph (now "Nothing yet. Upload one above.") and the `ASSET_STORAGE=s3` note, a deployment setting for whoever runs the API.

---

## 8. Deleting A Tier, And Closing After Save, 2026-10-18

**Delete.** `DELETE /api/site/tiers/:id?siteId=` (`routes/site.ts`). A paid tier with no members is deleted, with its cached gateway prices (`gateway_prices`, keyed by tier key) and its extra prices (cascade). Refused: the Free tier (`free_tier_is_fixed`), and any tier a member holds (`tier_in_use`, with the count), since deleting it would leave them on a tier the site no longer has, still paying. Hiding the tier is the alternative the message names. In the panel, an open paid tier's card has **Delete tier**, which asks once (**Confirm delete**) and says what follows: gates, sections, and paywalls set to the tier lock for everyone, which is what `isEntitled` does with a required tier the ladder no longer has. Tests: backend `test/tierDelete.test.ts`.

**Closing after save.** Reported as "a tier is saved instantly and then says it already exists". It was not saved instantly: Create tier saved it, but the card stayed open, the list reloaded with the new tier, and the still-open form validated against itself, so its own name read as taken. `onSave` now resolves true on success and the editor closes the card; a failed save keeps it open with the creator's input. A second press while saving is ignored.
