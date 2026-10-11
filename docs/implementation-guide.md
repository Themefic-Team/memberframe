# MemberFrame Implementation Guide

How to build MemberFrame so the Framer user manages everything inside Framer, with a small MySQL backend that only stores data and tracks Pro subscriptions.

- Order of work and task IDs: [development-plan.md](development-plan.md)
- Progress: [../work-precess/progress-tracker.md](../work-precess/progress-tracker.md)

---

## 1. The Idea

Three kinds of people use the system. Each one uses a different part.

| Person | Uses | Never needs |
| :--- | :--- | :--- |
| **Creator** (Framer user, your customer) | The plugin panel inside Framer, and the canvas | Any backend screen |
| **Member** (visitor of the creator's published site) | Login, registration, and gated content on the published site | The plugin |
| **Owner** (you) | A small admin screen on the backend to see sites and Pro subscriptions | |

Three parts are built:

```
┌──────────────────────┐      ┌──────────────────────┐      ┌──────────────────────┐
│ 1. PLUGIN PANEL      │      │ 2. PUBLISHED SITE    │      │ 3. BACKEND           │
│ (inside Framer)      │      │ (creator's website)  │      │ (MySQL + API)        │
├──────────────────────┤      ├──────────────────────┤      ├──────────────────────┤
│ Home                 │      │ Canvas components:   │      │ site_meta  (objects) │
│ Builder              │      │  MemberAuth          │      │ members    (rows)    │
│ Members              │─────▶│  PricingTable        │─────▶│ sessions             │
│ Tiers                │ API  │  MemberGate          │ API  │ sites + Pro plan     │
│ Access   (new)       │      │  MemberAccount       │      │ Owner admin screen   │
│ Settings             │      │ Site script (guard)  │      │                      │
└──────────────────────┘      └──────────────────────┘      └──────────────────────┘
```

A backend is required even though the creator never sees it. The plugin only runs while the creator has Framer open. Members sign in on the published site at any time, so something must be online to store members and check logins. The backend does that job silently.

---

## 2. Data Storage in MySQL

### 2.1. Two kinds of data

| Kind | Example | Stored as |
| :--- | :--- | :--- |
| **Site configuration** | Settings, tiers, access rules | One JSON object per key, in `site_meta`. This is the "option meta" model. |
| **Members** | Each person who registers | One row per member, in `members`. |

Configuration fits the option meta model well: it is small, the creator is the only writer, and the plugin reads and saves the whole object.

Members must not be one big object. Two visitors registering in the same second would overwrite each other, login needs a fast lookup by email, and the object would grow without limit. Members get their own table, with a JSON `meta` column for flexible extra fields.

### 2.2. Tables

```sql
-- One row per Framer site that installed the plugin. Also tracks the Pro plan.
CREATE TABLE sites (
  id              CHAR(26) PRIMARY KEY,          -- public site ID, safe to show
  site_key_hash   CHAR(64) NOT NULL,             -- hash of the secret key the plugin holds
  framer_project  VARCHAR(64) NOT NULL,          -- hashed project id from framer.getProjectInfo()
  name            VARCHAR(190),
  site_url        VARCHAR(255),
  owner_email     VARCHAR(190),
  plan            ENUM('free','pro') NOT NULL DEFAULT 'free',
  plan_expires_at DATETIME NULL,
  created_at      DATETIME NOT NULL,
  updated_at      DATETIME NOT NULL
);

-- Option meta. One JSON object per (site, key).
CREATE TABLE site_meta (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  site_id     CHAR(26) NOT NULL,
  meta_key    VARCHAR(64) NOT NULL,
  meta_value  JSON NOT NULL,
  updated_at  DATETIME NOT NULL,
  UNIQUE KEY uq_site_key (site_id, meta_key)
);

-- One row per member of a site.
CREATE TABLE members (
  id             CHAR(26) PRIMARY KEY,
  site_id        CHAR(26) NOT NULL,
  email          VARCHAR(190) NOT NULL,
  password_hash  VARCHAR(255) NOT NULL,
  name           VARCHAR(190),
  tier_id        VARCHAR(40) NOT NULL,           -- id of a tier inside the 'tiers' meta object
  status         ENUM('active','blocked') NOT NULL DEFAULT 'active',
  meta           JSON NULL,
  last_login_at  DATETIME NULL,
  created_at     DATETIME NOT NULL,
  UNIQUE KEY uq_site_email (site_id, email),
  KEY idx_site_tier (site_id, tier_id)
);

-- Login sessions. The browser holds the token, the table holds only its hash.
CREATE TABLE member_sessions (
  token_hash  CHAR(64) PRIMARY KEY,
  member_id   CHAR(26) NOT NULL,
  site_id     CHAR(26) NOT NULL,
  expires_at  DATETIME NOT NULL
);

-- Password reset codes.
CREATE TABLE password_resets (
  site_id     CHAR(26) NOT NULL,
  email       VARCHAR(190) NOT NULL,
  code_hash   CHAR(64) NOT NULL,
  expires_at  DATETIME NOT NULL,
  KEY idx_site_email (site_id, email)
);
```

The same email on two creators' sites is two separate members. That is what `UNIQUE (site_id, email)` enforces.

### 2.3. Meta keys and their shape

Three keys are enough for the first version.

**`settings`**

```json
{
  "allowRegistration": true,
  "loginPath": "/login",
  "registerPath": "/register",
  "accountPath": "/account",
  "afterLoginPath": "/",
  "noAccessPath": "/pricing"
}
```

**`tiers`**

```json
[
  { "id": "t_free", "name": "Free", "price": 0, "currency": "USD", "interval": "none",
    "description": "For everyone who registers.", "features": ["Public articles"],
    "isDefault": true, "isPopular": false, "checkoutUrl": "" },
  { "id": "t_pro", "name": "Pro", "price": 10, "currency": "USD", "interval": "month",
    "description": "Pro content.", "features": ["Pro pages", "Pro sections"],
    "isDefault": false, "isPopular": true, "checkoutUrl": "" },
  { "id": "t_premium", "name": "Premium", "price": 25, "currency": "USD", "interval": "month",
    "description": "Everything.", "features": ["All pages"],
    "isDefault": false, "isPopular": false, "checkoutUrl": "" }
]
```

Exactly one tier has `isDefault: true`. New members get that tier.

**`access_rules`**

```json
{
  "pages": [
    { "path": "/pro-content", "tierIds": ["t_pro", "t_premium"] },
    { "path": "/premium-only", "tierIds": ["t_premium"] }
  ],
  "sections": [
    { "key": "pro-videos", "name": "Pro Videos", "tierIds": ["t_pro", "t_premium"] },
    { "key": "vip-offer", "name": "VIP Offer", "tierIds": ["t_premium"] }
  ]
}
```

One rule for reading every access rule: **a page or section with no rule is public. A page or section with a rule is visible only to signed-in members whose tier is in `tierIds`.**

---

## 3. Backend API

Three groups of endpoints. Each group has a different caller and a different key.

### 3.1. Plugin endpoints (called by the plugin, protected by the site key)

| Method | Path | Does |
| :--- | :--- | :--- |
| POST | `/api/sites/register` | Creates a site. Returns `siteId` and `siteKey` once. |
| GET | `/api/sites/{siteId}` | Site info and plan (`free` or `pro`). |
| GET | `/api/sites/{siteId}/meta/{key}` | Read one object. |
| PUT | `/api/sites/{siteId}/meta/{key}` | Add or replace one object. |
| DELETE | `/api/sites/{siteId}/meta/{key}` | Delete one object. |
| GET | `/api/sites/{siteId}/members?search=&tier=&page=` | Member list for the Members tab. |
| POST | `/api/sites/{siteId}/members` | Add a member by hand. |
| PATCH | `/api/sites/{siteId}/members/{id}` | Change tier, name, or status. |
| DELETE | `/api/sites/{siteId}/members/{id}` | Delete a member. |

Every request sends `Authorization: Bearer <siteKey>`.

### 3.2. Public endpoints (called from the published site)

| Method | Path | Does |
| :--- | :--- | :--- |
| GET | `/api/public/{siteId}/config` | Tiers (public fields), access rules, and paths from settings. |
| POST | `/api/public/{siteId}/register` | Creates a member with the default tier. Returns a session token. |
| POST | `/api/public/{siteId}/login` | Checks email and password. Returns a session token. |
| POST | `/api/public/{siteId}/logout` | Deletes the session. |
| GET | `/api/public/{siteId}/me` | Returns the member and tier for the token. |
| PATCH | `/api/public/{siteId}/me` | Member edits own name or password. |
| POST | `/api/public/{siteId}/password/forgot` | Emails a reset code. |
| POST | `/api/public/{siteId}/password/reset` | Sets a new password with the code. |

Member requests send `Authorization: Bearer <sessionToken>`. These endpoints must allow cross-origin requests (CORS), because they are called from the creators' own domains. Add rate limits to register, login, and forgot.

### 3.3. Owner endpoints (your admin screen)

Normal admin login with email and password. Screens are listed in section 9.

---

## 4. Keys and Security

| Key | Who holds it | Where it is stored | What it allows |
| :--- | :--- | :--- | :--- |
| `siteId` | Everyone. It is public. | Plugin data, and inside the published site | Reading public config, registering, logging in |
| `siteKey` | The creator's Framer project | Framer plugin data (`framer.setPluginData`) | Everything in 3.1 for that one site |
| Session token | One member's browser | `localStorage` on the published site | Reading that member's own data |

How the plugin gets its keys, with no login for the creator:

1. The plugin opens and reads `siteId` and `siteKey` from plugin data.
2. If they are missing, it calls `POST /api/sites/register` with the project id and name from `framer.getProjectInfo()`, and saves the two keys.
3. If the stored project id differs from the current one, the project was duplicated. The plugin registers a new site, so two projects never share members.

Rules for the backend:

- The server decides everything. The published site sends only a token. The server looks up the member and the tier.
- Passwords are stored with bcrypt or Argon2. Never plain, never a fast hash.
- `siteKey` and session tokens are stored as hashes, like passwords.
- Every query filters by `site_id`. Put that filter in one shared place in the code.

### What page and section protection can and cannot do

A published Framer site is static. The full page is delivered to every visitor, and the script then hides it or redirects. A normal visitor cannot see restricted content. A technical visitor who reads the page source can. This is the same level of protection other Framer membership tools give for page content. Say "members-only pages" in the product, not "secure" or "encrypted". Content that must be truly private (paid files, paid videos) needs to be fetched from the backend after login. That is parked for a later phase.

---

## 5. Plugin Tabs

| Tab | Purpose | Data |
| :--- | :--- | :--- |
| Home | Member count, tier count, plan badge, setup checklist | `GET site`, `GET members` |
| Builder | Insert components onto the canvas, enable the site script | Code files, `setCustomCode` |
| Members | List, search, add, change tier, block, delete | Members endpoints |
| Tiers | Create, edit, delete, reorder tiers | `tiers` meta |
| **Access (new)** | Choose which tiers see which pages and sections | `access_rules` meta |
| Settings | Paths, registration on or off, plugin theme, plan and upgrade | `settings` meta |

Six tabs must fit in 360 pixels. Use icons with short labels, or icons only with tooltips.

Add `"setCustomCode"` to `permissions` in `framer.json`. The Builder tab needs it.

---

## 6. Feature 1: Login and Registration

### What the creator does

1. Opens the Builder tab and clicks **Insert** on `MemberAuth`.
2. Places it on a `/login` page (and a `/register` page, or one page with both modes).
3. Styles it in Framer's right sidebar with the property controls.
4. Publishes. Visitors can now register. New members appear in the Members tab.

### `MemberAuth` component

| Property control | Type | Purpose |
| :--- | :--- | :--- |
| Mode | Enum: Login, Register, Both (with switch link) | Which form shows first |
| Show Name Field | Boolean | Ask for a name on registration |
| Title, Subtitle | String | Texts |
| Button Text (Login), Button Text (Register) | String | Texts |
| Redirect After Login | Link | Overrides `afterLoginPath` |
| Accent Color, Background, Text Color, Radius | Color, Number | Design |
| Canvas Preview | Enum: Login, Register, Error, Success | What the creator sees on the canvas |

States the component must handle: empty, typing, submitting, wrong password, email already registered, registration closed, network error, success.

### Steps to build

1. Backend: `register`, `login`, `logout`, `me`, with rate limits.
2. Component: replace the fake OTP flow in `src/canvas-components/MemberAuth.tsx` with email and password forms that call the API.
3. On success, save the token under `localStorage["mf_token_" + siteId]` and redirect.
4. Add `MemberAccount`, a small component for the account page: shows name, email, tier, a change password form, and a logout button.
5. Members tab: replace sample data with the members endpoints. Add paging, because a site can have thousands of members.
6. Password reset: `forgot` and `reset` endpoints, plus a "Forgot password" view in `MemberAuth`. This needs an email service (see question Q2).

### How a component knows its site

Each component is a single file with no imports from the plugin. When the plugin inserts a component, the code generator writes two constants at the top of the file:

```ts
const MF_SITE_ID = "01J9...";                    // written by the plugin at insert time
const MF_API = "https://api.memberframe.com";
```

`api.memberframe.com` and `cdn.memberframe.com` are placeholder addresses in this guide. The real domain is question Q6.

`src/services/canvasComponentCodeGenerator.ts` already reads each component as text. Add one step that replaces placeholders before calling `createCodeFile`.

---

## 7. Feature 2: Tiers and Pricing

### What the creator does

1. Opens the Tiers tab. Adds tiers with name, price, currency, interval (none, month, year, one time), description, and feature lines.
2. Marks one tier as the default for new members.
3. Opens the Builder tab and inserts `PricingTable`. It shows the tiers on the canvas.
4. Edits a price later in the Tiers tab. The published site shows the new price without republishing.

### Tiers tab

- Saves the whole list to the `tiers` meta key on each change.
- Add, edit, delete, reorder, set default, set popular.
- Deleting a tier that has members: ask which tier to move them to. Never leave members pointing at a missing tier.
- Deleting a tier used in an access rule: show which rules use it and remove it from them.

### `PricingTable` component (new)

- Loads tiers from `GET /public/{siteId}/config` at runtime. That is why price changes need no republish.
- Property controls: columns, show features, show popular badge, button text, colors, radius, and "Canvas Preview" with sample tiers so it looks right on the canvas before any tier exists.
- Button behaviour per tier:
  - Visitor not signed in: go to `registerPath`.
  - Free tier: go to `registerPath`.
  - Paid tier with a `checkoutUrl`: open it.
  - Paid tier without one: go to `noAccessPath` or show "Contact us".
- Marks the member's current tier as "Current plan".

### How a member gets a paid tier

Version 1 has no automatic payment. The creator can paste a payment link into the tier's `checkoutUrl`, then change the member's tier by hand in the Members tab after payment. Automatic upgrade after payment is milestone M7 and depends on question Q1.

---

## 8. Feature 3: Access Tab (Pages and Sections)

The example to support: a site has Home, About, Contact, a Pro page, and a Premium page. Tiers are Free, Pro, Premium.

| Content | Free | Pro | Premium | Not signed in |
| :--- | :--- | :--- | :--- | :--- |
| Home, About, Contact (no rule) | Yes | Yes | Yes | Yes |
| `/pro-content` (rule: Pro, Premium) | No | Yes | Yes | No |
| `/premium-only` (rule: Premium) | No | No | Yes | No |
| Section "Pro Videos" on Home (rule: Pro, Premium) | Hidden | Yes | Yes | Hidden |

### 8.1. Access tab layout

Two lists, each row with one checkbox per tier.

```
Pages                         Free   Pro   Premium
/                (Home)       Everyone
/about                        Everyone
/pro-content                  [ ]    [x]   [x]
/premium-only                 [ ]    [ ]   [x]

Sections                      Free   Pro   Premium
Pro Videos       pro-videos   [ ]    [x]   [x]
VIP Offer        vip-offer    [ ]    [ ]   [x]
[ + Add Protected Section ]
```

- The page list comes from Framer: `framer.getNodesWithType("WebPageNode")` returns every page with its `path`. The creator never types a path.
- A row with no box ticked shows "Everyone" and has no rule.
- CMS pages have a path such as `/blog/:slug`. A rule on it covers every item in that collection.
- The login, register, and no-access pages cannot be restricted. Disable their rows, or a member could be locked out of the login page.
- Saving writes the `access_rules` meta key and updates the site script (section 8.3).

### 8.2. Restricting a section: `MemberGate`

A section is any frame the creator wraps in a `MemberGate` component.

1. In the Access tab, the creator clicks **Add Protected Section**, types a name ("Pro Videos"), and ticks tiers.
2. The plugin saves the rule with a key (`pro-videos`) and inserts a `MemberGate` onto the canvas with that key already set, using `framer.addComponentInstance({ url, attributes })`.
3. The creator connects the frame to protect into the gate's slot.
4. To change who sees it later, the creator changes checkboxes in the Access tab. Nothing on the canvas changes.

| Property control | Type | Purpose |
| :--- | :--- | :--- |
| Content | Slot | The frame to protect |
| Section Key | String | Links the gate to its rule. Set by the plugin. |
| When Locked | Enum: Hide, Blur with message, Show custom frame | What others see |
| Locked Content | Slot | The custom frame for "Show custom frame" |
| Title, Message, Button Text | String | For "Blur with message" |
| Canvas Preview | Enum: Unlocked, Locked | Default **Unlocked**, so the creator can design the content |

Why the gate uses a key and not a tier dropdown: property controls are fixed in the component's code, so a dropdown cannot show tiers the creator makes later. With a key, the tier list always comes from the Access tab, and all permissions live in one place.

This replaces the current `MemberGate`, which has hard-coded Silver, Gold, and VIP options and the two bugs listed in the project review.

### 8.3. The site script (the guard)

One small script runs on every page of the published site. The plugin installs it with `framer.setCustomCode({ location: "headStart", html })`. The creator clicks one button in the Builder tab ("Enable membership on this site") and never sees the code.

The plugin writes the site ID and the current rules into the script:

```html
<script>
  window.__MF__ = { siteId: "01J9...", api: "https://api.memberframe.com",
                    rules: { /* copy of access_rules */ }, paths: { /* from settings */ } };
</script>
<script src="https://cdn.memberframe.com/guard.v1.js"></script>
```

What `guard.js` does on every page load and every page change:

```
1. Find the rule for the current path.
2. No rule            → do nothing. Public pages have no delay and no flash.
3. Rule exists        → hide the page at once (add a class on <html>).
4. No token saved     → redirect to loginPath?next=<this page>.
5. Token saved        → GET /me.
      tier allowed    → show the page.
      tier not allowed→ redirect to noAccessPath.
      token invalid   → delete token, redirect to loginPath.
6. Publish the result as window.MemberFrame = { member, tier, can(sectionKey) }
   and fire an event, so every MemberGate, PricingTable, and MemberAccount on the
   page uses the same answer without calling the API again.
```

Details that are easy to miss:

- **Framer changes pages without a full reload.** The script must run its check again on each navigation. Listen for `popstate` and wrap `history.pushState`.
- **Rules are copied into the script, so they go live when the site is published.** After the creator changes page rules, the Access tab shows "Publish your site to apply page changes". Section rules can be refreshed from `/config` at runtime, so they apply without publishing.
- **A plugin can set custom code only once per location.** Put everything in the one `headStart` entry.
- **Fallback.** If custom code is not available on a creator's Framer plan, offer a `PageGuard` component that the creator drops on each restricted page. It runs the same check. Confirm the plan requirement during M5 (see tracker).

---

## 9. Pro Subscription Tracking (Owner Side)

This is the only backend screen, and only you use it.

| Screen | Shows |
| :--- | :--- |
| Sites | Every site: name, URL, owner email, plan, member count, created date. Search and filter by plan. |
| Site detail | Plan, expiry, member count, meta objects (read only), button to set plan by hand. |
| Subscriptions | Payments received for Pro, from the payment provider's webhook. |

How Pro works in the plugin:

1. `GET /api/sites/{siteId}` returns `plan`. The plugin shows a Free or Pro badge.
2. Free plan limits are enforced by the backend, not only by the plugin. Example: member cap, tier count, or the Access tab. See question Q3.
3. "Upgrade to Pro" in Settings opens your checkout page in the browser with `siteId` attached.
4. The payment provider's webhook sets `sites.plan = 'pro'` and `plan_expires_at`.
5. The plugin reads the plan again when it regains focus, and unlocks.

---

## 10. Build Order

Build in this order. Each milestone gives something that works end to end. Task lists are in the development plan.

| Milestone | Result |
| :--- | :--- |
| M0. Clean Foundation | Prototype cleaned up, checks and tests in place |
| M1. Backend Base | Tables, site registration, meta add, edit, delete |
| M2. Plugin Connected | Plugin registers its site, Tiers and Settings save to MySQL |
| M3. Login and Registration | Feature 1 complete. Members appear in the Members tab |
| M4. Tiers on Canvas | Feature 2 complete. `PricingTable` shows real tiers |
| M5. Access Rules | Feature 3 complete. Pages and sections restricted by tier |
| M6. Pro Subscription | Owner admin screen, plan limits, upgrade flow |
| M7. Member Payments | Automatic tier upgrade after payment |
| M8. Release | QA, help docs, Marketplace submission |

Suggested backend stack: Laravel with MySQL, because it has migrations, token sessions, rate limiting, mail, and an admin panel package ready to use. The API in section 3 is the contract, so any stack that serves it works.

---

## 11. Open Questions

| ID | Question | Suggestion |
| :--- | :--- | :--- |
| Q1 | How do members pay the creator for a paid tier? | Version 1: payment link per tier and manual upgrade. Later: Stripe Connect with automatic upgrade. |
| Q2 | Which service sends password reset emails? | Any transactional email service. Needed before M3 can finish. |
| Q3 | What does the Free plan limit? | A member cap per site is the easiest to enforce and explain. |
| Q4 | How do creators pay you for Pro? | A hosted checkout (Stripe or Lemon Squeezy) with a webhook to the backend. |
| Q5 | Email and password, or email code (OTP) login? | Email and password first. It matches "login and registration" and works without sending an email for every login. |
| Q6 | Where is the backend hosted, and under which domain? | Decide before M1. The domain is written into every inserted component. |
