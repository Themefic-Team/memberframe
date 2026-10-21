# Feature: Instance Seal (No Copy and Paste) and Live License Checks

Technical development specification for two rules from the product owner (2026-10-19):

1. Every canvas component checks the server, and locks when the site's trial or plan has ended.
2. A component copied and pasted, rather than inserted from the Builder, does not work.

**PRD reference**: F19 (19-pro-lock-and-trial.md), extended.
**Status**: built, awaiting manual checks in Framer

---

## 1. Overview and Problem Solved

- **Live license.** Before this change, a component asked `/api/license` once, when it mounted. A canvas or page left open past the end of a trial stayed unlocked until it was reloaded. It then asked every 60 seconds; since 2026-10-20 nothing polls (section 6): the server pushes license changes to the open plugin, which rewrites the components, and a component asks once on mount and again on a return to the tab after ten minutes.
- **Copy and paste.** Framer's clipboard cannot be switched off by a plugin: it copies a layer and its control values, and it carries a code component into another project with its code file. This feature does not stop the paste. It makes the pasted copy render locked, with the message "Insert this component from the MemberFrame plugin". The only way to a working component is the Builder.

## 2. How It Works

### 2.1. The seal

- The Builder asks the server for a seal before every insert: `POST /api/plugin/instance-seal { siteId }`, which needs the creator's token and an owned site.
- A seal is `s1.<nonce>.<hmac(siteId.nonce)>`, signed with `INSTANCE_SEAL_SECRET`. It is valid only for the site it was issued to.
- It is written into the instance as a hidden property control, `mfSeal`. The plugin also records `seal → node id` in the project's plugin data, under `memberframe.seals`.

### 2.2. The component

- The shared license block (`// @memberframe-license-start/end`, byte-identical in MemberAuth, MemberDashboard, MemberPricing, MeteredPaywall, and ProtectedDownload) sends the seal: `GET /api/license?site=<siteKey>&seal=<mfSeal>`.
- The server answers one of four states:
  - `copied`: no seal, or a seal not signed for this site.
  - `foreign`: the page's `Origin` is neither a Framer editor host nor one of the site's allowed domains. This is a copy pasted into another project and published there.
  - `expired`, `trial`, or `active`: from the license, as before.
- `copied` renders the lock card with the insert message. `expired` renders the upgrade message.
- `foreign` renders its own card, "Domain not allowed yet" (changed 2026-10-20). It used to share the insert message, which told a creator their own component had been pasted when the real cause was a published address missing from the site's allowed domains.

### 2.2.1. Published addresses are allowed automatically

- **The gap:** allowed domains were read from `getPublishInfo()` only when the project was connected. A site first published later (a new `*.framer.app` address, staging, a custom domain) answered `foreign` everywhere it was published.
- **The fix:** the guard pass (section 2.3, When it runs) compares `getPublishInfo()` with the site's allowed domains (`missingPublishedOrigins`) and adds any missing address through `POST /api/site/origins`. The next page load on the published site then succeeds, without a republish. A failed request waits before it is tried again (section 6).

### 2.3. Copies inside the same project

- A paste inside one project carries the same seal, so the seal alone cannot tell the copy from the original. The plugin decides, by comparing node ids:
  - **When it runs:** while the panel is open: on open, a second after the canvas or the selection changes (a paste selects what it pasted), when Framer regains focus, and once a minute as a fallback. A pass that finds the canvas unchanged since the last finished pass stops without a request.
  - **How it finds them:** it walks the component instances that carry an `mfSeal`.
  - **Rule:** a seal whose recorded node id is a different node is a copy. The plugin clears that copy's seal, so it locks.
- Breakpoint replicas (the Tablet and Phone versions of a layer, `originalId` set) are the same layer, not copies, and are skipped.
- A seal the plugin has no record of is checked against this project's site:
  - **This project's site:** recorded, for example after the plugin data was cleared.
  - **Another site:** re-sealed for this site, not locked (changed 2026-10-19).
    - **Why:** the first version locked these. That was wrong after the creator signed in again and the project got a new site: their own components were reported as "pasted" and blurred.
    - **Why it is safe:** the component file is pointed at this site first (`utils/configPatcher.ts`), so it runs on this site's own license, exactly as a fresh insert would.
    - **What still locks:** a second component holding the same seal as another, and an instance that never had a seal.
  - **Repair:** the migration key is now `memberframe.sealsMigrated.v2`, so the first run re-seals instances the old rule cleared.

### 2.4. Instances from before this feature

- On the first scan in a project (`memberframe.sealsMigrated` unset), every instance of a MemberFrame component with no seal gets one, and the plugin records it. Existing work keeps working.
- After that first scan, an unsealed instance stays unsealed and renders locked.

## 3. File Inventory

- **Backend**:
  - `src/lib/instanceSeal.ts`: `issueSeal`, `verifySeal`.
  - `src/routes/pluginBilling.ts`: `POST /instance-seal`.
  - `src/routes/license.ts`: the `seal` and `Origin` checks.
  - `src/config/env.ts`: `INSTANCE_SEAL_SECRET`, required in production.
- **Plugin**:
  - `services/instanceSealService.ts`: request a seal, and the pure copy-detection rule.
  - `hooks/useSealGuard.ts`: the scan.
  - `components/tabs/BuilderTab.tsx`: seal on insert.
  - The license block in five canvas components, plus a hidden `mfSeal` control in each.
  - `framer.json`: the `setAttributes` permission.

## 4. Limits, Stated Plainly

- **Plugin must be open.** A copy inside the same project is caught only while the plugin is open in that project. Until then it renders and works.
- **Cross-project copies:** a copy published in another project locks on its published site straight away, through the domain check.
- **Not a security boundary.** A creator can edit a component's code. The real enforcement is the server: the member API answers 402 when the license has ended, whatever the component shows.
- **Bookmarks are excluded.** Bookmark Button and Bookmarks Tray carry no license block, by the F19 decision, so they are not sealed.

## 5. Verification

- [x] Unit:
  - `issueSeal` and `verifySeal`: valid, tampered, and wrong-site seals.
  - The license endpoint's state for a missing or foreign seal, and for a foreign origin.
  - The copy-detection rule, including replicas, a foreign seal, and migration.
  - License block parity in all five components.
- [ ] In Framer:
  - Insert from Builder: works.
  - Copy and paste in the same project, with the panel open: the copy locks within a few seconds.
  - Leave the canvas idle with the Network panel open: no `instance-seal/verify` requests.
  - Paste into another project: locks there once the plugin opens, and on its published site.
  - End the trial (`npm run trial:reset -- <email> --expire`), with the panel open: canvas components lock within seconds (the license push).

## 6. No Constant Requests (2026-10-20)

The guard once ran every 10 seconds and asked `POST /api/plugin/instance-seal/verify` about every seal it had no record of. The record (`memberframe.seals`) only ever grew, so once writing it failed the same seals were asked about on every pass, and the network panel showed a request every few seconds.

- **Event driven:** `subscribeToCanvasRoot` and `subscribeToSelection`, debounced by a second, plus focus and a one minute fallback.
- **Unchanged canvas, no pass:** `sealFingerprint` (instances, seals, record, migration flag); equal to the last finished pass, the guard stops.
- **Asked once:** answers are remembered for the session per site and seal, so a failed write never repeats a question.
- **Backoff:** a failed request or write waits 30 seconds, 1, 2, 5, then 10 minutes (`nextRetryDelay`). The published-origins sync uses the same backoff.
- **Small record:** `pruneRegistry` keeps only seals still on the canvas or just issued.

Copy detection stays in the plugin: only Framer knows a layer was pasted. The license (trial or plan ended) is pushed by the server instead, 19-pro-lock-and-trial.md 5.1.
