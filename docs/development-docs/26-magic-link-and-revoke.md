# Feature: Magic Link and Final Revoke

Technical development specification, user flow, architectural wiring, and testing checklist for two member actions in Manage: emailing a member a one-click sign-in link, and revoking a member's access so that their billing stops too.

**PRD reference**: F02 (member tier cockpit), PRD section 10.3 `POST /api/site/members/:id/magic-link`; conflict C29 in [`06-connect-and-pages.md`](06-connect-and-pages.md)
**Status**: built 2026-10-19, awaiting manual checks
**Tasks**: requested by the product owner on 2026-10-19

---

## 1. Overview and Problem Solved

- **Feature Name**: Send magic link, Revoke access (Manage, member flyout)
- **Target Audience**: Framer Creator, and their members
- **Problems**:
  1. **Send magic link was never built.** No server route answered it, so the button always failed with an error toast (C29).
  2. **Revoke access only changed MemberFrame's own record.** It set `status: canceled` and stopped there:
     - The member's Stripe, Lemon Squeezy, or Razorpay subscription kept charging them.
     - The next renewal set them back to `active`.
     - `isEntitled` let a `canceled` member in until their paid period ended.
     - The gateway's own "ended" webhook, via `recomputeMember`, would drop them to Free with `status: active`.
     - The flyout had no way to undo a revoke.

## 2. User Flows

### 2.1. In-Plugin Flow (Framer Designer)

**Send magic link**
1. Manage, Members, click a member, **Send magic link**.
2. The server emails the member a link from the site's sender: its own SMTP when set (doc 25), MemberFrame's otherwise.
3. Toast: "Magic link sent". If the site has no published address yet, the toast says to publish first.

**Revoke access**
1. **Revoke access**, then confirm. The confirmation now reads: "Revoke access? Their subscription is canceled now, with no refund, and they are signed out."
2. The server makes four changes:
   - Cancels every running recurring subscription at its gateway, at once (`cancelNow`), and marks it `ended`. Lifetime purchases are marked `ended` too.
   - Moves the member to the Free tier with `status: canceled`.
   - Signs them out everywhere (`revokeAllSessionsForMember`).
   - Emits `member.updated` or `member.tier_changed`.
3. The button becomes **Restore access**. It sets `status: active` on the Free tier and cancels nothing. A member who wants their paid tier back buys it again.

### 2.2. Member Runtime Flow

1. The email says "Sign in to {site}" and holds one button. The link is `{site origin}{auth.loginPath}#mf_oauth={code}`.
2. `<MemberAuth>` on that page already exchanges a `#mf_oauth` code. This is the social sign-in handoff (`POST /api/member/oauth/exchange`), so no canvas component changes.
3. The exchange sets the session cookie from the site's own page. With no other tab waiting, it goes to **After sign in**.
4. The code is a member session row, made only to be exchanged:
   - **One hour.** It expires after 60 minutes.
   - **Single use.** The exchange revokes it.
   - **In the fragment.** It is never sent to a server or in a Referer.
   - **Safe from link scanners.** Mail link scanners fetch the page but don't run it, so they cannot use the code up.
5. A revoked member gets no link. The route answers 409 and asks the creator to restore access first.

## 3. Architecture and File Inventory

- **Backend**:
  - `src/services/memberAccessService.ts` (new): `revokeMemberAccess`, `restoreMemberAccess`, `issueMagicLink`.
  - `src/routes/site.ts`: `POST /members/:id/magic-link`, `POST /members/:id/revoke`, `POST /members/:id/restore`.
  - `src/lib/mailer.ts`: `magicLinkMail`.
- **Plugin**:
  - `services/siteService.ts`: `sendMagicLink`, `revokeMember`, `restoreMember`.
  - `components/tabs/ManageTab.tsx`: revoke and restore are their own calls, no longer a PATCH.
  - `components/manage/MemberFlyout.tsx`: Restore access, and the new confirmation text.

**Gateway failure on revoke.** Each running subscription is cancelled first, then marked ended.
- **Gateway refuses** (`GatewayError`): the revoke stops with 502 `gateway_cancel_failed`, naming the gateway. The member is unchanged, so the creator can retry or cancel at the gateway.
- **Gateway has no saved keys:** the subscription is marked ended here. A gateway without keys cannot deliver a verified webhook to undo it.

**Why Free, not the tier they had.** `recomputeMember` drops a member to Free with `status: active` when the tier they hold was bought and nothing is running. It leaves a Free member alone. So only "Free plus canceled" survives the gateway's later "ended" event.

**Delete member is unchanged.** Its confirmation already says the gateway subscription is not cancelled (doc 02, the DELETE route header). That was a recorded decision, so it stays.

## 4. Framer Property Controls Specification

None. No canvas component changes.

## 5. Data Contracts

| Route | Body | Answer |
| :--- | :--- | :--- |
| `POST /api/site/members/:id/magic-link` | `{ siteId }` | `{ sent: true, expiresInMinutes: 60 }`. 409 `member_revoked`, 409 `no_site_url`, 429 rate limited per address |
| `POST /api/site/members/:id/revoke` | `{ siteId }` | `{ member, canceledSubscriptions }`. 502 `gateway_cancel_failed` with `{ gateway }` |
| `POST /api/site/members/:id/restore` | `{ siteId }` | `{ member }` |

`member` has the same shape as the PATCH answer.

## 6. Verification and Testing Checklist

- [x] `test/memberAccess.test.ts`, with Prisma and the adapters mocked:
  - Revoke cancels each running recurring subscription and ends lifetime ones.
  - Revoke moves the member to Free and canceled, and signs them out.
  - A gateway error leaves the member unchanged.
  - Missing keys end the subscription locally.
- [x] Magic link:
  - The URL has the origin, the login path, and the fragment code, with a 60-minute session.
  - A revoked member, and a site with no address, are refused.
- [x] `test/paymentsApply.test.ts`: after a revoke, the gateway's late `ended`, `renewed`, and `cancel_scheduled` events and the sweep leave the member on Free and canceled.
- [x] Gates: plugin lint:css, lint:design, tsc, 884 tests, build; backend tsc, 460 tests.
- [ ] By hand:
  - The email arrives through the site's SMTP.
  - The link signs the member in on the published site and lands on After sign in.
  - A revoked Stripe test subscription shows as canceled in the Stripe dashboard.

## 7. Verified By Whom

Agent: unit tests and gates. Human: the three manual checks above.
