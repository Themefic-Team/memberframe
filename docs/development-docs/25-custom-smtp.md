# Feature: Custom SMTP per Site

Technical development specification, user flow, architectural wiring, and testing checklist for letting each creator send their members' emails through their own SMTP server.

**PRD reference**: none, requested by the product owner on 2026-10-18
**Status**: in progress
**Tasks**: SMTP-1 (see [`../IMPLEMENTATION-STATUS.md`](../IMPLEMENTATION-STATUS.md))

---

## 1. Overview and Problem Solved

- **Feature Name**: Custom SMTP (Settings, Config, Email)
- **Target Audience**: Framer Creator
- **Value Proposition**: Every member email (sign-in code, email confirmation, password reset, password changed) went out from one platform sender configured in the server's `.env`. A creator could not send from their own domain, so codes arrived from an address their members did not recognise, and deliverability depended on the platform's reputation. Now each site can send through its own SMTP server, from its own name and address.
- **Priority Tier**: P1: Creator Enhancement

### 1.1. Decisions (product owner, 2026-10-18)

| Question | Decision |
| :--- | :--- |
| Where the settings live | Settings, Config, an "Email sending" card under Membership |
| A site with no SMTP set | Uses the platform sender, as before. Custom SMTP is optional |
| A site whose SMTP fails | The email falls back to the platform sender, so a member is never locked out; the failure is logged and shown on the card |

### 1.2. What does not change

- The creator's own connect code (`creatorCodeMail`) has no site and always uses the platform sender.
- Email templates and their content are unchanged. Only the transport and the From line change.
- The server's `MAIL_DRIVER=log` still writes the platform fallback to `storage/mail/`. A site's own SMTP sends for real in every environment, since the creator configured it to.

---

## 2. User Flows

### 2.1. In-Plugin Configuration Flow (Framer Designer)

1. **Settings, Config.** An **Email** section (title and one-line subtitle) under Membership, holding a **Custom SMTP** card in the integration-card accordion style. The badge uses the Integration cards' words: "Not connected" when off, "Connected" when on, "Send failed" when the latest custom send failed.
2. Open the card. Kit field rows, label left and control right, every explanation in the label's info tip and none as a paragraph: **Host**, **Security** (a `<Select>`: STARTTLS (587), SSL/TLS (465), None (unencrypted); changing it moves the port while the creator has not typed their own), **Port**, **Username**, **Password** (write-only: "Saved. Type to replace" once stored), **From name**, **From address**, **Reply-to** (optional).
3. **Save and turn on** / **Save** (secondary button; the view's one primary CTA stays "Save settings"). Validated in the panel and again on the server.
4. The switch in the card bar turns custom sending on and off immediately, keeping the values.
5. Once on: a **Test address** row and a **Send test email** button. The test goes through the site's SMTP only, never the fallback.
6. One banner at most: the test result when there is one, otherwise "Last email failed" with the server's reason when the latest custom send failed. A success needs no banner; the badge says Connected.

### 2.2. Visitor / Member Runtime Flow

1. A member asks for a code, confirms their email, or resets their password.
2. If the site's SMTP is on and complete, the email goes through it, From "<From name>" <From address>, with Reply-to when set.
3. If that send fails (wrong password, server down, refused host), the failure is logged and the same email goes out through the platform sender. The member sees no difference.

---

## 3. Architecture and File Inventory

- **Storage**: the site settings document, `integrations.custom_smtp` = `{ enabled, values: { host, port, security, username, fromName, fromAddress, replyTo }, secretsPresent }`. The password is a secret field (`SECRET_FIELDS.custom_smtp = ["password"]`), sealed into `integration_secrets` with the AES-256-GCM box like the sign-in secrets. No schema change.
- **Backend**:
  - `src/lib/siteSmtp.ts`: `SITE_SMTP_ID`, value validation (`smtpValueProblems`), `readSiteSmtp`, the private address check (`isPrivateAddress`), host resolution (`resolveMailHost`), and the transport options.
  - `src/lib/mailer.ts`: `sendMail` tries the site's SMTP first for any mail with a `siteId`, logs it as driver `site_smtp`, and falls back. `sendWithSiteSmtp` sends with no fallback, for the test.
  - `src/lib/siteSettings.ts`: a save that turns `custom_smtp` on is validated.
  - `src/services/integrationSecrets.ts`: `custom_smtp: ["password"]`.
  - `src/routes/email.ts`, mounted at `/api/site/email`: `GET /status`, `POST /test`.
  - `src/config/env.ts`: `SITE_SMTP_ALLOW_PRIVATE_HOSTS`.
- **Plugin**:
  - `src/components/settings/EmailSettings.tsx`: the card.
  - `src/utils/smtpSettings.ts`: draft, validation, and labels, pure and tested.
  - `src/services/emailSettingsService.ts`: the two requests.
  - `src/components/settings/ConfigPanel.tsx`, `src/components/tabs/SettingsTab.tsx`: wiring.

### 3.1. Host safety

A creator types the host, so the server would connect wherever it is told. Without a check, the test button could probe the platform's own network (`127.0.0.1:6379`, `169.254.169.254`, `10.x`).

- The host is resolved before connecting, and every resolved address must be public: no loopback, private, link-local, carrier-grade NAT, multicast, or reserved range, IPv4 or IPv6 (including IPv4-mapped IPv6).
- The connection is made to the resolved address, with the TLS server name set to the typed host, so a DNS answer cannot change between the check and the connect.
- The port must be 25, 465, 587, or 2525.
- `SITE_SMTP_ALLOW_PRIVATE_HOSTS` lifts both rules, so a developer can point a site at Mailpit (`127.0.0.1:1025`). It defaults to on outside production and off in production.
- Timeouts: 8 seconds to connect and greet, 15 seconds per socket read, so a dead host delays the fallback by seconds, not minutes.

---

## 4. Framer Property Controls Specification

None. This is a plugin setting with no canvas component.

---

## 5. Data Contracts and Core User Schema

```
GET  /api/site/email/status?siteId=        creator
  -> { enabled, configured, last: { at, sent, error } | null }

POST /api/site/email/test   { siteId, to }  creator, 5 per site per 10 minutes
  -> { sent: true } | { sent: false, error: "<server's reason>" }
```

`configured` is true when every required value and the password are stored. `last` is the newest `email_logs` row for the site with driver `site_smtp`.

Validation, server and panel:

| Value | Rule |
| :--- | :--- |
| host | required, a hostname or IP, at most 253 characters; not `localhost` or a private IP literal unless private hosts are allowed |
| port | a whole number; 25, 465, 587, or 2525 unless private hosts are allowed (then 1 to 65535) |
| security | `ssl`, `starttls`, or `none` |
| username | optional, at most 255 characters |
| password | required to send; stored sealed, never returned |
| fromAddress | required, an email address |
| fromName | optional, at most 100 characters, no line breaks |
| replyTo | optional, an email address |

---

## 6. Verification and Testing Checklist

- [ ] Backend: `smtpValueProblems` accepts a complete config and names each bad value
- [ ] Backend: `isPrivateAddress` covers IPv4, IPv6, and IPv4-mapped ranges
- [ ] Backend: a save that turns `custom_smtp` on with a bad value is refused
- [ ] Backend: `sendMail` uses the site SMTP when on, falls back on failure, and logs both rows
- [ ] Backend: the test route sends with no fallback and is rate limited
- [ ] Plugin: draft validation and the card's badge states
- [ ] Gates: lint, design lint, tsc, tests, build in both repositories
- [ ] Manual: Mailpit as the site SMTP in development; a real provider in production

## 7. Design Review (2026-10-18)

The first card broke the kit in four places, fixed the same day: a `<Segmented>` for Security (the inventory keeps Segmented for switching views, and three labels overflowed the 160px control column); help paragraphs inside the card (section 8: a hint is an info tip, the slot under a field is for errors only); a two-line badge and a cut title ("MemberFrame sender", "Email sending (SMTP)"); and the password and test fields in a wrapper with an icon button, which left them narrower than every other row. `test/smtpSettings.test.ts` now pins the Select, the absence of help paragraphs and of that wrapper, and badges of at most two words.
