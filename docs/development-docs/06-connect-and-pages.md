# 06. Connect, Membership Pages, And The Member Dashboard

> Covers the Connect tab, the site settings document, the page scaffolder,
> `<MemberDashboard>`, and the custom profile fields that FP-09 specifies.
>
> Features: FP-02 (completion), FP-08, FP-09, PRD F02, F05, F06.
> Resolves conflict C10. Opens C26 to C29.

---

## 1. What Was Broken Before This

Three things, and the third was invisible.

**No creator identity existed.** Every `/api/site/*` route needed a creator
session token and no task in the 72-task plan built one, so the plugin's Manage
and Settings tabs rendered their signed-out state and `apiClient` shipped with
`getCreatorToken: () => null`. That is conflict C10 and it had been open since
the project began.

**No site existed to scope anything to.** `ManageTab` and `SettingsTab` both
passed a constant named `PLACEHOLDER_SITE_ID`. Even with a token, there was
nothing to point it at.

**The canvas components could not authenticate.** `resolveSite` requires an
`X-MemberFrame-Site` header and neither `<MemberGate>` nor `<MemberAuth>` sent
one, so every request from a deployed component was a 400. This one was the
worst of the three because it was silent: the plugin looked fine, the backend
looked fine, and a visitor on the published site got a failure that read like a
server outage.

---

## 2. The Connect Handshake

### 2.1. Why It Has Two Steps

The plugin knows the Framer project id and the creator's display name, from
`framer.getProjectInfo()` and `framer.getCurrentUser()`. It does **not** know
their email address: blocker B7 records that the SDK exposes none, and that is
still true in SDK 3.10.3.

So the creator types one. An address a creator typed is a claim, not a fact.

A single-step connect would mean: send a project id and an address, receive a
token that reads every member of that site. Anyone who learned a project id
could type any address and take the site. The six-digit code is what turns the
claim into a fact, and it is the whole security model of this flow.

```
POST /api/connect/start     {email, framerProjectId}   -> 200, always
POST /api/connect/verify    {email, code, ...}          -> token + site + settings
GET  /api/connect/session   Authorization: Bearer       -> creator + every site
POST /api/connect/disconnect                            -> revokes this token
```

`start` answers 200 whatever happens and the service returns `void`, so there is
no branch for a route to accidentally report. A creator who mistypes their
address and one who did not see the same screen, which is also what stops this
endpoint being used to ask whether an address has a MemberFrame account.

### 2.2. Claiming Is First Come

The first address to verify against a Framer project id owns that site. A second
creator connecting the same project gets 403 `project_claimed_by_another_account`.

That is correct and it is also a real limitation: a project connected by mistake,
or by a contractor who has since left, needs support to reassign. There is no
transfer flow and no team model. **Conflict C28**, recorded rather than invented,
because a wrong guess about ownership transfer is expensive to undo.

### 2.3. The Token Is A Bearer Header, Not A Cookie

Backend PRD section 2.3 calls the cross-site session cookie the project's largest
architectural risk: Safari blocks third-party cookies by default, Firefox
partitions them. The plugin panel is an iframe on an origin we do not control, so
a cookie there would meet that problem immediately and with **no mitigation
available**, because unlike a creator's own site there is no first-party
subdomain to move to.

A bearer token sidesteps it completely, and removes CSRF from this half of the
API as a category: a request carrying no ambient credential cannot be forged by a
page the creator happens to be visiting.

This is also why `/api/connect/*` and `/api/site/*` use `Access-Control-Allow-Origin: *`
while `/api/member/*` refuses a wildcard in the strongest terms. The two are not
in tension. The member half sends a credentialed cookie, and the CORS
specification makes `Allow-Origin: *` and `Allow-Credentials: true` mutually
exclusive, so a wildcard there does not merely risk something, it does not
function. The plugin half carries no cookie, so what a wildcard permits is an
unauthenticated request from any origin receiving a 401.

### 2.4. Where The Token Lives, And What That Costs

PRD section 14.1 S2 bars a token from `localStorage`, correctly: a plugin panel
is a web page and this value reads every member of every site the creator owns.

Three options were available:

| Option | Verdict |
| :--- | :--- |
| Memory only | Correct, and a code on every panel open. It would be turned off |
| `localStorage` | Forbidden by S2 |
| Framer plugin data | Chosen |

Plugin data is scoped to the Framer project rather than to an origin, and is read
back only by this plugin in this project. **The trade is real**: plugin data lives
in the Framer document, so it syncs to Framer's servers and to anyone with edit
access to the project.

The security model that follows is "whoever can edit this Framer project can
administer its membership". That is defensible, because a person who can edit the
project can already change what the gates require and where the sign-in page
points. It is **not** the same as "whoever has the creator's email account", which
is what the connect flow actually proves. **Conflict C27.** Mitigations: a
thirty-day server-side expiry, and a token that is revocable rather than merely
expirable.

`setPluginData` is a declared permission as of this work. The repo rule is to
declare a permission in the task that first needs it, and this is that task.

---

## 3. Settings As One JSON Document

An explicit instruction, and the right call. `site_settings` is one row per site,
keyed by `site_id`, holding one JSON column.

The alternative is a column per setting, and this product adds settings
continuously: a login path, a redirect, an auth method, a locale. Each would be an
`ALTER TABLE` on a table holding a row per paying customer, plus a deploy window
where the code expects a column the database does not have.

### 3.1. What Is Given Up, Stated Rather Than Discovered

1. **The database validates nothing.** No `NOT NULL` on `auth.loginPath`, no
   `CHECK` on `auth.defaultMethod`. `lib/siteSettings.ts` is therefore the only
   writer: it validates on the way in and fills defaults on the way out.
2. **A setting cannot be queried across sites.** "Which sites allow registration"
   is a full scan. Nothing asks that today. A setting that needs querying should
   be promoted to its own column, which is a migration, not a redesign.
3. **Concurrent writes are last-write-wins.** `version` makes that detectable: a
   write carrying a stale value is refused. The case is ordinary, not exotic: one
   creator with the project open on two machines.

The one thing MySQL does enforce is that the column holds an object, through a
hand-written `CHECK (JSON_TYPE(settings) = 'OBJECT')`. That is cheap and it means
the application only ever copes with a wrong-shaped object, never with a scalar.

### 3.2. Reads Are Total

`withDefaults` accepts anything, including `null`, a string, or an array, and
returns a whole document. The caller is a route that has to answer. A corrupt row
reads as defaults, which is wrong in the safe direction: a creator sees their
settings reset and says so, rather than the panel failing to open.

It also enumerates every field by name, which is the guarantee that makes the
document safe to return to the panel whole: a key nobody declared does not survive
a read, so a secret placed there by mistake cannot be handed back out. An earlier
draft had a regex that stripped credential-looking key names; the typechecker
showed it was dead weight next to this, and it was removed.

### 3.3. Writes Are Merges

Per key, one level deep, sections enumerated by name. Not a general deep merge:
that has a well-known hazard where `__proto__` or `constructor` in attacker-
supplied JSON walks the prototype chain. Enumerating the sections means a key
nobody declared cannot be written at all, which is tested.

A panel that knows four settings must not erase a fifth it has never heard of.
That is what makes an older plugin safe rather than destructive.

---

## 4. The Page Scaffolder

### 4.1. Why Pages Rather Than Only Components

A membership is not one component, it is a set of pages that refer to each other,
and the settings document already names them. Before this, a creator read five
path fields and then made the pages by hand. Every mismatch is a dead end a
**visitor** finds rather than the creator:

- `loginPath` points at a page that does not exist, so a locked gate sends the
  visitor to a 404.
- The reset page exists but has no `<MemberAuth>` on it, so the emailed link
  opens a blank page and the token is spent.
- The dashboard exists but is not gated, so a signed-out visitor sees an empty
  account screen instead of being asked to sign in.

Creating the pages from the same settings the components are configured from
removes the class of problem rather than documenting it.

### 4.2. It Is Additive And Never Overwrites

A page whose path already exists is reported as `skipped`, never replaced. A
creator who has built a login page must not lose it to a button labelled "create
pages", and there is no undo in this direction: `removeNodes` would be destroying
work on the creator's say-so when they said something much weaker.

Per page rather than all or nothing, so one refusal does not discard three that
worked. `test/pageScaffold.test.ts` has 21 cases and the skipping behaviour is
what most of them are about.

Three rules shape which pages are derived:

| Rule | Why |
| :--- | :--- |
| The site root is never scaffolded | A creator's home page exists and is the last thing that should get a sign-in form |
| Duplicate paths collapse | `signupPath` defaults to `loginPath`, the recommended one-page setup. Creating it twice would fail |
| Only the dashboard is gated | The reset page is opened from an email by someone who cannot sign in. Gating it makes recovery impossible |

Each page gets the screen it is named for:

| Page | Component |
| :--- | :--- |
| Sign in / Login | `MemberLogin`, or the combined `MemberAuth` when sign up shares the login path, so a visitor can still register |
| Sign up / Registration | `MemberRegister` |
| Reset password / OTP | `MemberPasswordReset`: asks for the email with no token in the URL, sets the new password when the emailed link brings one |
| Member dashboard | `MemberDashboard` |
| Member pricing | `MemberPricing` |

Before this, the login and reset pages both got the combined `MemberAuth`, so all three auth pages opened on the same sign in form.

### 4.3. New Pages Get the Site's Header and Footer

`createWebPage` makes a bare page: no navigation, no footer. A membership page that looks unlike the rest of the site reads as broken, so each new page borrows the site's own chrome (`findPageChrome`, `applyPageChrome` in `pageScaffoldService.ts`, the SDK adapter in `pageChromeFramer.ts`):

1. **Source page**: Home first, then the other pages in project order, skipping pages made in this run. Only a page whose primary breakpoint is a **stack** qualifies; an absolutely positioned page places its footer by coordinates that are wrong on a page of another height.
2. **Header and footer** (`pickPageChrome`): a child named like one (`Nav`, `Navigation`, `Header`, `Menu`, `Footer`) wherever it sits; otherwise the first and last children when they are component instances not named like content (`Hero`, `Section`, `CTA`...). A page with one child has none.
3. **Placement**: the new page's primary breakpoint gets the source's stack attributes (layout, direction, alignment, distribution, gap, padding, height, min height). The header is cloned to index 0, the footer to the end, and the MemberFrame component is inserted at index 1 between them. Spacing is `64px 0 96px` below an in-flow header, and the larger `SCAFFOLD_COMPONENT_SPACING` when the header is absolute or fixed.
4. **Failure**: each step is independent. No permission (`cloneNode` is declared in `framer.json`), no qualifying page, or a clone that fails leaves a bare page with the component, as before.

Known limit: the copies go into the primary (Desktop) breakpoint, and Tablet and Phone inherit them. A per-breakpoint override on the source page, such as a header switched to its mobile variant on Phone, is not copied, so set it again on the new page if the template uses one.

---

## 5. `<MemberDashboard>`

### 5.1. Two Jobs, And The Second Was Missing From The Product

**It is the page a member lands on.** `afterLoginPath` points at it.

**It makes session state legible.** Nothing on a creator's site previously told a
visitor whether they were signed in. `<MemberGate>` shows locked or unlocked
content, which says something about the *content* and nothing about the *person*:
a visitor seeing a locked panel cannot tell whether they are signed out, signed in
at the wrong tier, or looking at a broken page.

The component names the state in words, in all five cases, and the distinction
between two of them is the reason the union has five arms rather than a boolean:

- `signed_out` asks them to sign in.
- `unavailable` tells them to try again.

Telling the first to try again, or the second to sign in, sends them down a path
that cannot work.

`misconfigured` is the third one worth naming: it fires when `siteKey` is empty,
which means the component was deployed before the project was connected. Without
it that case renders as `unavailable` and sends the creator hunting for a network
problem that is not there.

### 5.2. What It Does Not Do, And Why Not Silently

FP-08 specifies billing and invoice tabs. Both need the `subscriptions` and
`invoices` tables, which are backend PRD phase B3 and do not exist.

So the billing section renders an honest note rather than an empty table or,
worse, plausible-looking zeroes. **A member reading "$0.00, next billing: never"
would reasonably conclude their subscription had lapsed.**

---

## 6. Custom Profile Fields (FP-09)

### 6.1. Definitions Are Settings, Values Are Member Data

The split follows directly from section 3.

| | Where | Why |
| :--- | :--- | :--- |
| Definitions | `site_settings.settings.customFields` | Configuration. A handful per site, read whole, written whole, never queried across sites |
| Values | `Member.metadata` | Member data. One JSON column on the member's own row |

The alternative, a column per creator-defined field, would make a creator typing a
field name into a form cause an `ALTER TABLE`. That is the shape of problem this
product should never have.

### 6.2. Validation Is Against The Creator's Definitions

Because the shape is the creator's, not ours. A design community's
`portfolio_url` and a coaching club's `team_size` are the same column, so the only
thing that can say whether a value is acceptable is the definition the creator
wrote.

Two behaviours are worth stating because they look inconsistent and are not:

- **A key with no definition is dropped, not rejected.** A member whose browser
  posts a stale form after the creator deleted a field should not be told their
  profile is invalid. The field is gone, so the value goes too.
- **A value of the wrong type is rejected, with the field named.** That one is
  actionable: the form and the definition disagree, and the member can fix what
  they typed.

And one that protects the member rather than the data: **a stored value that a
changed definition would now refuse is kept.** The creator tightened the rule and
the member did nothing wrong, so they are not blocked from saving something else.

### 6.3. The Security Case That Matters

`isSafeUrl` refuses `javascript:`. A portfolio URL is rendered as an anchor on the
creator's published site **and** in the plugin's member flyout, so a
`javascript:` href is script execution in both places. Every scheme other than
http and https is refused rather than enumerating the dangerous ones, because that
list is open-ended and the useful list is two.

`PATCH /api/member/profile` deliberately cannot change email, tier, or status.
Email is an identity change needing a verification round trip it does not have.
Tier and status are what the member pays for, and **an endpoint authorized by the
member's own cookie that could raise their tier is a self-service upgrade to VIP.**

---

## 7. The Loopback Guard

`VITE_API_BASE_URL` is the documented way to point the panel at a local backend.
Two different things want a base URL and they are not the same thing:

- The **panel** runs on the developer's machine, so `127.0.0.1` is right for it.
- A **generated canvas component** runs on a published site in someone else's
  browser, which cannot reach the developer's loopback address at all.

Baking the panel's dev URL into a deployed component produces a membership that
works perfectly in the panel and fails silently everywhere else, with a network
error no creator could interpret.

`deployBaseUrl()` refuses to emit a loopback URL and falls back to the production
default. Backend PRD section 9.1 covers the supported way to develop against a
published site, which is a tunnel with a stable HTTPS hostname, and a tunnel URL
passes through untouched.

This also fixed a test that had begun failing: `memberAuth.test.ts` asserts the
generator bakes an `https://` base URL, and the env override had started making
that false.

---

## 8. Conflicts Opened Here

| Id | Conflict | Decision | Needs the user |
| :--- | :--- | :--- | :--- |
| **C26** | The shell standard permits two to four tabs. Connect is a fifth | Added on explicit instruction. Members and Tiers stay folded into Manage, which is the PRD section 7.3 resolution and is untouched | **Yes.** If 360px feels cramped, move Connect into Settings. Never re-split Manage |
| **C27** | S2 bars a token from client storage; the creator token is in Framer plugin data | Project-scoped rather than origin-scoped, thirty-day expiry, revocable. The model becomes "whoever can edit this project can administer its membership" | **Yes.** It is weaker than "whoever has the creator's email" |
| **C28** | First address to verify owns the Framer project, with no transfer | Refuses a second account with 403 rather than guessing at a transfer flow | **Yes.** A project connected by mistake needs support |
| **C29** | `sendMagicLink` is called by the Manage tab and no route answers it | Left in place, resolves `unavailable`. It is a few lines once the OTP flow exists. **Resolved 2026-10-19**: built, see [`26-magic-link-and-revoke.md`](26-magic-link-and-revoke.md) | **Yes**, with C24 |

---

## 9. Human Verification

Nothing in this document has been verified against a database or a browser. In
particular:

- **No endpoint has run against MySQL.** The connect handshake, the settings
  write, and the profile patch are typechecked and have served zero requests.
- **`createWebPage` has never been called.** The scaffolder is tested against a
  mock that returns what the SDK's types say it returns.
- **`<MemberDashboard>` has never rendered in Framer.** Contrast, layout, and both
  themes need a human.
- **The cross-origin cookie is still untested in any browser**, which remains the
  Stage 0 spike in backend PRD section 2.3 and the one result that could
  invalidate the session design for every component built so far.
- **The site key header has never reached `resolveSite`.** The chain is pinned by
  `test/deployContext.test.ts`, which proves the generator emits the key and the
  header name, and proves nothing about whether the server accepts it.
