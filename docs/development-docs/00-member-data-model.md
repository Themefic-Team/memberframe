# Member Data Model: Where User Data Lives, And Why Not In The CMS

| Field | Value |
| :--- | :--- |
| Doc | `00-member-data-model.md` |
| Feature | Cross-cutting. Underpins F01, F02, F05, F09, F16, and every feature plan that reads a member |
| PRD | Sections 10, 11, 14.1. No F number |
| Phase | 1 |
| Priority | P0 |
| Status | in progress |
| Written | 2026-10-12, before the FP-02 code |

---

## 1. The Question And The Answer

The question asked was: **how do we store user data, and should it go in the Framer CMS?**

**No. Member data must never go in a Framer CMS collection, and never in plugin data.** It lives in
the backend database, keyed by `siteId`, exactly as PRD section 11 already specifies: "Owned by the
backend repository."

That is not a preference. Three of the five reasons below are structural, meaning no amount of
careful coding makes the CMS work for this. Section 3 gives the reasons, section 5 gives the schema,
and section 6 is a table of every piece of user data with its one correct home.

---

## 2. The Short Version

| Store | What it is for in this product | Member data? |
| :--- | :--- | :--- |
| Backend database | Every member record, subscription, invoice, progress row, bookmark | **Yes. All of it** |
| HTTP-only cookie on the published site | The member's session, set by the backend | Session only, never readable by JavaScript |
| Framer CMS collection | Creator content. F09 **reads** collections to gate them | **Never** |
| `framer.setPluginData` | Creator's plugin preferences, 2kB, arrives at task 5.6 | **Never** |
| `localStorage` in the panel | Active tab, theme preference | **Never.** No tokens either |
| `sessionStorage` on the site | FP-09's onboarding draft answers only, pre-save | Draft only, cleared on save |

---

## 3. Why The CMS Cannot Hold Member Data

### 3.1. The Decisive Reason: Only The Creator's Editor Can Write To It

A CMS collection is written through the plugin API, and the plugin API runs inside the Framer editor
on the creator's machine. `ManagedCollection.addItems` is a method on an object you obtain from
`framer.getActiveManagedCollection()`, which resolves only when the plugin is running in
`configureManagedCollection` or `syncManagedCollection` mode.

A visitor signing up at 03:00 has no Framer editor open. There is no process running that could
write their row. **The CMS physically cannot record a signup**, whatever permissions were declared.

This is worth stating plainly because it kills the idea completely rather than making it merely
unwise. Everything below is a reason it would also be a bad idea if it were possible.

### 3.2. A Collection Is Published Site Content

Collection items become routes on the published site. Framer's own framing for managed collections
is syncing data between Framer and a third party, for content a designer binds to a layout. There is
no notion of a viewer in the API at all.

"Not linked from any page" is not privacy. A third-party Framer security checklist specifically
warns that publishing can make items reachable even when no menu links to them, and that preview
links can bypass page password protection and expose drafts. Audit your sitemap, not your menus.

So a `Members` collection would be a published, enumerable list of your customers' email addresses.

### 3.3. There Is No Row-Level Access Control, Because There Is No Viewer

Read the `ManagedCollection` surface in `framer-plugin` 3.10.3. It is `getItemIds`, `setItemOrder`,
`getFields`, `setFields`, `addItems`, `removeItems`, `setAsActive`, plugin data, and `navigateTo`.

There is no owner field, no viewer identity, no rule language, no per-item visibility. Entitlement
in this product is decided by `isEntitled` in PRD section 11.3, reading a session the CMS has never
heard of. A store with no concept of "who is asking" cannot hold data that is private per person.

### 3.4. A Code Component Ships To The Browser, Credentials And All

`MemberGate.tsx` and `MemberAuth.tsx` are compiled into the creator's published site. Anything they
would need in order to read a private store, a key or a token, ends up in the client bundle and is
readable with DevTools. The same security checklist flags this directly, and the fix it recommends
is a server-side proxy, which is what the backend already is.

This is also why the session is an HTTP-only cookie. The component never holds a token, so there is
no token in the bundle to steal. See `05-member-auth.md` section 3.

### 3.5. The Shape Is Wrong Even Ignoring All Of The Above

A managed collection supports up to 30 custom fields of CMS field types. PRD section 11.2 needs: a
unique constraint on `email` scoped per site, AES-256-GCM encrypted columns, soft delete that
preserves invoice history, integer minor units for money, UTC timestamps, and a `PluginTrial` ledger
whose rows are never deleted. A CMS field list expresses none of these, and there is no field type
whose purpose is "Argon2id hash".

---

## 4. Why Not `setPluginData` Either

Tempting because it is already in the roadmap at task 5.6, and wrong for three reasons:

1. **2kB per key.** CLAUDE.md records this and prescribes differential compression for creator
   preferences. One member record with custom fields would approach that on its own.
2. **It is project metadata, not private storage.** It persists into the project file. Anyone the
   creator shares the project with can read it, and it syncs wherever the project syncs.
3. **Same write-path problem as 3.1.** It is a plugin API, so it needs the editor open.

It is the right store for exactly what task 5.6 uses it for: the creator's own plugin preferences.

---

## 5. What We Actually Track Per User

This is the "track each user data structure" half of the question. The backend owns these tables;
the plugin and the canvas components own a TypeScript mirror of the parts they are allowed to see.

### 5.1. The Member Record, Server Side

```
Member
  id                  uuid, primary key
  site_id             uuid, foreign key. Scopes everything
  email               citext. UNIQUE (site_id, email), not globally unique, per PRD 11.2
  email_verified_at   timestamptz, nullable
  password_hash       text, nullable. Argon2id. NULL for an OTP-only or SSO-only member
  password_updated_at timestamptz, nullable
  name                text, nullable
  active_tier         text. Foreign key to Tier.key within the site
  status              enum: active | trialing | past_due | canceled
  metadata            jsonb. FP-09 custom profile fields. See 5.4
  failed_login_count  integer, default 0. FP-02 lockout
  locked_until        timestamptz, nullable. FP-02 lockout
  last_login_at       timestamptz, nullable
  created_at          timestamptz
  deleted_at          timestamptz, nullable. Soft delete, per PRD 11.2
```

Three fields exist because of FP-02 specifically: `password_hash`, `failed_login_count`, and
`locked_until`. `password_hash` is nullable on purpose. A member who signed up with Google has no
password, and the sign-in endpoint must treat "no password set" as a failed credential check rather
than as a reason to let them in.

### 5.2. What The Client Is Allowed To See

`MemberSessionData`, already in [`src/types/member.ts`](../../src/types/member.ts) and mirrored
inside both canvas components. Seven fields plus the one PRD section 11.3 reads:

```typescript
interface MemberSessionData {
  memberId: string;
  email: string;
  name: string | null;
  activeTier: string;
  status: "active" | "trialing" | "past_due" | "canceled";
  currentPeriodEnd: number;      // Unix seconds, UTC
  gracePeriodEndsAt: number;     // Unix seconds. Conflict C1
  siteId: string;
}
```

**Nothing about the password appears here, including whether one is set.** That is deliberate: a
response saying `hasPassword: false` for one address and `true` for another is a user-enumeration
oracle, and FP-02 section 3.4 rule 3 forbids exactly that.

### 5.3. Related Tables, Already In PRD 11.1

`Subscription`, `Invoice`, `CourseProgress`, `Bookmark`, `OrganizationSeat`, `MeteredSession`, and
`PluginTrial`. All keyed to `Member` or to `Site`. No feature plan needs a new top-level entity, and
FP-09 deliberately does not add one.

### 5.4. Custom Profile Fields Go In One `jsonb` Column

FP-09 lets a creator define arbitrary fields. Two ways to store that, and the choice matters:

- **A table per creator-defined field.** Schema migrations at runtime, driven by creator input. No.
- **One `jsonb metadata` column, with the definitions in `CustomFieldDefinition` rows.** Definitions
  are structured and validated; values are a bag. One column, no runtime migrations, and the
  validation rules live where they can be tested.

The second. It is what FP-09's own `MemberMetadata` interface already describes.

---

## 6. The Decision Table

Every piece of user data in the fourteen feature plans, with its one home.

| Data | Lives in | Never in |
| :--- | :--- | :--- |
| Email, name, tier, status | Backend `Member` | CMS, plugin data |
| Password hash | Backend `Member`, Argon2id | Anywhere else. The client never sees or stores it |
| Plaintext password | Nowhere. In a React input's value for the duration of one submit, then cleared | State after submit, storage, logs, the URL, telemetry |
| Session token | HTTP-only `Secure` `SameSite` cookie, set by the backend | `localStorage`, `sessionStorage`, a JS variable, a component prop |
| Password reset token | The emailed URL, and the backend | Logs, telemetry, browser history after use. See `05-member-auth.md` section 9.6 |
| Custom profile fields | Backend `Member.metadata` jsonb | CMS |
| Onboarding draft answers, FP-09 | `sessionStorage` on the visitor's own browser, until saved | The backend, until the member submits |
| Course progress, bookmarks | Backend, keyed to `Member` | CMS, `localStorage` |
| Gateway secret keys | Backend, AES-256-GCM, masked suffix only on read | Any client response. Enforced by a test over the settings subtree |
| Creator's plugin preferences | `setPluginData`, 2kB, task 5.6 | Backend. It is not their data |
| Active tab, panel theme | Panel `localStorage` | Anywhere that matters |
| Creator session token | Undecided. **Conflict C10, no task builds it** | Not resolved here |

---

## 7. What The CMS Is Legitimately For

Worth saying, so this doc does not read as "the CMS is bad".

**F09, CMS item-level gating**, is the one feature that touches collections, and it **reads** them.
A creator has a collection of lessons; F09 gates them per item by reading the collection and
applying `isEntitled` to the visitor's session. The collection holds lessons. The membership lives
in the backend. The gate joins the two at render time.

That is the correct relationship and it is the inverse of storing members in the CMS.

---

## 8. Build Decisions

1. **Member data lives in the backend, per PRD section 11.** Confirmed against the question asked,
   not assumed. Sections 3 and 4 give the reasons.
2. **`password_hash` is nullable.** An SSO-only member has no password. The sign-in path treats
   `NULL` as a failed check, never as a bypass.
3. **No field on any client response reveals whether a password is set.** Enumeration oracle.
4. **Custom fields are one `jsonb` column, not a table per field.** No creator-driven migrations.
5. **Argon2id over bcrypt, as a recommendation to the backend.** bcrypt silently truncates at 72
   bytes, so with bcrypt two different long passwords can unlock the same account. Recorded as
   conflict C15 in the ledger because the PRD does not choose, and FP-02 names both.
6. **The client enforces a password policy as a hint, and says so.** Section 9.3 of
   `05-member-auth.md`. A regex in a bundled component is not a security control.

---

## 9. Verified By Whom

| Claim | How it was checked | Needs a human |
| :--- | :--- | :--- |
| `ManagedCollection` has no access-control surface | Read the class in `node_modules/framer-plugin/dist/index.d.ts` lines 2626 to 2695 | No |
| Managed collections need two plugin modes this plugin does not declare | SDK `PickModes<"collection" \| "syncManagedCollection" \| "configureManagedCollection">`, and `framer.json` declares `["canvas"]` | No |
| Published CMS items are reachable even when unlinked | Third-party Framer security checklist. **Not an official Framer statement** | Yes. Confirm against current Framer docs or support before quoting it externally |
| Code components are bundled into the published site | Same checklist, and it matches how `createCodeFile` works | No |
| 30 custom fields per managed collection | Framer developer docs | Low risk, worth re-reading at F09 |

The third row is the one to treat with care. The conclusion does not depend on it, because 3.1
alone settles the matter, but do not repeat that specific claim to a customer without checking it.

Sources consulted:
[Framer CMS developer docs](https://www.framer.com/developers/cms),
[managed collection reference](https://www.framer.com/ja/developers/reference/plugins-managed-collection),
[a third-party Framer security checklist](https://vibe-eval.com/checklists/framer/).
