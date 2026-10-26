# Feature: Sign-in Methods and Account Linking

Manage shows how each member signed up and every social sign-in linked to them. A member who uses Google and later GitHub on the same email stays one member, with two linked sign-ins, linked only when the provider verified the address.

**PRD reference**: F05 (member auth), F02 (Manage), requested by the product owner 2026-10-20
**Status**: awaiting review
**Tasks**: unscheduled

---

## 1. Overview and Problem Solved

- Manage showed no sign-in method, so the creator could not tell an email sign-up from a Google one.
- Every provider looked a member up by email alone, and Discord linked even an address Discord had not verified. Anyone with a Discord account set to someone else's unverified address could sign in as that member.

### 1.1. Decisions (2026-10-20)

| Question | Decision | Why |
| :--- | :--- | :--- |
| Same email, another provider | One member, a second linked identity | The industry default (Auth0, Clerk, Firebase "one account per email", Supabase). A member expects one account and one plan |
| When a new provider links | Only when the provider says it verified the email | An unverified address proves nothing about who owns the account |
| Unverified email, account exists | Refused: "This email already has an account. Sign in the way you first did." | The other choice is a takeover |
| Linking to an unconfirmed password account | The password is cleared, the email is marked confirmed, and its sessions end | "Pre-hijacking": someone may have registered the address first with their own password |
| Finding a returning member | By the provider's own user id first, then the email | Survives an email change at the provider |
| Unlinking | Not built | It needs a ConfirmDialog and a rule against removing the last sign-in method |

## 2. User Flows

### 2.1. Member

1. Signs up with Google: a new member, `signupMethod = google`, one identity.
2. Later signs in with GitHub on the same verified email: the same member, a second identity.
3. Signs in with Discord on an unverified address that already has an account: refused with the message above.

### 2.2. Creator (Manage)

- **Members list:** a provider mark after the name when the account was made with a provider. Hovering it shows "Signed up with Google".
- **Member flyout, Sign-in methods:**
  - **Signed up with:** Google, with the date. Or Email and password, Added by you, or Not recorded for members from before this feature.
  - **One line per linked provider:** the email and when it was last used. "None" when nothing is linked.
  - **Password:** Set, or Not set.

## 3. Architecture

- **Backend:**
  - `prisma/schema.prisma`: `Member.signupMethod` and the new `MemberIdentity` table, unique on `(siteId, provider, providerUserId)`. Migration `20261023000000_member_identities`.
  - `services/memberIdentityService.ts`: `decideOAuthLink` (the pure rule) and `resolveOAuthMember` (the database work).
  - `routes/member.ts`: `completeOAuthMemberLogin` uses the service. Every callback passes the provider's id (Google `sub`, GitHub `id`, Discord `id`, Apple `sub`).
  - `routes/site.ts`: the member list and record carry `signupMethod`, `identities`, and `hasPassword`. The password hash itself never leaves the server.
- **Plugin:**
  - `components/providerMarks.tsx`: one-colour marks, shared with the Settings integration cards.
  - `MemberRow.tsx`, `MemberFlyout.tsx` (`MemberSignInMethods`), `types/site.ts`.
- **Canvas:** `MemberAuth.tsx` maps the new refusal reasons to plain messages.

## 4. Security Fixes in the Same Change

- **Signed OAuth state** (`lib/oauthState.ts`):
  - **Before:** `state` was plain base64 JSON. Anyone could write one whose `returnTo` was their own site, send it as a sign-in link, and receive the member's one-time code, then exchange it for a session.
  - **Now:** the state is HMAC-signed with `INSTANCE_SEAL_SECRET` under its own prefix and expires in 10 minutes. The callback takes the site only from a valid state. `returnTo` was checked against the allowlist when the state was signed, and cannot be changed after.
- **Apple:**
  - **Before:** the email was read from an `id_token` posted to the callback, with no signature check. Anyone could post one and sign in as any member.
  - **Now:** the posted token is ignored. The callback exchanges the code with Apple and checks the returned token's issuer, audience (the site's client id), expiry, subject, and `email_verified`.
- **GitHub:** the address always comes from `/user/emails`, primary and verified first. With no verified address, the sign-in is refused (`github_email_unverified`).
- **Discord:** `verified: false` is refused (`discord_email_unverified`).
- **Not covered here:** binding the state to the browser with a cookie. That would stop "login CSRF", where a victim is signed into the attacker's account. It needs a `SameSite=None` cookie, because Apple's form post is cross-site.

## 5. Data Contracts

```
GET /api/site/members, member records (creator)
  signupMethod: "email" | "google" | "apple" | "github" | "discord" | "added" | null
  identities: [{ provider, email, createdAt, lastUsedAt }]
  hasPassword: boolean

OAuth refusal reasons (in #mf_oauth_error): email_unverified_link, github_email_unverified, discord_email_unverified
```

## 6. Testing

- **Backend:**
  - `test/oauthLinking.test.ts`: the rule; Google then GitHub as one member; found by identity after an email change; refused when unverified; the pre-hijacking reset; a confirmed password kept; the state signature and expiry.
  - `test/oauthState.test.ts`: Apple's claims check, and the callbacks' source rules.
- **Plugin:** `test/signInMethods.test.ts`: labels, the flyout section (including Not recorded and an older backend), and the row mark.

## 7. Human Verification

- [ ] Sign up with Google: the row mark and "Signed up with: Google".
- [ ] Sign in with GitHub on the same email: one member, two linked lines.
- [ ] A Discord account with an unverified email that matches an existing member: refused, with the message.
- [ ] Apple sign in still works after the code exchange change.

## 8. Settings Open In A Sheet, 2026-10-25

Following the Framefic UI kit (design-system.md v0.5.0), a provider's card in Settings, Integration no longer expands in place. The card keeps its status badge and its enable toggle; clicking it opens the provider's fields in a kit `Sheet`, a centered dialog (label on top, help in an info tip beside it, Save settings pinned in the footer). One sheet is open at a time, through `IntegrationPanel`'s `openId`. Closing discards unsaved edits.
