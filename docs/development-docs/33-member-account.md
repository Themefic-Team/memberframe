# Feature: Member Account Area

Technical development specification, user flow, architectural wiring, and testing checklist for the revamped `<MemberDashboard>`: a full member account area with a section menu.

**PRD reference**: [F06](../memberframe-complete-prd.md) section 8, FP-08 ([features-plan/8. Member Dashboard.md](../features-plan/8.%20Member%20Dashboard.md))
**Status**: awaiting review
**Tasks**: FP-08 (see [`../IMPLEMENTATION-STATUS.md`](../IMPLEMENTATION-STATUS.md))

---

## 1. Overview and Problem Solved

- **Feature Name**: Member account area
- **Target Audience**: Site Member (configured by the Framer Creator)
- **Value Proposition**: `<MemberDashboard>` was one 480px card with everything stacked in a column. Members could not see their saved bookmarks, change a password while signed in, see or remove sign-in methods, see their devices, set a photo, or delete their account. The product owner asked (2026-10-27) for a complete account area in the shape of WooCommerce "My account": a section menu, and each section focused on one job, designed to look native to a Framer site. Competitors send members to a hosted portal; this stays on the creator's own page and styling.
- **Priority Tier**: P0: Core MVP (FP-08)

### 1.1. Decisions (product owner, 2026-10-27)

| Decision | Choice |
| :--- | :--- |
| Layout | Sidebar plus content. Below 720px of component width the menu becomes a horizontally scrolling row on top |
| Security | Change or set password, sign-in methods with unlink, active devices |
| Extras | Avatar upload, delete account |
| Download history | Out of scope: the server keeps a total per file, not who downloaded what |

### 1.2. Sections

| Section | Shows | Data |
| :--- | :--- | :--- |
| Overview | Greeting, avatar, tier badge, three stat tiles (plan, saved items, member since), the current plan, the latest three bookmarks, quick links | session, billing, bookmarks |
| Membership | Plan, price, interval, renewal or lifetime access; switch plan, cancel, resume, undo a scheduled change; link to pricing | `GET /api/member/billing`, `/cancel`, `/resume`, `/undo-change`, checkout |
| Billing | Payment history with receipts, plan history, credits, Manage billing (gateway portal) | billing summary, `/portal` |
| Bookmarks | Every saved item, search, open, remove | `GET` and `PATCH /api/member/bookmarks` |
| Profile | Photo upload and remove, name, email (read only), custom profile fields | `/api/member/profile`, `/api/member/avatar` |
| Security | Change or set password; sign-in methods with unlink; devices with sign out, and sign out everywhere; delete account | `/api/member/account`, `/password`, `/identities/:provider`, `/sessions/:id`, `/logout-everywhere`, `DELETE /account` |
| Sign out | Bottom of the menu | `/logout` |

---

## 2. User Flows

### 2.1. In-Plugin Configuration Flow (Framer Designer)

1. Builder, Member Dashboard, Add to canvas (or Create Pages, which puts it on `/dashboard`). It lands 960px wide, its height fitting its content.
2. In Framer's right sidebar: **Sections** turns each section on or off; **Default section** picks where a member lands; **Navigation** is Auto, Sidebar, or Top; **Canvas section** picks which section the canvas shows, so each can be designed.
3. Colors, Typography, Layout, Spacing, and Labels style and word every section, as on every MemberFrame component.

### 2.2. Visitor / Member Runtime Flow

1. A signed-out visitor sees the sign-in message and button (to Sign In Page). A member whose session ends while the page is open sees "Your session has expired" with the same button.
2. A member lands on the Default section, or on the section named in the address (`#account-billing`). Choosing a section updates the address, so the browser's Back returns to the previous section and a link can open a section directly. The `account-` prefix keeps these clear of Member Auth's `#sign-in` trigger.
3. Every destructive action (unlink a sign-in method, sign out a device, remove the photo, delete the account) asks first in a dialog inside the card. Deleting the account also asks for the member's email typed in, and is refused while a recurring plan renews: the member cancels in Membership first.
4. Changing a password signs out every other device. Unlinking the last way to sign in is refused.

---

## 3. Architecture and File Inventory

- **Canvas Code Components**: `src/canvas-components/MemberDashboard.tsx`. One file, imports nothing but React, Framer, and Lucide. The license block, seal control, shared appearance block, `mfCanvasPreview`, config markers, and `syncShieldSession` stay byte for byte (parity and license tests).
- **Plugin UI Components**: `src/components/tabs/BuilderTab.tsx` (`COMPONENT_LAYOUT_DEFAULTS.member_dashboard` 960px wide), studio preview text.
- **Backend API Endpoints** (`memberframe-backend/src/routes/member.ts`, under `/api/member`, behind `resolveSite` and `requireActiveLicense`, each authorized by the member's own session cookie):

| Method and path | Does |
| :--- | :--- |
| `GET /api/member/account` | `hasPassword`, `emailVerified`, `memberSince`, `avatarUrl`, sign-in methods, live sessions (device label, never the IP) |
| `POST /api/member/password` | Change (current required when one exists) or set a first password; site password policy; rate limited; signs out every other session |
| `DELETE /api/member/identities/:provider` | Unlink; `last_sign_in_method` when nothing else could sign in |
| `DELETE /api/member/sessions/:id` | Sign out one other device; the current one is refused |
| `POST /api/member/avatar` | Raw PNG, JPEG, or WebP, at most 2 MB, checked by its leading bytes, stored with `putFile` |
| `DELETE /api/member/avatar` | Removes the uploaded photo |
| `GET /api/avatars/:id` | Public, before `resolveSite`: an `<img>` sends no Origin. The id is random and unguessable |
| `DELETE /api/member/account` | `confirmEmail` must match; `active_plan` while a recurring plan renews; then the same delete as the creator's (webhook, OTPs, cascade) |

- **Styling**: the component's own `cssContent`, scoped like every canvas component, on the shared `--mf-*` appearance variables. A container query switches the menu at 720px.

---

## 4. Framer Property Controls Specification

| Control Title | Control Type | Default Value | Description |
| :--- | :--- | :--- | :--- |
| Sections | `Object` of `Boolean` | all on | Overview, Membership, Billing, Bookmarks, Profile, Security, Photo upload, Delete account, Allow cancel, Sign out |
| Default section | `Enum` | Overview | Where a member lands with no section in the address |
| Navigation | `Enum` | Auto | Auto (sidebar from 720px), Sidebar, Top |
| Canvas section | `Enum` | Overview | The section the canvas shows; the published site ignores it |
| Headline, Signed out message, Sign In Page, After Sign Out, Accent Color, Corner Radius | as before | as before | Unchanged |
| Colors, Typography, Layout, Spacing, Labels | `Object` | as before | Shared appearance block; Labels gains every new string |

Older instances keep working: `showBilling`, `showProfile`, `showPaymentHistory`, `allowCancel`, `showSignOut`, `showTier`, `showEmail`, `showStatus`, `showAvatar` still apply, mapped onto the sections.

---

## 5. Data Contracts and Core User Schema

```typescript
type AccountSection = "overview" | "membership" | "billing" | "bookmarks" | "profile" | "security";

interface AccountSecurity {
  hasPassword: boolean;
  emailVerified: boolean;
  memberSince: string | null;
  avatarUrl: string | null;
  identities: Array<{ provider: string; email: string; createdAt: string; lastUsedAt: string }>;
  sessions: Array<{ id: string; current: boolean; device: string; createdAt: string; lastSeenAt: string | null }>;
}

interface BookmarkItem {
  itemSlug: string;
  title: string;
  url: string;
  createdAt: string;
}
```

---

## 6. Verification and Testing Checklist

- [x] Backend: every new route refuses a request with no session; another member's session or identity is refused; the last sign-in method cannot be unlinked; the password policy and rate limit apply; avatar type sniffing and the 2 MB limit; delete refused while a plan renews.
- [x] Canvas: section visibility from old and new controls; `#account-<section>` parsing ignores unknown values; device label parser; avatar client checks; delete confirm needs the exact email.
- [x] Generated files (trial, locked, paid) typecheck against Framer's real types, strict and not.
- [x] Zero inline CSS (`npm run lint:css`), design lint, `tsc --noEmit`, `npm test`, `npm run build`, `npm run check:no-cdn`.
- [x] Lucide icons only, inline and tagged `data-lucide`.

---

## 7. Verified By Whom

| Check | Verified by | Date | Evidence |
| :--- | :--- | :--- | :--- |
| Renders correctly in Framer: every Canvas section, restyled Colors and Typography | | | |
| Widths 1200, 810, 390: sidebar becomes the top menu | | | |
| Published: switch and cancel plan, receipts, remove a bookmark, photo upload and remove | | | |
| Published: change password signs out other devices; last sign-in method refused; sign out a device | | | |
| Published: delete account refused while renewing, works after cancel | | | |
| `#account-billing` deep link and browser Back | | | |
| Automated gates | agent | 2026-10-27 | plugin: lint:css, lint:design, tsc, 1213 tests, build, check:no-cdn; backend: tsc, 588 tests; generated files typecheck against Framer 3.0.4 types, strict and not |

### Open item

The PRD's GDPR controller and processor question (section 18) is still open. Delete account ships as a hard delete of the member's account data; payments stay as the creator's record, as with the creator-side delete. An export before delete, if the decision asks for one, comes later.
