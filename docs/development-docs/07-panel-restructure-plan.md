# 07. Panel Restructure Plan

> **Status**: steps 1 to 3 are built. Steps 4 to 7 are not. Section 5 has the
> current state of each.
> Recorded 2026-10-13 from the five-tab restructure brief, answered the same
> day, and built against those answers.
>
> The answers in section 7 were: drop the Builder customizer, and build the
> structure for everything else before the detail. So Builder is simplified,
> Settings is split, and the Integration catalogue exists with its registry,
> its cards, and its storage rule enforced on both sides. **Manage is
> deliberately untouched**: every change listed in section 3.1 is a design
> decision, and those are the details still to come.

---

## 1. The Structure, Restated

Five tabs, in this order, which is the order a creator meets them in reverse:
they must Connect before anything else works, and Home is where they land.

| #   | Tab      | State          | This plan                                                      |
| :-- | :------- | :------------- | :------------------------------------------------------------- |
| 1   | Home     | Keep           | No change                                                      |
| 2   | Builder  | Keep, simplify | Drop the gate customizer. Pick a component, preview it, add it |
| 3   | Manage   | Keep, redesign | Same data, better structure                                    |
| 4   | Settings | Split          | Two sub-tabs: **Config** and **Integration**                   |
| 5   | Connect  | Keep           | No change                                                      |

The one structural change is Settings. Everything else is subtraction or
polish.

---

## 2. Builder: Drop The Customizer

### 2.1. The Observation Is Correct

The Builder tab currently renders six configuration rows for `<MemberGate>`:
required tier, locked state, blur amount, redirect target, lock title, lock
message. Every one of them is **also** a Framer property control on the
component itself, which means a creator configures the same value twice in two
places and the panel's copy is only the starting value.

`<MemberAuth>` already works the other way: it is inserted with its defaults and
configured in Framer's sidebar, and nothing is worse for it. `<MemberDashboard>`
does the same. The gate is the odd one out, for the historical reason that it was
built first, before the property controls existed.

### 2.2. What Builder Becomes

```
  Component        [ Member Gate            v ]

  +-------------------------------------------+
  |  Live preview                             |
  |  [ Guest | Free | Silver | VIP | Failed ] |
  |                                           |
  |        (the component, in that state)     |
  +-------------------------------------------+

  Membership pages
    /login            Where a locked gate sends a signed-out visitor
    /reset-password   The page the emailed reset link opens
    /dashboard        Where a member lands after signing in
  [ Create membership pages ]

  [ + Add to canvas ]
```

Picker, preview, pages, insert. One `.primary-cta`.

### 2.3. Keep The State Switcher, Drop The Form

These are two different things and only one of them is redundant.

**The state switcher is the reason to open the panel.** Guest, Free, Silver, VIP,
Failed is PRD feature F04, the Live Preview Studio, and it answers a question
Framer's canvas cannot: what does a Silver member see, versus a VIP. There is no
way to check that on the canvas without publishing and signing in as five
different people.

**The form is redundant**, for the reason in 2.1.

### 2.4. What This Costs

The preview needs _something_ to render. Today it renders `gateConfig` from the
customizer. With the form gone it renders the component's defaults, which means
the preview shows the gate as it will be the moment it is inserted, and **not**
as it will look after the creator changes `requiredTier` in the Framer sidebar.

That is a real loss and it is worth being honest about: the preview becomes
"what you are about to insert" rather than "what you have configured". It is
still the only place to see all five member states.

> **Decision needed.** This reduces PRD task 1.3's scope and feature F04's
> second half. Confirm that is intended, because the customizer is specified
> work that currently passes its gates.
>
> There is a middle option if the loss above matters: keep `requiredTier` alone,
> drop the other five. It is the one value the preview genuinely depends on, and
> the other five are all cosmetic. Say which you want.

---

## 3. Manage: Design Structure

The data and the calls are right. The structure is the problem: Members and
Tiers sit behind a segmented control and the members view is a flat table that
has to carry an avatar, a name, an email, a tier, a status, and a row menu
inside 360 pixels.

### 3.1. What I Would Change, Pending Your Direction

| Change                                                                          | Why                                                                                                         |
| :------------------------------------------------------------------------------ | :---------------------------------------------------------------------------------------------------------- |
| A summary strip above the segmented control: total members, active, by top tier | A creator opens Manage to ask "how is it going", and today the answer is a table they have to count         |
| Two-line member rows: name over email, tier and status as a right-aligned pair  | One line at 360px means the email is truncated to uselessness, which is the one field a creator searches by |
| Status as a coloured dot plus a word, not a word alone                          | Four statuses scanned down a column is slow. A dot is scannable and the word keeps it accessible            |
| Tiers as cards with their price and member count, not a form list               | A tier is a thing a creator thinks about as a whole. The current editor is a form that happens to repeat    |
| Filters collapse into a single row with a count badge when inactive             | Three controls permanently occupying 90px of a 640px panel for a filter most sessions never use             |

> **Decision needed.** "Increase design structure" could mean any of these or
> none. Pick the ones you want and I will spec them properly before building.
> The member count and tier member count both need a backend field that does not
> exist yet, so those two are not free.

---

## 4. Settings: Config And Integration

### 4.1. The Split

```
  Settings
  [ Config | Integration ]
```

Same `Segmented` control the Manage tab already uses, so the two tabs behave
identically and a creator learns the pattern once.

**Config** is everything already in Settings today:

- Panel theme
- Membership: the five paths, sign-in method, allow sign ups, strong password
- Default currency and location routing

**Integration** is new, and it absorbs the gateway key vault. Those keys are an
integration's configuration, not a setting, and they are the thing the new tab
exists to hold.

### 4.2. Integration: Catalogue Then Inline Form

A grid of cards. Each card is one integration with a name, a one-line
description, a category badge, and an **Install** button. Clicking Install
expands that card into its own form, in place, with the fields that integration
needs. Save, and the card shows as connected.

```
  [ Config | Integration ]

  +--------------------------+  +--------------------------+
  |  [S]              STORE  |  |  [L]              STORE  |
  |  Stripe                  |  |  Lemon Squeezy           |
  |  Cards and 135           |  |  Payments, subscriptions |
  |  currencies worldwide.   |  |  and global tax.         |
  |             [ Install ]  |  |             [ Install ]  |
  +--------------------------+  +--------------------------+

  clicking Install expands that card:

  +-----------------------------------------------------+
  |  [S]  Stripe                                 STORE  |
  |                                                     |
  |  Publishable key   [ pk_live_...              ]     |
  |  Secret key        [ ****************         ]     |
  |  Webhook secret    [ ****************         ]     |
  |                                                     |
  |  Test mode detected from the key prefix.            |
  |                      [ Cancel ]  [ Connect ]        |
  +-----------------------------------------------------+
```

At 360 pixels the grid is one column, not three. The reference layout is three
across because it is a full-width web page.

### 4.2.1. The Three Controls On A Card

Added after the first review of the built tab.

**An enable switch, on the collapsed card.** A `Toggle`, so it commits the
moment it moves, per PRD section 7.5. Turning an integration off is what a
creator reaches for when something is wrong in production, and making them find
a Save button after it would be the wrong answer to that moment.

It is disabled until the integration holds something, because an enabled switch
beside a status of "Not connected" is two parts of one card disagreeing. It is
**not** disabled merely because nothing consumes the integration yet: the card
already says so, and blocking the switch too would say it twice while removing a
choice that costs nothing. That rule is `canEnable` in the registry, so it is
tested rather than asserted in a component.

**A reveal button, on every secret field.** A key is pasted, and the one thing a
creator needs to check is whether they pasted the right one into the right
field. A permanently masked input makes that impossible. It reveals what is
being typed now and never a stored value, because a stored secret is never
returned to the panel at all, and it resets whenever the form opens or closes.

**Visible field chrome.** `.framefic-input` carries a transparent border and a
tertiary background, which reads as a field against the panel's own background
and stops reading as one inside a card, where the two surfaces are close. In
dark mode the first build rendered as grey placeholder text floating in the
card. An input inside a card now gets a real border: the card changed the
context, so the card restates the affordance.

### 4.3. The Registry

One declaration per integration, in a registry file, the same shape the
component picker already uses. The registry drives the card, the form, the
validation, and what gets stored, so adding an integration is one entry and not
five edits.

```typescript
interface IntegrationField {
  key: string;
  label: string;
  type: "text" | "password" | "url" | "select";
  placeholder: string;
  required: boolean;
  /** Never leaves the server once saved. See 4.4. */
  secret: boolean;
}

interface IntegrationDefinition {
  id: "stripe" | "lemonsqueezy" | "razorpay" | "google_oauth" | "github_oauth";
  name: string;
  category: "store" | "auth" | "utility";
  description: string;
  fields: IntegrationField[];
  /** The feature that consumes it, so an unbuilt one says so rather than lying. */
  consumedBy: string;
  available: boolean;
}
```

`available: false` is deliberate and it is the same honesty rule the component
picker follows: a card for an integration nothing consumes yet should say "arrives
with payments" rather than accepting a key and silently doing nothing with it.

### 4.4. Where The Values Go, And This Is The Important Part

**Two destinations, split by whether the value is a secret.** They cannot share
one, and this is the constraint the whole tab has to be built around.

|            | Destination                                          | Why                                                                                         |
| :--------- | :--------------------------------------------------- | :------------------------------------------------------------------------------------------ |
| Non-secret | `site_settings.settings.integrations`                | Publishable keys, store ids, client ids, enabled flags, mode. Read back to the panel freely |
| Secret     | `gateway_configs`, encrypted, **does not exist yet** | Secret keys, webhook secrets, client secrets                                                |

A secret must never enter the settings document. That document is returned to the
panel whole on every connect and every settings read, so a secret placed there
would be handed to any creator session that asks for it. PRD section 8 F03 is
explicit that "a secret key is never present in any client-side response
payload", and `types/site.ts` already has no field for one.

The read shape for a saved secret is a masked suffix and a mode, never the value.
`components/settings/gatewayKeys.ts` already does the prefix detection and
masking, and it moves into this tab unchanged.

> **This is the blocker.** `gateway_configs` with AES-256-GCM is backend PRD
> phase B3 and is not built. **The Integration tab cannot store a single secret
> key until it is.** Three ways forward, in the order I would take them:
>
> 1. Build `gateway_configs` first, then the tab. Correct, and it means the tab
>    arrives working.
> 2. Build the tab with only the non-secret half, so Google and GitHub OAuth
>    client ids save and the secret fields are visibly disabled with a reason.
>    Half a feature, honestly labelled.
> 3. Build the tab against the settings document and move the secrets later.
>    **Do not do this.** It would put live payment secrets in a document that is
>    returned to the client, and "we will move it later" does not un-leak them.

### 4.5. One Card Per Gateway, Not Two

The reference layout has **Stripe** and **Stripe Sandbox** as separate cards, and
the same for Lemon Squeezy. I would not copy that.

A gateway's mode is already derivable from the key itself: `pk_live_` against
`pk_test_`, which `gatewayKeys.ts` detects today and shows back to the creator.
One card per gateway, with the mode shown as a badge once a key is pasted.

Two cards means a creator can have both configured at once and **nothing on
screen says which one a real checkout will use**. That is a question a creator
would answer by taking a payment, which is the worst possible way to find out.

> **Decision needed.** Confirm one card per gateway. If you want the two-card
> layout for some reason I have not thought of, it needs an explicit active/test
> switch somewhere, and that switch becomes the most consequential control in
> the panel.

### 4.6. Razorpay

PRD section 8 F03 names three gateways: Stripe, Lemon Squeezy, and Razorpay. The
reference layout shows the first two. Razorpay stays in the registry unless you
want it dropped, which would be a PRD change rather than a layout one.

---

## 5. Sequence

Each step is independently shippable and each leaves the gates green. Numbered
so they can be picked off one at a time.

| Step | Work | State |
| :--- | :--- | :--- |
| 1 | Builder: remove the customizer, keep the preview | **Done** |
| 2 | Settings: split into Config and Integration | **Done** |
| 3 | The integration registry and the card grid, non-secret fields only | **Done** |
| 4 | `gateway_configs` with AES-256-GCM, backend | Not started. Unblocks step 5 |
| 5 | Secret fields in the integration forms | Blocked by step 4 |
| 6 | Manage redesign | Waiting on the decisions in 3.1 |
| 7 | Google and GitHub OAuth integrations become real | Waiting on FP-04, FP-05 |

Steps 2 and 3 landed together rather than separately. The plan had them apart so
that moving the vault unchanged could be verified by it still working, but the
registry supersedes `GatewayVault.tsx` outright rather than wrapping it, so
moving it and then deleting it would have been two commits to reach the same
file. `GatewayVault.tsx` is gone; `gatewayKeys.ts` stays and its prefix
detection is what the new card uses.

**One loose end from that.** `VAULT_FIELDS` and `GATEWAY_AVAILABILITY` in
`gatewayKeys.ts` are now referenced only by their own tests. They are superseded
by the registry and should be removed when step 5 replaces `saveGatewayConfig`,
which is the last thing still using the vault draft shape for currency and
routing.

---

## 6. What Does Not Change

Worth stating, because a restructure is where resolved decisions get quietly
reopened.

- **Members and Tiers stay folded into Manage.** PRD section 7.3, resolved
  conflict 3. Five tabs is already a widening of the shell standard (conflict
  C26) and Manage splitting would make it seven.
- **The settings document stays one JSON column.** Integrations become a section
  of it, not a table, apart from the secrets in 4.4.
- **One `.primary-cta` per view.** The Integration tab's expanded card carries
  its own, which is fine because the catalogue and the form are mutually
  exclusive states rather than two things on one screen.
- **No secret is written to panel storage.** The vault draft lives in React
  state and dies with the panel. That is unchanged by moving it.

---

## 7. Questions, Shortest Form

1. Builder: drop all six customizer rows, or keep `requiredTier`? -- Yes
2. Manage: which of the five changes in 3.1? -- need to make starture first i will provide details information letter on
3. Integration: build `gateway_configs` first, or ship the non-secret half? -- need to make starture first i will provide details information letter on
4. One card per gateway with a detected mode badge, confirmed? -- need to make starture first i will provide details information letter on
