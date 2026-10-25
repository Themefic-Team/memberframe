# Feature: Webhooks

Send member events (sign up, profile update, plan change, delete) to any third-party service, such as Zoho CRM through Zoho Flow, Zapier, Make, n8n, Pabbly, or a creator's own server. A creator can add several webhooks, each with its own events and plans.

**PRD reference**: new, requested 2026-10-17
**Status**: awaiting review
**Tasks**: unscheduled

---

## 1. Overview and Problem Solved

- **Feature Name**: Webhooks
- **Target Audience**: Framer Creator
- **Value Proposition**: A creator's CRM, mailing list, or automation tool learns about a member the moment something happens, with the member's plan and every profile field, without code. One webhook per destination, each listening to just the events and plans it needs.
- **Priority Tier**: P1, Creator Enhancement

### 1.1. Decisions

| Question | Decision | Why |
| :--- | :--- | :--- |
| When is a member "created"? | When the account is real: after the email is confirmed for a password sign up; at once for an email code or social sign in | An unconfirmed sign up is often a typo or a bot. A CRM should not receive it |
| Sent during the request? | No. Each event is queued as a delivery row and sent by a background worker | A slow or down endpoint must never slow down or fail a member's sign up |
| Retries | 6 attempts: at once, then 1 min, 5 min, 30 min, 2 h, 6 h | Survives an endpoint's short outage; gives up after about 9 hours |
| Authenticity | Every request is signed, HMAC SHA-256 with the webhook's own secret | The receiver can prove the request came from MemberFrame and was not replayed |
| Unsafe destinations | Production refuses non-https URLs and any host resolving to a private, loopback, or link-local address | A webhook URL is fetched by our server; without this it could reach the server's own network |
| Plans filter | Empty means every plan. Otherwise the member's plan (old or new for a plan change) must be in the list | "Based on user tiers", from the request |
| Limit | 10 webhooks per site | Each event fans out to every webhook |

---

## 2. User Flows

### 2.1. In-Plugin Configuration Flow (Framer Designer)

1. Settings, Integration, **Webhooks**, **Add webhook**.
2. **Name**: for example `Zoho CRM`.
3. **URL**: the address the service gave you (Zoho Flow webhook trigger, Zapier Catch Hook, Make custom webhook...).
4. **Events**: tick what this destination needs.
5. **Plans**: All plans, or tick the plans that should be sent.
6. **Save webhook**. A signing secret is created; copy it if the receiver checks signatures.
7. **Send test** posts a sample `webhook.test` event and shows the answer at once.
8. **Recent deliveries** lists each attempt with its result, for debugging.

### 2.2. Runtime Flow

1. Something happens to a member (see events).
2. The backend writes one delivery row per matching, enabled webhook.
3. The worker posts it within seconds, and retries on failure.

---

## 3. Events

| Event | Fires when |
| :--- | :--- |
| `member.created` | A new account is confirmed, or created by an email code or social sign in |
| `member.updated` | The member edits their profile, or the creator changes their status in Manage |
| `member.tier_changed` | The plan changes: by the creator in Manage, or by a payment, upgrade, or cancellation. Carries `previousTier` |
| `member.deleted` | The creator deletes the member in Manage |
| `webhook.test` | Send test, from the plugin |

---

## 4. Request Format

`POST <url>` with `Content-Type: application/json` and these headers:

| Header | Value |
| :--- | :--- |
| `X-MemberFrame-Event` | the event type |
| `X-MemberFrame-Delivery` | the delivery id, the same for every retry of one event |
| `X-MemberFrame-Signature` | `t=<unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<raw body>" with the secret>` |
| `User-Agent` | `MemberFrame-Webhooks/1.0` |

Body:

```json
{
  "id": "0192f0c4-...",
  "type": "member.tier_changed",
  "createdAt": "2026-10-17T10:00:00.000Z",
  "site": { "id": "...", "name": "Tabfolio" },
  "member": {
    "id": "...",
    "email": "jordan@example.com",
    "name": "Jordan Okafor",
    "status": "active",
    "tier": { "key": "tier_gold", "name": "Gold" },
    "emailVerified": true,
    "createdAt": "2026-10-01T09:00:00.000Z",
    "profile": { "company": "Acme Design Co" }
  },
  "previousTier": { "key": "free_member", "name": "Free" }
}
```

`profile` holds the creator's custom profile fields (Settings, Fields), keyed by field key. A 2xx answer within 10 seconds counts as delivered.

### 4.1. Field Mapping (Choose Fields)

Instead of the standard body, a webhook can send a flat object: each row picks a value and the key it is sent under. Stored as `field_map` (`[{ source, key }]`, at most 50; null is the standard body), applied when the event is queued, so every retry sends the same body. The headers and signature are unchanged.

| Value (`source`) | Sent |
| :--- | :--- |
| `member.email`, `member.name`, `member.status`, `member.id`, `member.createdAt`, `member.emailVerified` | As named |
| `member.firstName`, `member.lastName` | The name split at the last space. There is always a last name (Zoho CRM requires one): a one-word name is the last name; no name sends the email's local part |
| `member.tier.key`, `member.tier.name` | The current plan |
| `previousTier.key`, `previousTier.name` | The plan before a plan change; null for other events |
| `profile.<field key>` | A custom profile field; null when unanswered |
| `event.type`, `event.id`, `event.createdAt`, `site.name` | About the event |

Keys: letters, digits, `_`, `-`, `.`, starting with a letter or `_`, up to 64, unique. The panel's **Use Zoho CRM fields** fills `Email`, `First_Name`, `Last_Name`, Zoho's Contact API names; add more rows for custom Zoho fields by their API names. The panel previews the exact body for a sample plan change.

Example, mapped for Zoho CRM:

```json
{ "Email": "jordan@example.com", "First_Name": "Jordan", "Last_Name": "Okafor", "Membership_Plan": "Gold" }
```

Verifying a signature (Node):

```js
const [t, v1] = header.split(",").map((part) => part.split("=")[1]);
const expected = crypto.createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
const valid = crypto.timingSafeEqual(Buffer.from(v1), Buffer.from(expected)) && Date.now() / 1000 - Number(t) < 300;
```

---

## 5. Architecture and File Inventory

- **Backend storage**: `outbound_webhooks` and `outbound_deliveries` (migration `20261017000001_outbound_webhooks`)
- **Backend service**: `memberframe-backend/src/services/webhooks/` (events and payload, delivery worker, URL safety, signing)
- **Backend routes**: `memberframe-backend/src/routes/site.ts`, `/api/site/webhooks` (list, create, update, delete, test, deliveries)
- **Event points**: `memberAuthService.ts` (confirmed sign up, code sign in), `routes/member.ts` (social sign in, profile), `routes/site.ts` (Manage tier, status, delete), `services/payments/apply.ts` (paid plan changes)
- **Worker**: `src/server.ts`, every 15 seconds, and immediately after an event
- **Plugin**: `src/services/webhooksService.ts`, `src/components/settings/WebhooksPanel.tsx` in the Integration view

---

## 6. Edge Cases

- **Endpoint down**: retried for about 9 hours, then marked failed; visible in Recent deliveries.
- **Webhook deleted with deliveries pending**: deliveries are deleted with it.
- **Webhook switched off**: no new deliveries; pending ones still finish.
- **A member deleted**: `member.deleted` carries the member as it was just before.
- **Server restart**: pending deliveries are in the database and resume.
- **Secrets**: the signing secret is stored as is; it lets someone sign requests to the creator's own endpoint, nothing more. Gateway secrets stay encrypted as before.

---

## 7. Testing Checklist

### Automated (backend)

- [x] Signature matches the documented formula
- [x] Payload shape, profile fields, previous tier
- [x] Event and plan filters select the right webhooks
- [x] Retry schedule, give up after 6 attempts
- [x] URL safety: https and private addresses in production
- [x] Panel draft validation and routes scoped to the site (plugin)
- [x] End to end on the dev database: a real `member.updated` reached a local listener once, signature valid, row marked delivered

### Human

- [ ] Send test reaches webhook.site, Zapier, or Zoho Flow
- [ ] A real sign up, profile edit, and plan change each arrive once

---

## Panel Cleanup, 2026-10-18

The Integration view was trimmed on request, as Page Locks was (`19-section-locks.md`).

- **Sign in** gained a one-line subtitle, which now carries the pointer to Manage, Payments that used to sit alone at the top of the view.
- **Webhooks**: a one-line subtitle. The four-step "Connect A Service" card is gone: where to get the URL and the 9-hour retry moved into the URL field's InfoTip, and the signature was already in Signing secret's. With no webhooks yet the view shows the kit `<EmptyState>` with one action, Add webhook.
- The `.onpage-guide-card`, `-title`, `-text`, and `-steps` CSS went with the last cards that used them. `.onpage-guide-actions` stays, for the form buttons.

Needs human verification: the view at 360px in both themes.

## Redirects Count as Received; No Delivery Status in the Plugin (2026-10-25)

**The bug:** beta.crmfic.com stored each member, then answered `302`. MemberFrame counted only 2xx as delivered, so it showed "Failed: The service answered 302." It also retried for about 9 hours, which could store the same member again.

**The fix:**
- **Backend:** `sendWebhook` (`memberframe-backend/src/services/webhookService.ts`) counts 2xx and 3xx as delivered. A redirect after a POST means the service took the request. The redirect is still not followed (`redirect: "manual"`), since following it would send the data twice. 4xx, 5xx, a timeout, and a refused connection still retry.
- **Plugin:** the product owner asked for no delivery status. Services answer in their own ways, so a status read from the answer misled more than it helped. Removed:
  - the "Working / Failing" badge on each webhook card
  - the Recent deliveries list, and the fetch behind it
- Send test now reads "Test sent", or the error when the address cannot be reached or refuses with 4xx or 5xx.
- The backend still records deliveries and retries; the endpoints stay.
