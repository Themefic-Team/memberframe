# MemberFrame Backend PRD

> **Document**: Backend-only product and technical requirements
> **Stack**: Node 20+, Express, Prisma ORM, MySQL 8.0+. TypeScript throughout
> **Location**: `backend/` in this repository. See section 1.2
> **Revised**: 2026-10-12. Replaced Laravel and Vue with Node and Prisma, and
> removed the creator dashboard, at the user's direction. Section 1.3 records
> what that changed and what it cost
> **Supersedes**: the stack and schema halves of [`features-plan/15. Backend Architecture & Development Flow (Laravel & Vue).md`](features-plan/15.%20Backend%20Architecture%20&%20Development%20Flow%20(Laravel%20&%20Vue).md)
> **Synced against**: [`memberframe-complete-prd.md`](memberframe-complete-prd.md) sections 2.3, 6, 10, 11, 14, and [`development-docs/00-member-data-model.md`](development-docs/00-member-data-model.md)
> **Written**: 2026-10-12
> **Status**: ready for review. Not started

---

## 1. What This Document Is

### 1.1. Purpose

The main PRD specifies the backend as a **consumed contract** and explicitly does not build it. Section
10.1 draws that line: this repository owns request shapes, error handling, and degraded UI, and a
separate repository owns persistence, webhooks, OTP dispatch, signing, and jobs.

This document is that separate repository's specification. It is the only place where the backend's
schema, endpoints, and build order are authoritative.

### 1.2. One Repository, Two Packages

```
memberframe/
  src/                   Framer plugin panel and 15 canvas components
  test/                  453 tests
  package.json           Vite, React, TypeScript

  backend/               THE API. Its own package, its own node_modules
    src/                 Express, Prisma, TypeScript
    prisma/schema.prisma MySQL models
    test/                67 tests
    package.json         Node 20+, no dependency on the parent

The contract between them is section 6.
```

**They share a git repository and nothing else.** Separate `package.json`,
separate `node_modules`, separate `tsconfig.json`, separate test runners. The
root `tsconfig.json` includes only `src` and `test`, and the root vitest config
includes only `test/**`, so `npm run build` and `npm test` at the root neither
see nor need the backend. Verified: all four root gates pass unchanged with the
backend present.

**The one deliberate coupling** is `backend/test/parity.test.ts`, which reads
the frontend's source across the directory boundary to check that the three
copies of `isEntitled` and the password policy have not diverged. Section 10
explains why that coupling is worth having, and it is the single biggest
practical gain from sharing a repository.

The frontend's base URL lives in [`src/config/backend.ts`](../src/config/backend.ts) and is baked into
each generated canvas component at deploy time. Nothing is hardcoded at a call site.

### 1.3. What Changed From FP-15, And From The First Draft Of This Document

FP-15 proposed Laravel 11, PostgreSQL, Redis, and a Vue 3 creator dashboard.
The first draft of this document kept the shape and corrected four things. The
stack has since changed again, at your direction, and the table below is the
current state of every deviation.

| FP-15 said | Now | Why |
| :--- | :--- | :--- |
| Laravel 11.x | **Node 20+, Express, TypeScript** | Your decision. Laravel 11 was also end of life as of March 2026, so the PHP path would have meant Laravel 13 anyway |
| PostgreSQL 16 | **MySQL 8.0+** | Your decision. Section 4.2 names the four conversions that are not mechanical |
| Hand-written SQL migrations | **Prisma ORM** | Your decision. Section 5.3 records the three things Prisma cannot express and how they are handled |
| Redis and Horizon from day one | **Deferred** | Section 4.3. Webhook idempotency moves to a MySQL table, which is a stronger guarantee than the cache it replaces |
| A full Vue 3 creator dashboard | **Not built at all** | Your decision, and it resolves conflict C19 in the strongest possible way. Section 8 |

**Three consequences of dropping the dashboard, stated plainly**, because
removing a component removes its responsibilities too and those have to land
somewhere:

1. **Everything creator-facing now lives in the Framer plugin panel**, which is
   what PRD section 2.3's In-Framer-First Mandate wanted. The members table,
   the tier editor, and the gateway vault already exist there, built at tasks
   2.2 to 2.4, so nothing is lost.
2. **Four things FP-15 gave the dashboard now have no home**: the multi-site
   agency switcher, asset uploads with a real file picker, revenue charts, and
   MemberFrame's own billing for creators. Section 8.2 is the revised list and
   it is shorter than the problem.
3. **Creator authentication still has to exist**, dashboard or not, because
   every `/api/site/*` endpoint needs it. That is conflict C10 and it is
   unchanged.

**What the TypeScript choice bought**, since it was not forced: the backend can
hold a textually identical copy of `isEntitled` and the password policy, and a
test can compare all three copies mechanically. In PHP those would have been
reimplementations, checkable only by a shared fixture of inputs and expected
outputs. PRD section 11.3 calls divergence between the copies a security defect,
and this is the difference between checking for it by diff and checking for it
by sampling.

## 2. The Sequencing Question, Answered

You asked whether to build all the Framer features first and then the backend. **No, and not the
reverse either.** Do a three-day spike first, then run the two tracks in parallel.

### 2.1. Why Not All Frontend First

The evidence is already in this repository. Phase 1 is feature complete and **four of its seven exit
criteria cannot pass** because nothing exists to talk to. That is tolerable for one phase. The
problem is what it costs to keep going.

Building FP-02 required inventing endpoints. I declared six member routes that the main PRD does not
contain, and **two of them do not appear in FP-15 either**: `forgot-password` and `reset-password`.
So the password reset flow that FP-02 asks for has no backend route in any document, including the
backend plan written after it.

That is the pattern to avoid repeating twelve more times. Every guessed contract that turns out wrong
costs a canvas component edit, its parity test, its development doc, and a re-verification in Framer.
The cost is paid per feature and it compounds.

### 2.2. Why Not All Backend First

The request shapes come from the features. Building twenty endpoints with no consumer produces a
plausible API that fits nothing, and you discover the mismatch at integration time, which is the most
expensive moment to discover it.

### 2.3. What To Do Instead

**Stage 0, about three days: the cross-origin cookie spike. Before anything else.**

Build a skeleton with exactly two endpoints: one that sets a session cookie and one that
reads it. Deploy it to real HTTPS. Put the existing `<MemberGate>` and `<MemberAuth>` on a real
published Framer site. Answer one question:

> Does the session cookie survive the cross-site round trip, and in which browsers?

Section 4.1 explains why this is the single highest-risk assumption in the whole architecture and why
three days now can save six weeks. **Do not skip it and do not do it fifth.** It is the one test
whose result can invalidate work already finished.

**Stage 1, parallel, about two weeks.**

| Backend track | Frontend track |
| :--- | :--- |
| Schema and migrations, section 5 | FP-01, Lock Pages, which reuses the existing gate |
| Multi-tenancy and the site key, section 3 | **Verify the deploy path in Framer.** It has never run |
| The six auth endpoints, section 6.2 | Fix whatever the Stage 0 spike broke |
| `GET /api/member/session` | |

The frontend track here deliberately contains no new backend dependency. The deploy-path
verification is the other large unknown in this repository and it is independent of the backend
entirely: `createCodeFile` and `addComponentInstance` have never run against a real Framer project.

**Stage 2, about one week: close Phase 1.** Wire the plugin to the live API, then run the Phase 1
exit criteria for real. A visitor signs in, pays, and the gate unlocks. Nothing before this point can
prove the product works.

**Stage 3: the remaining twelve feature plans, each one frontend and backend together.** By now the
contract is proven rather than proposed, the cookie question is settled, and a feature can be built
once.

### 2.4. The One Case For Doing More Frontend First

If the goal in the next month is a **demo or a marketplace listing** rather than a working product,
the calculation changes. Canvas components render their locked state without any backend, so a
convincing walkthrough of gating, tiers, and the builder is achievable with no API at all.

That is a real strategy and it is not what you asked for, but it is worth naming so the choice is
deliberate. If that is the goal, say so and the order changes.

---

## 3. Multi-Tenancy

### 3.1. The Tenant Is A Site, Not A User

One creator can own several Framer projects, and an agency owns dozens. Every row that belongs to a
member, tier, subscription, invoice, asset, or custom field carries `site_id`, and no query may omit
it.

Enforced in three layers, because one is not enough:

1. **A global Eloquent scope** on every tenant-owned model, applied by a trait, so a forgotten
   `where` clause cannot leak.
2. **Foreign keys with `ON DELETE CASCADE`** to `sites`, so an orphan row cannot exist.
3. **A test that fails the build**: site A requests site B's member by ID and must receive a 404, not
   a 403. A 403 confirms the row exists, which is itself a leak.

PRD section 16.4 lists "a member of site A cannot read any record belonging to site B" as a release
blocker. Point 3 is how that gets checked rather than asserted.

### 3.2. How A Request Says Which Site It Is For

This is the one place where FP-15, the main PRD, and the code I have already written all disagree, so
it needs settling here.

- FP-15 puts `siteId` in every request body.
- The main PRD does the same for creator endpoints.
- `<MemberAuth>` as built sends **no** `siteId`, on the grounds that a client-supplied tenant ID is a
  cross-site read waiting to be tried. That was conflict C17.

All three are partly wrong. The resolution:

**A public `site_key` identifies, and the `Origin` header verifies.**

```
POST /api/member/login-password
X-MemberFrame-Site: mf_site_7f3a9c21b48e5d60
Origin: https://creatorsite.com

{ "email": "...", "password": "..." }
```

The backend looks up the site by key, then checks that the request `Origin` is in that site's
allowlist. The key identifies and is not a secret, exactly like a Stripe publishable key. The origin
check is what makes it unusable from anywhere else.

Why not origin alone, which is what I built: a creator's site may be on a custom domain, on
`*.framer.website`, or on a Framer preview URL, and the backend needs a per-site origin allowlist for
CORS anyway. Resolving the tenant from a registry keyed by a value the component already carries is
both simpler and stricter.

Why not a bare `siteId`: a sequential or guessable tenant ID in a request body invites substitution.
A random 64-character key does not, and pairing it with the origin check means a stolen key is
useless off the creator's own domain.

**The generator already bakes `apiBaseUrl` into each component**, so baking `siteKey` the same way is
no new mechanism. See [`canvasComponentCodeGenerator.ts`](../src/services/canvasComponentCodeGenerator.ts).

### 3.3. Two Kinds Of Identity, Never Confused

| | Creator | Member |
| :--- | :--- | :--- |
| Who | Owns Framer projects, pays MemberFrame | Visits a creator's site, pays the creator |
| Table | `users` | `members` |
| Scope | Owns many `sites` | Belongs to exactly one `site` |
| Authenticates for | The plugin panel and the web dashboard | The published site |
| Credential | Bearer token, held by the plugin panel | HTTP-only cookie on the published site |
| Email uniqueness | Global | **Per site.** PRD section 11.2 |

A member of two creators' sites is two rows. The same human may be both a creator and a member of
someone else's site, and those are unrelated records with unrelated passwords.

**This resolves conflict C10**, the schedule defect found in Week 2: nothing in the 72-task plan built
creator authentication, so the Manage and Settings tabs render permanently signed out. The `users`
table and the plugin bearer token are what unblock them.

---

## 4. Three Decisions That Shape Everything Else

### 4.1. The Cross-Origin Session Cookie Is The Highest Risk In This Architecture

A canvas component runs on `creatorsite.com` and calls `api.memberframe.framefic.com`. The session
arrives as an HTTP-only cookie, per PRD section 14.1 S2 and reiterated in
[`00-member-data-model.md`](development-docs/00-member-data-model.md). That cookie is, by definition,
a **third-party cookie**.

What the research says, and it is not comfortable:

- **Safari blocks third-party cookies by default** and has since 2020, through Intelligent Tracking
  Prevention. That is desktop Safari and every browser on iOS.
- **Firefox partitions them** rather than blocking outright, under Total Cookie Protection.
- **Chrome did not deprecate them.** Google confirmed it will keep the existing controls rather than
  ship the planned prompt, and most of the Privacy Sandbox replacement APIs were retired in October
  2025.
- Roughly 18.6 percent of global browser traffic blocks third-party cookies by default, per a
  secondary source citing StatCounter. Treat the number as indicative, not exact.

So the design works in Chrome and probably in Firefox, and **is blocked in Safari**, which is most of
mobile. That is not a detail. Every member-facing feature in all fourteen plans depends on this one
mechanism.

**The mitigation, in order of preference:**

1. **Add the `Partitioned` attribute** (CHIPS) alongside `SameSite=None; Secure; HttpOnly`. A
   partitioned cookie is keyed to the top-level site, so `api.memberframe` cookies set while browsing
   `creatorsite.com` are stored and sent only for that site. Chrome and Firefox honour it.
   **For this product the partitioned semantics are the correct ones anyway**: a member of site A
   should not share a session with site B, and PRD section 11.2 already makes member email unique per
   site rather than globally. Safari does not support CHIPS, so this does not fix Safari.
2. **A first-party subdomain per creator site**, the path Stripe and Auth0 take. The creator points
   `members.creatorsite.com` at MemberFrame by CNAME, the API is served there, and the cookie becomes
   first-party and works everywhere. The cost is DNS setup, which is real friction for a Framer
   designer, and TLS certificate issuance per custom domain. Offer it as the documented upgrade for
   creators who need iOS to work.
3. **A short-lived token held in memory**, obtained through the same popup and `postMessage` handshake
   `<MemberAuth>` already implements for OAuth. Works in Safari, survives no page reload, and puts the
   token where XSS can read it, which is the exact thing S2 forbids. **The least good option** and
   the one to reach for only if 1 and 2 both fail.

**Why this is Stage 0 and not Stage 5**: options 1 and 2 are a configuration change to the backend
plus, for option 2, a creator onboarding step. Option 3 is a rewrite of the session handling in every
canvas component, and it changes a security requirement the whole data model was built around.
Finding out which one you need costs three days now. Finding out after twelve more features are built
costs six weeks and a security review.

**Record the spike result here before Stage 1 begins:**

| Browser | Cookie set | Cookie returned | With `Partitioned` | Notes |
| :--- | :--- | :--- | :--- | :--- |
| Chrome desktop | | | | |
| Safari desktop | | | | |
| Safari iOS | | | | |
| Firefox desktop | | | | |
| Chrome Android | | | | |

### 4.2. MySQL Changes Four Things That Are Not Find-And-Replace

Section 5 has the full schema. These four are the ones where a mechanical translation produces a bug:

**Primary keys.** FP-15 uses `UUID DEFAULT gen_random_uuid()`, meaning UUIDv4. MySQL InnoDB
clusters rows by primary key and copies that key into every secondary index, so a random v4 scatters
inserts across pages, fragments the index, and repeats 36 bytes everywhere.

Use **UUIDv7**, which Prisma generates with `@default(uuid(7))` from version 5.18 onward. It is
time ordered, so inserts append rather than scatter, and it needs no application code. The first
draft of this document recommended ULID for the same reason; UUIDv7 gets the same ordering property
and is a built-in Prisma default, where ULID is not. Verified against the installed Prisma 5.22:
`prisma generate` accepts the schema.

Avoid `cuid()`. Prisma still offers it and the original CUID specification is deprecated for
security reasons.

**Case-insensitive email.** There is no `CITEXT`. MySQL 8's default collation is already
case-insensitive, so the behaviour comes free, but the default is also **accent-insensitive**, which
would make `jose@x.com` and `josé@x.com` the same mailbox. They are not. Pin the email columns to
`utf8mb4_0900_as_ci`: accent sensitive, case insensitive.

**Timestamps.** `TIMESTAMPTZ` becomes `DATETIME`, never `TIMESTAMP`. MySQL's `TIMESTAMP` is four
bytes and **ends in 2038**, and `current_period_end` for a lifetime membership is a date past 2038.
That is a real bug, not a theoretical one. Use `DATETIME`, store UTC, and set the connection timezone
to `+00:00` so MySQL performs no implicit conversion. PRD section 11.2 already requires UTC storage.

**Soft delete with a unique email.** PRD section 11.2 requires soft delete on `members` to preserve
invoice history, and unique email per site. PostgreSQL expresses that with a partial index
`WHERE deleted_at IS NULL`. **MySQL has no partial indexes**, and the obvious workaround is wrong:
`UNIQUE(site_id, email, deleted_at)` permits unlimited active duplicates, because MySQL treats each
`NULL` as distinct in a unique index. Use a generated column instead:

```sql
active_email VARCHAR(255) GENERATED ALWAYS AS (IF(deleted_at IS NULL, email, NULL)) STORED,
UNIQUE KEY uniq_site_active_email (site_id, active_email)
```

One active row per address, any number of deleted ones, and a deleted member can re-register.

### 4.3. No Redis Yet, And The Idempotency Guarantee Gets Stronger

FP-15 specifies Redis and Horizon from day one, and puts webhook idempotency in a Redis cache with a
24-hour window. Three reasons to start without it:

**Webhook idempotency belongs in the database, not a cache.** PRD section 10.5 requires that "a
replayed webhook must not double-apply", and that is a correctness guarantee. A Redis key can be
evicted under memory pressure, and a gateway can legitimately replay an event days later. A
`webhook_events` table with `UNIQUE(gateway, event_id)` makes double application **impossible at the
storage layer** rather than unlikely. Insert first, process second: if the insert fails on the unique
key, the event was already handled. This is strictly better than the plan.

**There is no queue yet, and email sends inline.** `sendMail` never throws, so a provider outage
cannot turn `forgot-password` into a 500 and thereby reveal which addresses are registered. What it
does cost is latency: a slow SMTP handshake is time the member spends watching a spinner. A job
table is the fix when that becomes visible, and it is deliberately not built before anyone has
measured it.

**Rate limiting is in memory**, in `backend/src/middleware/rateLimit.ts`, which is a real limitation
and is stated in that file: it resets on restart and does not coordinate across processes, so two
instances behind a load balancer double every limit. Acceptable at one process, not acceptable at
scale. The five-failure account lockout is **not** in memory, because a lockout a restart clears is
not a lockout: it lives in `members.locked_until`.

**When to add Redis**, so this is a deferral and not a refusal: when queue depth stays above a few
hundred jobs, when OTP dispatch latency becomes visible to members, or when rate-limit writes start
showing in slow query logs. Moving to Redis is a configuration change at that point, not a rewrite,
**provided the idempotency table stays in MySQL**. It should.

---

## 5. The Schema

Prisma, MySQL 8. **Written and generating**: [`backend/prisma/schema.prisma`](../backend/prisma/schema.prisma).

### 5.1. What Is Declared

Only the models the implemented routes need. The repository's own rule is to
declare nothing preemptively, the same way `framer.json` adds a permission in
the task that first needs it.

| Model | Purpose |
| :--- | :--- |
| `User` | A creator. Owns sites, pays MemberFrame |
| `Site` | The tenant. One Framer project, with its site key and origin allowlist |
| `Tier` | A membership plan. `rank` unique per site, which is the constraint that matters most |
| `Member` | A visitor to a creator's site. Email unique per site, soft deleted |
| `MemberSession` | An opaque server-side session. Hashed token, revocable |
| `MemberPasswordReset` | Hashed, single use, fifteen minutes |
| `MemberOtp` | Hashed six-digit code, three attempts |
| `EmailLog` | Every send attempt. Recipient and subject, never the body |

Deferred to the feature that needs them, each named in the schema file so the
next person does not go looking: `gateway_configs`, `subscriptions`,
`invoices`, `webhook_events`, `custom_fields`, `assets`, `course_progress`,
`bookmarks`, `organizations`, `metered_sessions`, `plugin_trials`.

### 5.2. Three Things Prisma Cannot Express

Handled in a hand-written migration that `prisma migrate dev` will not
regenerate or overwrite:
[`backend/prisma/migrations/20261012000001_mysql_specifics/migration.sql`](../backend/prisma/migrations/20261012000001_mysql_specifics/migration.sql).

**Column collation.** Prisma models a column type, not its collation. MySQL 8's
default is case insensitive, which is what `CITEXT` gave us for free, and also
**accent insensitive**, which would make `jose@example.com` and the accented
spelling the same mailbox. They are two mailboxes. Every email column is pinned
to `utf8mb4_0900_as_ci` by hand.

**The generated `active_email` column.** Prisma does not model generated
columns. This is the one that would be a real bug if skipped, and section 4.2
explains why the obvious MySQL workaround is wrong.

**The supporting index on `(site_id, email)`.** `active_email` covers lookups
for live members. This covers the other case: whether an address was ever
registered here, deleted rows included.

`npm run db:check` verifies all three are present and fails if they are not,
because a database that migrated without them looks completely healthy and
permits two live members to share an address.

### 5.3. Conventions Pinned In Code

```prisma
// Every timestamp. Not TIMESTAMP, which ends in 2038, and a lifetime
// membership's currentPeriodEnd is past 2038.
createdAt DateTime @default(now()) @map("created_at") @db.DateTime(3)
```

Prisma maps `DateTime` to `DATETIME(3)` on MySQL by default rather than
`TIMESTAMP`, so the 2038 problem is avoided without intervention. The precision
is pinned explicitly anyway: leaving it implicit is a known source of phantom
migration diffs, because MySQL requires the same fractional precision
throughout a column definition.

Snake-case column names via `@map`, camelCase in TypeScript. The database reads
like SQL and the code reads like TypeScript, and neither has to compromise.

## 6. The API Contract

### 6.1. Reconciling Three Documents That Disagree

The main PRD section 10, FP-15 section 4, and the code already written in this repository disagree on
several paths. **The code is already deployed inside generated canvas components on creators' sites**,
which makes it the most expensive to change, so it wins unless it is wrong.

| Purpose | Main PRD | FP-15 | Built | **Authoritative** |
| :--- | :--- | :--- | :--- | :--- |
| Member session | `/api/member/session` | same | same | `/api/member/session` |
| Checkout | `/api/checkout/create-session` | `/api/checkout/session` | `/api/checkout/create-session` | **`/api/checkout/create-session`** |
| Billing portal | `/api/member/billing-portal-session` | `/api/member/billing-portal` | not built | **`/api/member/billing-portal-session`** |
| Send OTP | absent | `/api/member/send-otp` | `/api/member/send-otp` | `/api/member/send-otp` |
| Verify OTP | absent | `/api/member/verify-otp` | `/api/member/verify-otp` | `/api/member/verify-otp` |
| Register | absent | `/api/member/register` | `/api/member/register` | `/api/member/register` |
| Password sign-in | absent | `/api/member/login-password` | `/api/member/login-password` | `/api/member/login-password` |
| Forgot password | absent | **absent** | `/api/member/forgot-password` | **`/api/member/forgot-password`** |
| Reset password | absent | **absent** | `/api/member/reset-password` | **`/api/member/reset-password`** |

The last two rows are the point of section 2.1. FP-02 asked for a password reset flow, I built it, and
**neither the main PRD nor the backend plan contains a route for it.** Conflict C11 in the ledger now
covers six member routes that exist only because a component needed them.

### 6.2. Member Runtime Endpoints

Every one of these is called from a canvas component on a published site. Every one carries
`X-MemberFrame-Site` and is subject to the origin check in section 3.2.

```
GET /api/member/session
  200 { member: MemberSessionData, tiers: TierLadderEntry[] }
  401 { }                                      not signed in, which is not an error
```

**Two things the response must carry that the main PRD's `MemberSessionData` does not.**

`gracePeriodEndsAt`, because `isEntitled` reads it to decide whether a `past_due` member still has
access. The specified interface has seven fields and the resolver needs eight. That is conflict C1 and
this is its resolution: the field is required, as Unix seconds, and is `0` when no grace window
applies.

`tiers`, the site's tier ladder, because the resolver compares `held.rank >= required.rank` and the
component cannot know the ladder otherwise. Today both canvas components ship a hardcoded default
ladder, which is conflict C5. Returning it here retires that default and also retires conflict C9,
because the generator can then emit the site's real tier keys as the gate's `Enum` options instead of
a fixed list of four.

```
POST /api/member/send-otp        { email }
  200 { expiresInSeconds: 600, resendAfterSeconds: 60 }
  429 { reason: "rate_limited", retryAfterSeconds }

POST /api/member/verify-otp      { email, code }
  200 { member } + Set-Cookie
  401 { reason: "invalid_code" | "expired_code" | "too_many_attempts" }

POST /api/member/register        { email, password, name }
  200 { member } + Set-Cookie
  400 { reason: "weak_password" | "email_already_exists" }

POST /api/member/login-password  { email, password, rememberMe }
  200 { member } + Set-Cookie
  401 { reason: "invalid_credentials" | "account_locked" }
  429 { reason: "rate_limited", retryAfterSeconds }

POST /api/member/forgot-password { email }
  200 { }                                      always, registered or not

POST /api/member/reset-password  { token, newPassword }
  200 { }                                      and every other session is invalidated
  400 { reason: "token_expired" | "invalid_token" | "weak_password" }

POST /api/member/logout
  200 { }                                      clears the cookie

GET  /api/member/oauth/{provider}              starts the popup flow
POST /api/checkout/create-session { tier, interval }
  200 { checkoutUrl }
POST /api/member/billing-portal-session
  200 { portalUrl }
```

**Four behaviours the client cannot verify and the backend must guarantee.** These are named here
because they are the ones most likely to be quietly missing in a first implementation:

1. `login-password` takes the **same time** for an unknown address as for a wrong password. Compare
   against a dummy hash when the member does not exist, so the absence of a hash operation is not a
   timing oracle. A `NULL` `password_hash` takes the same path.
2. `forgot-password` returns 200 and sends nothing when the address is unknown, with the same latency.
3. `reset-password` invalidates **every other session** for that member. This is what makes a reset a
   recovery rather than a password change.
4. Account lockout is five consecutive failures for fifteen minutes, per FP-02 section 3.4, counted
   per member and not per IP, with the counter cleared on success.

### 6.3. Plugin And Dashboard Endpoints

Authenticated as a creator, never by site key. See section 3.3.

```
POST  /api/auth/send-otp            creator sign-in to the plugin
POST  /api/auth/verify-otp          200 { token, user }
GET   /api/site/config
POST  /api/site/config
GET   /api/site/members             ?page=&search=&tier=&status=   paginated at 25
PATCH /api/site/members/{id}
POST  /api/site/members/{id}/magic-link
GET   /api/site/tiers
POST  /api/site/tiers               rank uniqueness enforced in the database
PATCH /api/site/tiers/{id}
POST  /api/site/gateway/validate    validates without storing
```

Pagination is 25 per page because the plugin's members table is built for it.

**`GET /api/site/config` must never return a secret**, not even masked beyond a suffix. PRD section
16.4's first release blocker is "no gateway secret appears in any client response, verified by
inspecting every payload", and a test should inspect the payload rather than trusting the serializer.

### 6.4. The Error Contract Is Already Written And Already Tested

PRD section 10.6 defines five client behaviours, and
[`src/services/apiClient.ts`](../src/services/apiClient.ts) implements them as a five-arm
discriminated union with 32 tests. **The backend must return the statuses that union expects:**

| Status | Client arm | Client behaviour |
| :--- | :--- | :--- |
| 2xx | `ok` | proceed |
| 401 | `unauthorized` | treat as signed out, show the locked state |
| 403 | `forbidden` | signed in, not entitled |
| 429 | `rate_limited` | show the wait, **never retry automatically** |
| anything else | `unavailable` | fail closed, show a degraded state |

Everything unrecognised falls into `unavailable`, including a 4xx not in this table, a 3xx, a
timeout, and malformed JSON. **A backend that returns 400 where it means 401 will make a signed-out
visitor see a generic failure instead of a sign-in prompt.** That mapping is tested on the client and
unverified against a server, which is the gap Stage 2 closes.

Requests carry an eight-second client deadline. An endpoint that regularly exceeds it is a client
`unavailable`, whatever the server eventually returns.

---

## 7. Security Requirements

Mapped to PRD section 14.1 and section 16.4, which is the release checklist.

### 7.1. The Session Cookie

```
Set-Cookie: mf_session=<opaque>;
  HttpOnly; Secure; SameSite=None; Partitioned;
  Path=/; Max-Age=<2592000 when rememberMe, else session>
```

`HttpOnly` is non-negotiable: PRD section 14.1 S2 forbids a JWT in `localStorage`, and the canvas
components are written so they never see a token. `Partitioned` is section 4.1. The value is opaque,
so revocation is a server-side delete rather than a wait for expiry.

### 7.2. CORS, With No Wildcard Anywhere

`Access-Control-Allow-Credentials: true` and `Access-Control-Allow-Origin: *` are mutually exclusive
by specification, so a wildcard is not merely unwise here, it does not function. The allowed origin is
echoed from the request only after matching the requesting site's `allowed_origins` exactly.

No `*.creatorsite.com` patterns. A subdomain wildcard on a site that hosts user content is an open
door, and Framer preview URLs can be enumerated.

### 7.3. Passwords And OTPs

**Not bcrypt.** It silently truncates at 72 bytes, so two different long passwords unlock the same
account. FP-02 names "Argon2id/bcrypt" without choosing; this document rules bcrypt out. Conflict
C15.

**What is built is scrypt, not Argon2id**, and that is conflict C23 rather than a silent downgrade.
Argon2id in Node means a native addon and node-gyp, which fails often enough on Windows to matter for
a surface that handles passwords. scrypt is memory-hard, in Node's standard library, OWASP-acceptable
where Argon2id is unavailable, and has no truncation ceiling.

It is weaker than Argon2id against a well-funded GPU attacker, so this is a decision to revisit
before launch and not after. The upgrade is one file:

```
scrypt$N=16384,r=8,p=1$<salt>$<hash>
```

Every stored hash carries its algorithm and cost parameters, `verifyPassword` dispatches on the tag,
and `needsRehash` drives an opportunistic upgrade on the next successful sign-in. Adding Argon2id
later costs no migration and no forced reset, because a password cannot be rehashed without the
plaintext and the only moment that exists is sign-in.

The server is the only authority on password policy. The client's rules in
[`src/utils/credentials.ts`](../src/utils/credentials.ts) are a copy for the form's benefit and are
documented as a hint, not a control. **The backend must enforce the same minimum independently**, and
should additionally check a breached-password corpus, which the client cannot do because the corpus is
gigabytes.

OTP: six digits from a cryptographic source, hashed at rest, ten-minute expiry, three verification
attempts then invalidated, sixty-second resend lock. Rate limited per email **and** per IP, because
PRD section 16.4 requires that OTP send "cannot be used to bomb a third-party inbox".

### 7.4. Webhooks

Verify the signature before parsing anything. Then insert into `webhook_events`, and only then queue
the work. A failed unique insert means the event was already seen, and the correct response is 200
with no action. Return 200 quickly and process asynchronously: a gateway that times out will retry,
and a retry is only harmless because of the idempotency table.

### 7.5. The Reset Token In A URL

FP-02 puts it in a query string, which is the weakest part of that flow: a URL reaches browser
history, the `Referer` header of anything the page loads, and any analytics script reading
`location.search`. The component already reads it once and strips it with `replaceState`.

What the backend owns: a single-use token, a 15-minute expiry, a hash at rest, and a token that is
never echoed in a response body or a log line.

### 7.6. The Release Checklist, Backend Half

PRD section 16.4, with the four items that are purely server-side:

- [ ] No gateway secret in any client response, verified by inspecting every payload
- [ ] A member of site A cannot read any record of site B
- [ ] A member cannot read another member's invoice by guessing an ID
- [ ] A signed download URL is dead at 61 seconds
- [ ] A shared-password grant creates no member record and expires
- [ ] The public directory endpoint leaks no email, payment ID, or spend figure
- [ ] A replayed webhook does not double-apply
- [ ] OTP send is rate limited and cannot bomb a third-party inbox

The two the client half already covers, origin validation on every `postMessage` handler and content
staying locked when the API is unreachable, are tested in this repository.

---

## 8. There Is No Creator Dashboard

Decided 2026-10-12: no Vue dashboard, no Inertia, nothing creator-facing outside
the Framer plugin.

### 8.1. This Resolves C19 In The Strongest Direction

FP-15 section 6 specified a Vue 3 dashboard with a members CRM, a tier editor
with drag-and-drop ranking, and a gateway vault. All three already exist in the
plugin, built at tasks 2.2, 2.3, and 2.4, and PRD section 2.3 calls the
In-Framer-First Mandate absolute, naming external dashboards as the thing every
competitor does wrong.

The first draft of this document proposed cutting the dashboard to four things
the 360x640 panel cannot do. Dropping it entirely is the cleaner call and it
removes the duplication problem rather than bounding it.

### 8.2. What Now Has No Home

Removing a component removes its responsibilities too, and three of them were
real. Stated here so they are deferred rather than forgotten:

| Was going to live in the dashboard | Where it goes now |
| :--- | :--- |
| Multi-site agency switcher | The plugin is scoped to the open Framer project, so an agency with a dozen client sites opens a dozen projects. Acceptable, and worth revisiting if agencies become a real segment |
| Asset uploads with a real file picker | FP-12 needs this and a 360px panel is a poor file manager. **Unsolved.** Likely a presigned direct-to-storage upload from the panel, which is more backend work than a form post |
| Revenue and churn charts | Deferred. Charts need width, and the panel has 360px |
| MemberFrame's own billing for creators | **This one cannot be deferred.** F19 and PRD section 12 require creators to pay for MemberFrame, and that flow has to exist somewhere. A hosted checkout page with no dashboard around it is the minimum |

### 8.3. Creator Authentication Is Still Required

Dropping the dashboard does not drop this. Every `/api/site/*` endpoint needs a
creator session token, the plugin's Manage and Settings tabs need it, and no
task in the 72-task plan builds it. That is conflict C10, and it is unchanged by
this decision.

What changes is only where a creator signs in: the plugin panel, through
`/api/auth/send-otp` and `/api/auth/verify-otp`, rather than a web form.

## 9. Build Order

Stage 0 is section 2.3 and still comes before everything. Nothing below has been
tested against a browser.

### Phase B1: Foundation. DONE

1. Node 20, Express, Prisma, MySQL 8, TypeScript strict
2. `User`, `Site`, `Tier`, `Member` and the session, reset, OTP, and email-log
   models
3. The hand-written migration for the three MySQL specifics, section 5.2
4. Site key resolution plus the per-site origin allowlist
5. CORS with credentials and no wildcard
6. The five-case error contract as responses, section 6.4

**Not done in B1**: creator authentication, `/api/auth/*`. Conflict C10 is open
and the plugin's Manage and Settings tabs stay signed out until it closes.

### Phase B2: Member identity. MOSTLY DONE

7. Register, sign in, forgot, reset, logout, logout-everywhere. **Done**
8. scrypt hashing, the five-failure lockout, the timing-safe paths. **Done**
9. `GET /api/member/session` returning `member` and `tiers`, resolving C1 and
   C5. **Done**
10. The session cookie with `Partitioned`, section 7.1. **Done**, untested in a
    browser
11. OTP send and verify. **Not done.** They answer 501, and `<MemberAuth>` ships
    with that path enabled, so a visitor who picks "Email me a code instead"
    reaches a dead end today

Done when a visitor signs in on a published Framer site and `<MemberGate>`
unlocks. **That has not happened**, and it is Phase 1 exit criteria E3 and E5,
unreachable since the project began.

### Phase B3: Money. NOT STARTED

12. `gateway_configs` with AES-256-GCM, and a read shape that cannot carry a
    secret
13. `subscriptions`, `invoices`, `webhook_events`
14. `POST /api/checkout/create-session` for Stripe
15. The webhook receiver: signature, then idempotency, then queue
16. The four normalized events

### Phase B4: Creator identity. NOT STARTED, AND BLOCKING

17. `/api/auth/send-otp` and `/api/auth/verify-otp`
18. A creator token the plugin can hold, which is the part nobody has specified.
    Conflict C10, and `setPluginData` is not permitted until task 5.6

### Phase B5: Everything else

Per feature plan, backend and frontend together.

### 9.1. Local Development Against Framer

A canvas component on a published Framer site cannot reach `localhost`:

1. `npm run dev` in `backend/`
2. A tunnel with a stable HTTPS hostname, Cloudflare Tunnel or ngrok
3. `API_BASE_URL` and `SESSION_COOKIE_CROSS_SITE=true` in `backend/.env`
4. Add the Framer origin to that site's `allowed_origins`
5. Point [`src/config/backend.ts`](../src/config/backend.ts) at the tunnel
6. **Redeploy the component from the Builder tab**

Step 6 is the one that catches people. The base URL is baked into the generated
file at deploy time, so editing the config is not enough: the component on the
canvas carries the old URL until it is regenerated.

## 10. Testing

67 tests in `backend/test`, all pure logic, none touching MySQL.

| File | Covers |
| :--- | :--- |
| `parity.test.ts` | The three copies of `isEntitled` and the password policy. See below |
| `password.test.ts` | scrypt format, salt uniqueness, corrupt-hash handling, the timing-safe dummy path |
| `tokens.test.ts` | URL-safe tokens, hex hashes, OTP distribution, expiry boundaries |
| `rateLimit.test.ts` | Window arithmetic, and origin matching including suffix attacks |

### 10.1. The Parity Test Is The Reason The Backend Is TypeScript

PRD section 11.3 requires `isEntitled` to be identical in the plugin, the canvas
components, and the backend, and calls divergence a security defect. Two of the
three were already checked against each other. **The backend copy had nothing
watching it, and it is the copy that actually decides access**: the other two run
in a browser, where their verdict is advisory and anyone can bypass them with
curl.

`backend/test/parity.test.ts` extracts the function from all three sources by
brace matching, normalizes away comments and whitespace, and compares. It covers
the password policy the same way, with the sign reversed: there the browser
copies are hints and the server copy is the rule.

It has been checked that it can fail, by perturbation rather than by assumption.

### 10.2. What Is Not Tested, Which Is Most Of It

**There are no integration tests.** Every route in `routes/member.ts` is
typechecked and reasoned about and has never run against a database. That
includes every behaviour section 6.2 lists as something the client cannot
verify: the lockout, the timing-safe responses, the session invalidation on
reset, and whether a 401 really comes back where the contract says it should.

Adding them needs a disposable MySQL schema and a migration run per suite. That
is a real decision with a real cost, in the same category as adding `jsdom` to
the frontend, and it is not smuggled in here.

Until then the honest summary is: **the logic is tested, the endpoints are not.**

### 10.3. The Integration Tests To Write First

In order, because each is something that is wrong in a way nothing else would
reveal:

| Test | Asserts |
| :--- | :--- |
| Cross-tenant read | Site A requesting site B's member gets 404, not 403. A 403 confirms the row exists |
| Timing safety | Unknown address, wrong password, and `NULL` hash take comparable time |
| No enumeration | `forgot-password` responds identically, registered or not |
| Reset invalidates | A session cookie issued before a reset is refused after it |
| Lockout | Five failures locks for fifteen minutes, and a success clears the counter |
| Rank uniqueness | A duplicate rank is refused by the database, not only by validation |
| Cookie attributes | `HttpOnly`, `Secure`, `SameSite=None`, `Partitioned` all present |
| Status mapping | Each of the five client arms is produced by a real endpoint |

## 11. Conflicts With The Main PRD

Carrying forward C1, C5, C9, C10, C11, C15, C17, and C18, which this document resolves or inherits,
and adding four new ones.

| # | Conflict | This document says | Confirm |
| :--- | :--- | :--- | :--- |
| C1 | `isEntitled` reads `gracePeriodEndsAt`; `MemberSessionData` does not declare it | The session response carries it as Unix seconds, `0` when none applies | **Resolved here** |
| C5 | The resolver needs the tier ladder and the session response has none | `GET /api/member/session` returns `tiers` | **Resolved here** |
| C9 | A custom tier key can never be selected on a gate, whose control is a fixed enum of four | Once `GET /api/site/tiers` exists, the generator emits the site's real keys as the enum options | Resolved by B2 |
| C10 | No task builds creator authentication, so three plugin surfaces are permanently signed out | `users` plus `/api/auth/*` in phase B1 | **Resolved here** |
| C11 | Six member routes exist only because a component needed them | All six are authoritative in section 6.2 | **Yes. This is the PRD section 10.4 amendment** |
| C15 | FP-02 names "Argon2id/bcrypt" without choosing, and bcrypt truncates at 72 bytes | Argon2id. Section 7.3 | **Resolved here** |
| C17 | Three documents disagree on how a request names its tenant | Public site key plus an origin allowlist. Section 3.2 | **Resolved here** |
| C18 | The reset flow needs a `/reset-password` page on the creator's site and nothing tells them | Backend owns the emailed path; **creator onboarding must document the page** | **Yes. Still unowned** |
| **C19** | FP-15's Vue dashboard rebuilds the members CRM, tier editor, and gateway vault, which PRD section 2.3 says belong in the plugin and calls the mandate absolute | **Resolved: no dashboard at all.** Section 8. Four of its responsibilities now have no home, and one of those, MemberFrame's own creator billing, cannot be deferred | Section 8.2's last row needs an owner |
| **C20** | FP-15 specifies Laravel 11, which reached end of life in March 2026 | Moot. The stack is Node | Nothing |
| **C23** | FP-02 and this document both say Argon2id, and `backend/src/lib/password.ts` uses scrypt | Argon2id in Node needs a native addon and node-gyp, which fails on Windows often enough to matter for a surface that handles passwords. scrypt is memory-hard, in Node's standard library, OWASP-acceptable, and has no bcrypt-style truncation ceiling. Every stored hash carries an algorithm tag, so adding Argon2id later rehashes members as they sign in, with no migration and no forced reset | **Yes, before launch.** It is weaker than Argon2id against a well-funded GPU attacker, and the upgrade is one file |
| **C24** | `<MemberAuth>` ships with the OTP path enabled by default and the backend answers 501 | A visitor who picks "Email me a code instead" reaches a dead end. 501 rather than 404 so the network panel says which it is | **Yes. Either build OTP (phase B2 item 11) or ship components with `emailEnabled` reconsidered** |
| **C21** | PRD section 11.2 soft deletes members to preserve invoice history, and the natural foreign key cascades invoices away on a hard delete | Members are only ever soft deleted, so the cascade never fires. A hard delete would take invoices with it | Decide before any data-retention or GDPR tooling is written |
| **C22** | FP-15 puts webhook idempotency in a 24-hour Redis cache; PRD section 10.5 makes non-replay a correctness requirement | A MySQL table with a unique key on `(gateway, event_id)`. Section 4.3 | **Resolved here**. Strictly stronger than the plan |

C19 is the one needing a product decision rather than an engineering one.

---

## 12. Open Questions This Document Cannot Settle

1. **Does the cross-origin cookie work in Safari?** Section 4.1. Everything member-facing depends on
   it and the answer is three days away.
2. **PRD blocker B7**: `framer.getCurrentUser()` exposes no email, so a creator arriving through the
   plugin cannot be matched to a dashboard account by address. Affects `users.framer_user_id` and the
   whole creator-identity join.
3. **PRD section 18 blockers B2, B3, B4**: member caps per tier, what happens to a creator's paying
   subscribers when the creator's own subscription lapses, and the GDPR controller and processor
   split. All three change this schema, and settling them after it is built means migrating it.
4. **Redis, yes or no, and when.** Section 4.3 recommends starting without it and names the signals
   that would change the answer.
5. **Where the API is hosted**, which decides whether custom-domain TLS for option 2 in section 4.1 is
   cheap or expensive.

Sources consulted for section 4.1 and the Laravel version:
[Laravel version support](https://www.endoflife.date/laravel),
[third-party cookie status 2026](https://studiostray.com/insights/third-party-cookies-2026-what-changed),
[browser blocking data](https://termsandconditionstemplate.com/what-percentage-of-browsers-block-third-party-cookies),
[Google's changed approach](https://usercentrics.com/knowledge-hub/google-third-party-cookies/).
