# Feature: Protected Download, Uploaded on the Canvas

The creator uploads a download's file in Framer's own sidebar, and Framer stores it. MemberFrame keeps no files. Who may download is set on the component, the same choices as page and section locks, or a shared password that needs no account. The file's Framer address and the password are moved to MemberFrame's server and cleared from the component, so the published page never carries them.

**PRD reference**: F10 (Upgrade to Download), FP-12. Requested by the product owner 2026-10-22: "we don't want to invest on storage".
**Status**: awaiting review
**Supersedes**: Manage, Files (uploads to MemberFrame's disk), removed.

---

## 1. Overview and Problem Solved

- Files uploaded in Manage, Files were written to the backend server's disk (`ASSET_STORAGE=local`). In the Docker image that disk is inside the container, so a redeploy deleted every file.
- The creator chose Framer's storage instead of paying for a bucket.

### 1.1. Decisions (2026-10-22)

| Question | Decision | Why |
| :--- | :--- | :--- |
| Where the file is stored | Framer, through the component's File control | No storage cost; the creator uploads where they design |
| How the file stays private | The plugin moves its address to the server and clears it from the component | A component's props are compiled into the published page. A Framer file address is public to anyone who has it |
| Who may download | Access: Members or Password. Members: the locks' list (any signed-in member, any paid plan, a tier or higher, only chosen tiers) | The same words and rule strings as the other content blocks |
| Where the rule is enforced | On the server, on every sign | A rule in page code is one any visitor can edit |
| A password | Hashed on the server (scrypt, `src/lib/password.ts`), cleared from the component | It must never be in the page |
| Manage, Files | Removed, with the Builder's "Attach file" picker | Files now live on the canvas |
| Files uploaded before | Keep working by Asset ID | The server still has their record and file |

## 2. User Flows

### 2.1. Creator

1. Add Protected Download from the Builder.
2. In Framer's right sidebar, drop a file into **File**. Optionally set **File Name**, which is what the visitor saves.
3. Choose **Access**:
   - **Members**, then **Who Can Download**. Only chosen tiers reveals **Chosen Tiers**.
   - **Password**, then type the **Password**.
4. With the MemberFrame plugin open, within about a second:
   - File and Password clear.
   - The button shows the file's name and size.
   - A toast says "Secured 1 download file. Publish to update your live site."
5. Publish.

Changing the rule, the name, or the password later, or dropping in a new file, is sent the same way. Leaving Password empty keeps the saved password.

If the plugin is closed after uploading, the canvas shows "Open MemberFrame to secure this file before publishing". On the published site the button reads "This file is not ready yet" and does nothing. The file's address is still in the page's code until the plugin clears it, so keep the plugin open after uploading.

### 2.2. Visitor

| Access | What the visitor sees |
| :--- | :--- |
| Members, signed out | Sign in to Download, then back to the page |
| Members, below the rule | Upgrade to Download, to pricing |
| Members, allowed | Download, with type and size |
| Password | A password field and Download. A wrong password: "Incorrect password. Try again." |

Every download is a link signed for 60 seconds. The server fetches the file from Framer and streams it, so the visitor never sees the Framer address.

## 3. Architecture and File Inventory

### 3.1. Plugin

- **`src/canvas-components/ProtectedDownload.tsx`**:
  - The controls are File (`ControlType.File`), File Name, Access, Who Can Download, Chosen Tiers, Password, and a hidden Asset ID.
  - The password field, the not-secured states, and a 401 on a password file read as a wrong password.
  - The `file` prop is read only to tell whether it still waits. The `password` prop is not read at all.
- **`src/services/downloadVault.ts`**, the pure half:
  - `readDownloadControls` and `ruleOf` (`signed_in`, `any_paid`, a tier, `only:a,b`, `password`).
  - `planDownload`: none, blocked, create, update, or adopt.
  - `securePlan` carries the plan out through `linkAsset` and `updateAsset`, and creates the file again on a 404.
  - The registry `mfDownloadRules` (plugin data) keeps each asset's last synced fingerprint: rule, file name, and an FNV hash of the address, never the address.
- **`src/hooks/useSealGuard.ts`**: `secureDownloadsOnce` runs on the guard's schedule.
  - That schedule is canvas and selection events (a second after the last), focus, and once a minute.
  - It writes `assetId` and an empty password first, then clears `file` (`null`, falling back to `""`).
  - It backs off after a server failure.
- **`src/services/canvasComponentCodeGenerator.ts`**: `rewriteAccessTierLists`, shared with the paywall, writes the site's tiers into Who Can Download and Chosen Tiers.
- **Removed**: `src/components/manage/FilesPanel.tsx`, the Files segment in `ManageTab.tsx`, its styles in `manage.css`, the Builder's file picker, and the upload, list, and delete calls in `assetsService.ts`.
- **`src/types/framer-canvas.d.ts`**: gains `ControlType.File` and `allowedFileTypes`.

### 3.2. Backend

- **Migration `20261024000000_asset_access`**:
  - `assets.required_tier` is widened to 255 characters.
  - `assets.password_hash` is added.
- **`src/services/assets/assetService.ts`**:
  - **`checkTier`** accepts `any_paid`, `only:a,b` with the site's keys, and `password`.
  - **Create and update** hash a password, require one for a password file, and clear it when the file goes back to members.
  - **`publicAsset`** answers `access: "password"`.
  - **`signDownload`** checks a password with no session. It uses `verifyAgainstNothing` when no hash is set, so the timing is the same.
  - **`passwordGrant`** is the link's holder: `pw:` plus 16 hex characters of the hash's SHA-256.
  - **`openDownload`** honours a `pw:` link only while that fingerprint matches the current hash, so a new password ends every older link.
- **`src/routes/content.ts`**:
  - `password` on sign, create, and update.
  - Ten password tries a minute per address and file (`assets-password:<ip>:<asset>`).
- **Unused but kept**: the upload route (`POST /api/site/assets/upload`) and the local and S3 drivers, for files uploaded before.

## 4. Security Notes

- The published page holds the Asset ID only. The Framer address lives in `assets.remote_url`, and only the server fetches it.
- **A Framer file address is public by nature**: anyone who has it can download the file. It is safe while nobody has it, which is why the plugin clears it from the component. A creator who publishes before the plugin runs ships it in the page's code. The canvas warns about this, and the published button stays shut, but the address is still there until the next publish after the plugin clears it.
- The password is never stored as typed. Plugin data keeps no address and no password.
- Download bandwidth goes through the MemberFrame server, which streams from Framer.

## 5. Verification and Testing Checklist

- **Backend `test/canvasDownloads.test.ts`**:
  - the new rules and an unknown tier
  - a password stored as a hash only
  - the right, wrong, and missing password
  - a password link dying after the password changes, and a forged grant
  - members unchanged, and 401 before 404
- **Plugin `test/downloadVault.test.ts`**:
  - reading controls and rules
  - create, blocked, update, adopt, none
  - re-creating on a 404, and a failure
- **Plugin `test/protectedDownload.test.ts`**:
  - the controls
  - the address and password never sent or linked
  - the not-secured states
  - the generator's tier lists
  - no Files in Manage or the Builder
- **Manual**:
  1. Upload a ZIP on the canvas with the plugin open: File clears and the toast shows.
  2. Publish and try each access case.
  3. Change the password: an old link fails.
  4. Search the published page source for `framerusercontent.com/assets/` and the password: neither is there.

## 6. Clearing the File Field (2026-10-22)

**The bug:** on the test project the toast said "Secured 1 download file", but File still showed the file and the canvas still said "Open MemberFrame to secure this file". Framer ignored `file: null`, and the plugin API documents no "no file" value.

**The fix:**
- `clearFileControl` (`hooks/useSealGuard.ts`) tries `undefined`, `null`, then `""`, and reads the layer back after each one. It stops once File reads empty.
- If none works, a toast asks the creator to clear File (×) by hand, once per file.
- The plugin also writes a hidden `fileSecured` control: the FNV hash of the saved address. The component's `mfFileHash`, held to `shortHash` by test, compares the two, so the canvas tells the cases apart:
  - **Saved, still in the field:** "Saved. Clear the File field before publishing, so its address stays private."
  - **New file:** "Open MemberFrame to secure this file before publishing".
- `planDownload` no longer re-sends a file whose hash matches the synced one. Before, a file Framer left in place was sent again on every pass, with a toast each time.

## 7. The Password Popup, and Any Password (2026-10-22)

**Any password:** letters, numbers, or symbols, from 1 to 200 characters. The product owner asked for this; it was 4 to 200 before.
- Backend: `passwordHashFor` and the route schemas (`min(1)`).
- Plugin: `MAX_PASSWORD` in `downloadVault.ts`, where only an over-long password is blocked.
- Guessing is still limited to ten tries a minute per address and file.

**The popup:** a password file shows only its Download button. Pressing it opens a dialog with:
- a lock icon, a title ("Enter the password"), and a line of text
- the password field, an error line, Cancel, and Download

How it behaves:
- **A right password:** the dialog closes and the download starts. "Your download has started" shows under the button.
- **A wrong one:** "Incorrect password. Try again." shows in the dialog, and the field is marked.
- Escape and the backdrop close it, but never during a request.
- It is rendered into `document.body` with `createPortal`, as BookmarksTray's drawer is, so a transformed or clipped ancestor cannot trap it. Its own copy of the theme and the instance's variables goes with it.
- Every word is in Labels: Password title, Password text, Password field, Password button, Cancel button, Wrong password.
