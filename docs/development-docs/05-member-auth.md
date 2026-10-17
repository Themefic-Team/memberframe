# Feature: Multi-Provider Auth and Passwordless OTP

Technical development specification, user flow, architectural wiring, and testing checklist for `<MemberAuth>`, the sign-in component deployed to a creator's published site.

**PRD reference**: [F05](../memberframe-complete-prd.md) section 8
**Status**: in progress
**Tasks**: 2.5 (see [`../IMPLEMENTATION-STATUS.md`](../IMPLEMENTATION-STATUS.md))

Second canvas component after `<MemberGate>`. Everything in
[`01-member-gate.md`](01-member-gate.md) sections 3.2 to 3.5 about why a deployed component is authored as
a real file, what the config marker is for, and where its styling lives applies here unchanged. This doc
records only what is specific to authentication.

> **Appearance and sizing (2026-10-15):** Theme (Light by default), Colors, Typography, Layout, and Labels controls, fixed default size, and the shared colour sanitizer are documented once in [`00-canvas-appearance.md`](00-canvas-appearance.md). Redeploy from the Builder to update an existing file.

---

## 1. Overview and Problem Solved

- **Feature Name**: Multi-Provider Auth and Passwordless OTP
- **Target Audience**: Site Visitor becoming a Member
- **Value Proposition**: FrameAuth offers Google and GitHub, Thenty offers Google. No competitor supports
  Apple Sign In or Discord, and none offers passwordless email. A visitor here signs in with the account
  they already have, or with a six-digit code, and never creates a password to forget.
- **Priority Tier**: P0: Core MVP

---

## 2. User Flows

### 2.1. In-Plugin Configuration Flow (Framer Designer)

1. Creator picks Member Auth in the Builder tab.
2. Creator enables or disables providers, sets the headline, the accent colour, and the corner radius, and
   chooses modal or inline mode.
3. Creator clicks "Add to canvas". The same generator and deploy path as F01.

The Builder tab's customizer for this component is not built in task 2.5. The picker lists it, the
registry marks it unbuilt, and the placeholder names task 2.5. Wiring its seven controls into the panel is
a Builder tab change, and the ledger row for 2.5 names only the component file.

### 2.2. Visitor and Member Runtime Flow

1. Visitor clicks sign in, or a locked gate sends them here.
2. The component shows the enabled provider buttons and an email field.
3. Email path: the visitor submits an address, the component posts it, and a six-digit code is sent. The
   form swaps to a code field with a 60 second resend countdown.
4. A wrong code says so. An expired code says something different. A code that has been tried three times
   is dead, and the message says to request a new one.
5. OAuth path: a popup opens, the provider authenticates, and the popup posts a message back to the page.
   The visitor never leaves the page.
6. On success the backend sets an HTTP-only session cookie, and the component reports success. Any gate on
   the page picks the session up on its next check.

---

## 3. Architecture and File Inventory

| Path | Task | Role |
| :--- | :--- | :--- |
| `src/canvas-components/MemberAuth.tsx` | 2.5 | The authored component, deployed verbatim |
| `src/services/canvasComponentCodeGenerator.ts` | 2.5 | Extended with a second component |
| `src/types/framer-canvas.d.ts` | 2.5 | Unchanged. The shim already covers what this needs |

### 3.1. The Generator Becomes Plural

Task 1.4 built a generator with one function, `generateMemberGateCode`. A second component makes the shape
of the general case visible, so the marker handling, the validation scaffold, and the lock-state assertion
were lifted into a shared `generateComponentCode(descriptor, config)` and the two public functions became
thin wrappers.

This was done now rather than at the third component because doing it at the second is where the
abstraction is still cheap and still honest: two cases show which parts are common. The alternative, a
copy of the marker logic per component, would have put the "exactly one marker pair" assertion in fifteen
places by Phase 4.

### 3.2. Four Things Authentication Needs That Gating Did Not

**A state machine.** The component moves through `idle`, `sending`, `code_sent`, `verifying`, `signed_in`,
and `error`. It is written as a discriminated union rather than four booleans, because the illegal states
are the dangerous ones: "sending and signed in" or "code sent with no email" would each render something
incoherent to a visitor mid sign-in.

**A countdown.** F05 requires the resend button disabled for 60 seconds with a visible countdown. One
`setInterval` at one second, cleared on unmount and on a successful verify. The remaining seconds are
derived from a stored deadline rather than decremented, so a backgrounded tab that stops firing timers
resumes with the correct number instead of a stale one.

**A popup and a message listener.** OAuth uses `window.open` and a `postMessage` callback so the visitor
stays on the page. See section 3.3, which is the security-critical part of this feature.

**Focus management.** F05 requires the modal to be keyboard navigable, to trap focus, and to close on
Escape. Implemented with a `keydown` listener on the dialog that cycles Tab within the focusable set, and
a `role="dialog"` with `aria-modal`. Inline mode traps nothing, because there is nothing to trap: it is
part of the page.

### 3.3. The `postMessage` Listener Validates Its Origin, And That Is Not Optional

PRD section 14.1 S8: "All `postMessage` handlers validate `event.origin` against an allowlist." PRD
section 16.4 repeats it in the security review checklist.

An OAuth callback listener that does not check origin is an open door: any page that can get a handle on
this window, including an iframe the visitor's own browser extension injected, can post
`{ type: "memberframe-auth", ok: true }` and the component will believe a sign-in happened. It would not
actually grant a session, because the session is a cookie the backend sets, but it would flip the UI to
signed in and tell the visitor they are authenticated when they are not.

So the handler checks three things before reading the payload, in this order:

1. `event.origin` equals the origin of the configured API base URL. Exactly equal, string compared, not a
   suffix test. A suffix test matches `evil-api.memberframe.framefic.com.attacker.example`.
2. `event.source` is the popup handle this component opened. Not any window, that specific one.
3. The payload has the expected message type.

The allowlist is one entry, derived from `CONFIG.apiBaseUrl`, which the generator injects. A single origin
is not a weaker allowlist than a list; it is the correct size of one here.

A test asserts the origin check is present and that it is an equality comparison, because the plausible
regression is someone loosening it to `includes` to make a staging domain work.

### 3.4. What The Component Does Not Do

Worth stating because their absence looks like an omission:

- **It does not store a token.** The session is an HTTP-only cookie the backend sets, per S2. The
  component reads no token, holds no token, and has no storage call in it. Same rule as `<MemberGate>`,
  asserted by the same style of test.
- **It does not rate limit.** F05 points at F21 for that, which is task 4.10, and rate limiting that a
  client enforces is a UI courtesy rather than a control. The 60 second resend lock is the courtesy; the
  enforcement is the server's.
- **It does not count verification attempts.** F05's three-attempt limit is a server rule: the code is
  hashed at rest and only the server can count tries against it. The component renders the distinct
  message the server returns when a code is dead.

That third one matters for how the acceptance criteria are read. "A 4th verification attempt on one code is
rejected and the code is invalidated" is not a behaviour this repository can implement.

---

## 4. Framer Property Controls Specification

PRD section 9.2 row 2 names five controls: `authMode`, `providers`, `accentColor`, `borderRadius`,
`headline`. F05's configuration flow adds welcome copy, and provider enabling is described as
checkboxes, which in a Framer sidebar means one boolean per provider rather than a multi-select.

| Control Title | Control Type | Default Value | Description |
| :--- | :--- | :--- | :--- |
| Display Mode | `Enum` | `inline` | Inline on the page, or a modal overlay |
| Headline | `String` | `Sign in to continue` | The dialog heading |
| Welcome Message | `String` | `Use your email or a connected account.` | One line under the headline |
| Email Sign In | `Boolean` | `true` | The six-digit code path |
| Google | `Boolean` | `true` | |
| Apple | `Boolean` | `false` | |
| GitHub | `Boolean` | `false` | |
| Discord | `Boolean` | `false` | |
| Accent Color | `Color` | `#5271ff` | Button fill and focus ring |
| Corner Radius | `Number`, 0 to 24, unit px | `10` | |

Ten controls rather than five. `providers` as one control cannot express "a disabled provider does not
render its button", which is an acceptance criterion, in a way a creator can operate: Framer has no
multi-checkbox control type, and an `Enum` picks one. Four booleans is the shape F05's own flow describes.

`accentColor` and `borderRadius` are dynamic values, so they become CSS custom properties scoped to the
instance, exactly as `blurIntensity` did in F01. Conflict C7 settled that `style={{ }}` is not available.

Default of `inline` rather than modal: a modal that cannot be dismissed into anything is a dead end on a
canvas, and a creator dropping the component on a page most likely wants it on the page. Modal mode is for
a gate's sign-in CTA to open, which is task 2.5's successor work.

---

## 5. Data Contracts and Core User Schema

### 5.1. The Member OTP Endpoints Do Not Exist In The Contract

This is conflict C11, raised in [`00-api-client.md`](00-api-client.md) and detailed here.

PRD section 10.4 is headed "Member Runtime Endpoints. These serve the canvas components on the published
site." It lists nine routes. **None of them sends or verifies an OTP.**

The only OTP routes in the PRD are in section 10.2, "Creator and Licensing Endpoints. These serve the
plugin panel":

```
POST /api/auth/send-otp    { email, siteId, framerUserId, framerSiteName, framerSiteUrl }
POST /api/auth/verify-otp  { email, code }  ->  { token, user }
```

Those cannot be the member routes. `framerUserId` is the creator's Framer account id, which a site visitor
does not have and must not be asked for. And `verify-otp` returns `{ token, user }`, a bearer token in a
response body, where F05 requires the member session to arrive as an HTTP-only cookie.

So `<MemberAuth>` calls two routes that are additions to the contract:

```
POST /api/member/send-otp    { email, siteId }
  -> 200 { expiresInSeconds, resendAfterSeconds }
POST /api/member/verify-otp  { email, code, siteId }
  -> 200 { member: MemberSessionData }   and Set-Cookie, HTTP-only
  -> 401 { reason: "invalid_code" | "expired_code" | "too_many_attempts" }
```

And one for OAuth start:

```
GET /api/member/oauth/:provider?siteId=...   opened in a popup
```

**These are proposals, written in the component because it cannot work without them, and they need
confirming before the backend routes are built.** The three `reason` values exist because F05 requires an
expired code to produce "a distinct message from a wrong code", which a bare 401 cannot express.

### 5.2. The Payload F05 Declares

```typescript
interface MemberAuthPayload {
  email: string;
  authProvider: "otp" | "google" | "apple" | "github" | "discord";
  code?: string;
  metadata?: Record<string, string>;
}
```

Reproduced in the component as the request body shape. `metadata` is declared and unused: F16's onboarding
questionnaire is the thing that fills it, at task 6.3.

---

## 6. Verification and Testing Checklist

### 6.1. F05 Acceptance Criteria

| PRD criterion | Status | Evidence |
| :--- | :--- | :--- |
| A 4th verification attempt on one code is rejected and the code is invalidated | Not reachable | Server rule. The code is hashed at rest and only the server can count attempts. The component renders the `too_many_attempts` message |
| An expired code past 10 minutes is rejected with a distinct message from a wrong code | Agent, partly | The component maps three distinct `reason` values to three distinct strings, asserted by test. The expiry itself is the server's |
| The resend button is disabled for 60 seconds with a visible countdown | Agent, partly | The countdown is derived from a deadline and unit tested at the boundaries. That the button renders disabled needs a human |
| Session cookie is HTTP-only, Secure, and SameSite | Not reachable | Set by the server. The component cannot read it, which is the point |
| A disabled provider does not render its button | Agent, partly | `enabledProviders` is pure and tested, including the all-disabled case. The render needs a human |
| OAuth popup blocked by the browser produces an actionable inline error, not a silent failure | Agent, partly | `window.open` returning null is handled and sets an error state with copy naming the popup blocker. Observing a real block needs a browser |
| Modal is keyboard navigable, traps focus, and closes on Escape | Needs human | Implemented with a keydown handler and a focusable-set cycle. No DOM test environment exists to drive a Tab key, blocker B5 |
| Zero unicode emoji in any provider button. Lucide or brand SVG only | Agent, done | Asserted by test across the whole file |

### 6.2. Standing Checklist

- [x] Zero inline CSS compliance verified (`npm run lint:css`).
- [x] `tsc --noEmit` and `npm run build` pass.
- [x] The component imports only `react`, `framer`, and `lucide-react`, asserted by test.
- [x] No storage API and no token read anywhere in the file, asserted by test.
- [x] The `postMessage` handler compares origin for equality, asserted by test.
- [x] The F19 lock-state block is present and patchable.
- [ ] Light and dark contrast at WCAG AA on a published site.
- [ ] Keyboard navigation, focus trap, and Escape.
- [ ] A real OTP delivered to a real inbox. Blocker B1.

---

## 7. Verified By Whom

| Check | Verified by | Date | Evidence |
| :--- | :--- | :--- | :--- |
| All ten property controls appear in the sidebar | | | |
| Disabled providers really do not render | | | |
| Focus trap, Tab cycling, and Escape | | | |
| A real OAuth popup round trip | | | |
| A popup blocker produces the inline error | | | |
| A real six-digit code arrives and signs in | | | |
| Light and dark contrast at WCAG AA | | | |
| Brand mark usage reviewed against each provider's guidelines | | | |
| Automated gates | agent | 2026-10-12 | command output in the commit message |

The last row is not an engineering check. Google, Apple, GitHub, and Discord each publish brand guidelines
governing how their mark may appear on a sign-in button, and this component ships monochrome marks drawn
to inherit the current colour. That is a deliberate choice, recorded in section 8 decision 4, and it needs
a human to confirm it is acceptable before release.

---

## 8. Build Decisions

1. **The state machine is a union, not a set of booleans.** Section 3.2. "Sending" and "signed in" must
   not be able to hold at once in a sign-in form.
2. **The countdown derives from a deadline, not a decrement.** A backgrounded tab stops firing timers. A
   decrementing counter resumes wrong, and the resend button then unlocks late or early.
3. **The `postMessage` handler checks origin for equality, checks the source window, and checks the
   message type, in that order.** Section 3.3. A suffix test on origin is a known bypass.
4. **Provider marks are monochrome single-path SVG using `fill="currentColor"`.** This is a deviation
   worth naming. The icon rule says Lucide or Framer SVG with `stroke="currentColor"`, and Lucide carries
   no brand marks: it removed them. A brand glyph is a filled shape, not a line, so `fill="currentColor"`
   is the equivalent that keeps the rule's actual intent, which is that an icon inherits theme colour and
   is never an emoji or a raster. Flagged for brand-guideline review in section 7.
5. **Ten property controls, not the five in section 9.2.** Section 4. Four booleans are the only shape
   that can satisfy "a disabled provider does not render its button" in a Framer sidebar.
6. **`inline` is the default display mode.** A modal with nothing to dismiss to is a dead end on a canvas.
7. **Two proposed endpoints, declared as proposals.** Section 5.1. The contract has no member OTP route,
   and reusing the creator route would make a visitor send a `framerUserId`.
8. **The generator was generalised at the second component, not the fifteenth.** Section 3.1.

---

## 9. Email And Password Authentication, Feature Plan FP-02

Added 2026-10-12. Written before the code, per the mandatory rule. FP-02 is in
[`docs/features-plan/2. Email-Password Auth.md`](../features-plan/2.%20Email-Password%20Auth.md),
and it extends this feature rather than creating a new one, so it is recorded here.

### 9.1. Why A Password Path Exists At All

PRD section 18 conflict 6 records that some buyers distrust OTP-only or SSO-only login, and FP-02
gives the market reason: corporate inboxes filter the code, delivery is slow, and some security
policies forbid emailed one-time links outright. A membership plugin that cannot offer a password
loses the B2B buyer entirely.

The honest counter-argument is that passwords are the weaker mechanism, and the component still
leads with OTP and SSO. The password path is parity, not the recommendation.

### 9.2. A View Is Not A Phase, And Conflating Them Is What Explodes A State Machine

Task 2.5 had one flow, so one union was enough. FP-02 adds four destinations: password sign-in,
sign-up, forgot-password, and the reset form. Folding those into the existing `AuthState` union
would multiply four views by five phases.

So the component now carries two pieces of state:

```
view   where the visitor is          "otp" | "password_signin" | "password_signup"
                                     | "forgot" | "reset"
phase  what the component is doing   idle | sending | code_sent | verifying
                                     | reset_requested | signed_in | error
```

They vary independently. A visitor can be `sending` in sign-up or in forgot-password, and the busy
button, the disabled inputs, and the spinner are identical in both. One axis for place and one for
activity is the whole reason the union stays readable.

`view` is forced once rather than chosen: a URL carrying `?token=` starts the component in `reset`,
because that is the creator's reset page and nothing else on it makes sense.

### 9.3. The Password Policy Is A Hint, And This Doc Says So Out Loud

FP-02 asks for minimum 8 characters, a strength indicator, and a creator-togglable "Strong
Password" rule. All three are implemented. None of them is a security control.

A regex inside a component that ships to the browser is advice to a cooperative user. An attacker
posts to the endpoint directly. **The only password defences that matter are server side**: the
Argon2id hash, the lockout in FP-02 section 3.4 rule 2, the rate limit, and a check against a
breached-password corpus. The last of those is the one with real effect, and the client cannot do
it, because the corpus is gigabytes.

It is also worth recording that NIST SP 800-63B advises against composition rules of exactly the
kind `requirePasswordStrength` enables, on the grounds that they push people toward `Password1!`.
FP-02 asks for the control, so the control exists and defaults on. The rule it enforces is
deliberately mild, one letter and one digit, rather than a symbol zoo.

The policy is duplicated, like `isEntitled` before it: once in
[`src/utils/credentials.ts`](../../src/utils/credentials.ts) where it can be unit tested, and once inside
the component where it actually runs. `test/credentialsParity.test.ts` extracts both and fails on
divergence. A client that says a password is fine where the server says it is weak produces a
cheerful form followed by a 400, which is the worst of both.

### 9.4. Three Things The Password Path Must Not Reveal

**Whether an email is registered.** Sign-in returns one message for a wrong password and for an
unknown address: "Invalid email or password." Forgot-password always returns 200 and always shows
the same "check your inbox" screen. FP-02 section 3.4 rule 3 requires it, and it is the single
easiest thing to break later by adding a helpful error.

**Whether a password is set at all.** A member who signed up with Google has `password_hash NULL`.
That must read as a failed credential check, never as "this account has no password" and never as a
different error. See [`00-member-data-model.md`](00-member-data-model.md) section 5.2.

**Whether the account is locked, in a way that distinguishes it from a wrong password.** FP-02 does
ask for an `account_locked` reason, and the component renders it, because a member who has locked
themselves out needs to know to wait rather than keep guessing. The information leak is real but
small, and the alternative is a member who tries forever. Recorded as a judgement call, not an
oversight.

### 9.5. The Plaintext Password Exists For One Submit And Then Does Not

FP-02 section 3.4 rule 1. Concretely, in this component:

- The value lives in a React state variable bound to the input, which is unavoidable.
- It is cleared on a successful submit, on a failed submit, and on a view change.
- It is never written to `localStorage`, `sessionStorage`, a cookie, or plugin data.
- It is never logged. There is no `console` call anywhere in the component.
- It is never put in a URL or a query string, so it cannot reach browser history or a `Referer`.
- `autoComplete` is `current-password` on sign-in and `new-password` on sign-up and reset, which is
  what lets a password manager help rather than guess.

`test/memberAuth.test.ts` asserts the storage and logging absences against the comment-stripped
source, so a comment mentioning `localStorage` can neither satisfy nor break the check.

### 9.6. The Reset Token Arrives In A URL, Which Is The Weakest Link

The reset link is `https://creatorsite.com/reset-password?token=...`. A URL is the one place a
secret is hardest to contain: it lands in browser history, in the `Referer` header of any outbound
request from that page, and in any analytics script the creator has installed.

What the component does about it:

- Reads the token once, into component state, and never re-reads `location`.
- Calls `history.replaceState` to strip the query string after a successful reset, so the token is
  not left in the address bar or in that history entry.
- Never puts the token in an error message, which is where tokens usually leak into support tickets.

What it cannot do: stop the token reaching an analytics script that reads `location.search` on load,
or shorten the 15-minute window. Both are the backend's and the creator's to own. Single use and a
15-minute expiry, both server side, are what actually bound the exposure.

### 9.7. Property Controls, Now Thirteen

The three from FP-02 section 3.2, appended to the ten in section 4 above:

| Control | Type | Default | Hidden when |
| :--- | :--- | :--- | :--- |
| `enablePasswordAuth` | `Boolean` | `true` | never |
| `defaultAuthMethod` | `Enum`, `password` or `otp` | `password` | `enablePasswordAuth` is off |
| `requirePasswordStrength` | `Boolean` | `true` | `enablePasswordAuth` is off |

`defaultAuthMethod` picks the first view only. The visitor can always switch, because a creator who
defaults to password has not thereby decided that a visitor who prefers a code cannot have one. The
switch link hides when only one method is available.

One combination needs care: `enablePasswordAuth` on and `emailEnabled` off. Both the password form
and the OTP form need an email field, so turning email off turns both off and leaves only SSO. The
existing "no sign in method is enabled" note already covers the case where SSO is off too.

### 9.8. The Four Endpoints, And What Is A Proposal

Section 5.1 already records that PRD section 10.4 lists no member OTP route and that the two OTP
paths are proposals. FP-02 adds four more in the same position:

```
POST /api/member/register          { email, password, name }
  200  Set-Cookie session
  400  { reason: "weak_password" | "email_already_exists" }

POST /api/member/login-password    { email, password, rememberMe }
  200  Set-Cookie session
  401  { reason: "invalid_credentials" | "account_locked" }
  429  { reason: "rate_limited", retryAfterSeconds }

POST /api/member/forgot-password   { email }
  200  always, whether or not the address is registered

POST /api/member/reset-password    { token, newPassword }
  200  all other sessions invalidated
  400  { reason: "token_expired" | "invalid_token" | "weak_password" }
```

**All four are declared by FP-02 and none appears in PRD section 10.4.** Same standing as the OTP
pair: written in the component as proposals, not quotations, and conflict C11 in the ledger now
covers six routes rather than two. `siteId` is omitted from every body, because the backend derives
it from the request origin; a client-supplied `siteId` is a cross-site read waiting to happen.

Two response details the component depends on:

- `register` returning 400 `email_already_exists` **is** an enumeration oracle, and FP-02 specifies
  it. It is defensible for sign-up in a way it would not be for sign-in, because a form that
  silently fails to create an account is unusable. Recorded as conflict C16.
- `reset-password` invalidating other sessions is what makes a reset a recovery rather than a
  password change. The component cannot verify it, which section 9.10 records.

### 9.9. What FP-02 Does Not Build

- **No panel customizer.** Still true, and still unscheduled. A creator configures all thirteen
  controls in Framer's sidebar. Section 3.4 already records this.
- **No email verification gate.** `register` may fire a verification email and the member is signed
  in regardless. Gating access on a verified address is a product decision nobody has made.
- **No "remember me" beyond a flag.** The checkbox sends `rememberMe: true` and the cookie lifetime
  is entirely the backend's. The component cannot observe a 30-day cookie.
- **No password change from inside the component.** That belongs to `<MemberDashboard>`, F06, task
  5.1, where the member is already authenticated.
- **No breach-corpus check.** Section 9.3.

### 9.10. Verification For FP-02

| FP-02 criterion | How it is checked | Needs a human |
| :--- | :--- | :--- |
| Minimum 8 characters, email format | `test/credentials.test.ts` over the real functions | No |
| Strength rules match between the two copies | `test/credentialsParity.test.ts`, with a proof it can fail | No |
| No password reaches storage, console, or a URL | `test/memberAuth.test.ts` over comment-stripped source | No, for absence. Yes, to watch the network panel |
| View transitions sign-in, sign-up, forgot | Source assertions only. **No test renders this**, blocker B5 | Yes |
| Show and hide password toggle | Source assertion that it exists | Yes |
| Tab order email, password, toggle, submit | Nothing automated can check this | Yes |
| Lockout after 5 attempts for 15 minutes | Server side. The component renders the reason | Yes, and only against a real backend |
| Timing-safe identical responses for unknown emails | Server side, and **not observable from the client** | Yes, backend review |
| Reset invalidates other sessions | Server side | Yes, backend review |
| Reset token stripped from the URL after use | Source assertion on `replaceState` | Yes |

The last four cannot be closed in this repository at all. Two of them, timing safety and session
invalidation, are the ones most likely to be quietly missing in a first backend implementation, so
they are named here rather than assumed.

---

## 10. Dedicated Auth Screens

Added 2026-10-15 on request: a separate canvas component for each flow, so a site's login,
registration, reset, and code sign-in pages each hold the one form they need. `<MemberAuth>` is
kept unchanged for creators who want every flow in one box or in a modal.

### 10.1. One Engine, Five Deployments

| Builder entry | File deployed | Component | Screen |
| :--- | :--- | :--- | :--- |
| Member Auth | `MemberAuth.tsx` | `MemberAuth` | `all` |
| Member Login | `MemberLogin.tsx` | `MemberLogin` | `login` |
| Member Registration | `MemberRegister.tsx` | `MemberRegister` | `register` |
| Password Reset | `MemberPasswordReset.tsx` | `MemberPasswordReset` | `reset` |
| OTP Verification | `MemberOtpVerify.tsx` | `MemberOtpVerify` | `otp` |

All five come from the one authored `src/canvas-components/MemberAuth.tsx`. The generator bakes
`screen` into the config block and, for the four dedicated ones, renames the default export and
the `addPropertyControls` call. The rename asserts each pattern occurs exactly once and throws
otherwise, because a rename that missed the controls would deploy a component with an empty
sidebar and no error anywhere.

Four copies of a 2,300 line component were the alternative and were rejected. The flows share the
session cookie handling, the site key header, the OAuth origin check, the password policy, and the
open redirect guard. Four copies is four places for a security fix to be missed, and four more
parity tests holding them together.

### 10.2. What A Dedicated Screen Changes

- **Starting view** is fixed: login opens on sign in, register on sign up, reset on the email form
  (or the new password form when the emailed link's `?token=` is present), otp on the code form.
- **No sign in and sign up tabs.** Each flow lives on its own page, so the tabs become links.
- **Cross-flow links navigate** instead of switching views: "Forgot password?" to the reset page,
  "Create an account" to the sign up page, "Back to sign in" and "Use a password instead" to the
  login page, "Email me a code instead" to the code page. A link is hidden when its path is empty,
  is not site-relative, or is the page the visitor is already on.
- **Provider buttons** appear on login and register only. "Continue with Google" on a reset page
  would sign someone in when they asked to reset.
- **The headline control governs the screen's main view.** Each ships with its own defaults, for
  example "Welcome back" on login, instead of the combined component's "Sign in to continue".

### 10.3. Property Controls

The same seventeen as `<MemberAuth>`, with the irrelevant ones hidden per screen:

| Control | Shown on |
| :--- | :--- |
| Email Sign In, Password Auth, Default Method | Member Auth only |
| Google, Apple, GitHub, Discord | Member Auth, Login, Register |
| Strong Password | Member Auth (when password is on), Register, Reset |
| Sign In Page | Register, Reset, OTP |
| Sign Up Page, Reset Page, Code Sign In Page | Login |

Link paths default from Settings at deploy time. Sign Up Page is emitted empty when Settings has
sign up on the login path, which is the default, so a fresh `<MemberLogin>` does not link to
itself. **A creator using separate pages should set the sign up path in Settings, or in the
sidebar.** Code Sign In Page has no Settings field and starts empty, so the login screen's code
link is hidden until it is set.

### 10.4. Verification

`test/authScreens.test.ts`, 34 tests: each screen deploys to its own file under its own export name
with its screen baked in, emits exactly the fields the config interface declares, parses, and
carries the connection; Member Auth is unchanged; the self-link rule; the rename refusing a source
it cannot apply to. `test/memberAuth.test.ts` updated for the four new controls and the new hiding
rule.

**Unverified, needs a human:** all five rendered on the canvas and on a published site; each link
landing on the right page; the reset screen switching to the new password form from a real emailed
link; the OTP screen against a running backend. The send and verify endpoints are now built in
`memberframe-backend/src/routes/member.ts`, so conflict C24's 501 no longer describes the code, but
no code has been emailed and verified end to end from a published page.
