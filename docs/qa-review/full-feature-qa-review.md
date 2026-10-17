# MemberFrame - Complete Functional QA Review & End-to-End Verification Runbook

QA verification runbook and step-by-step test guide for all currently implemented functional features in **MemberFrame** (`memberframe` Framer Plugin + Canvas Components) and **MemberFrame Backend** (`memberframe-backend`).

| Field | Value |
| :--- | :--- |
| **Document Purpose** | Complete End-to-End QA Testing Runbook & Feature Checklist |
| **Scope** | Plugin Shell, Creator Connection, Cockpit, Settings, Tiers, Payments, Files Vault, Builder, Canvas Components, Backend APIs, Member Journey |
| **Frontend Test Baseline** | **831 of 831 tests passing** across 32 files (`vitest run`) |
| **Backend Test Baseline** | **304 of 304 tests passing** across 17 files (`vitest run`) |
| **Static Quality Gates** | `npm run lint:css` (99 files, 0 violations), `npx tsc --noEmit` (clean), `npm run build` (clean) |
| **Target Audience** | QA Engineer, Developer, Product Owner |
| **Status** | Ready for Full Verification |

---

## 1. Shortlist of Completed Functional Features

All features listed below are fully implemented in the codebase, covered by unit/parity tests, and ready for hands-on verification:

### 1.1. Plugin Shell & System Foundations
- **Three-Part Framer Shell**: 36px top navigation tab bar, scrollable content area, 40px action footer.
- **Window Collapse**: Toggles window height to 36px mini-bar inside Framer without losing internal state.
- **Dual Theme Synchronization**: Automatically syncs with Framer Canvas theme (`light`/`dark`) and supports explicit user overrides (`Light`, `Dark`, `System`) with WCAG AA compliance.
- **Design System Fidelity**: Zero inline `style={{}}` attributes, strictly uses Foundations tokens and shared UI kit (`Button`, `TextField`, `Select`, `Slider`, `Segmented`, `Banner`, `Toast`, `EmptyState`, `HeroCard`, `HelpTile`, `Badge`, `PluginCard`).

### 1.2. Creator Identity & Site Handshake (Connect View)
- **Account View**: Reached via the Account icon on the top right of the plugin tab bar.
- **Creator Email OTP Login**: Passwordless email authentication with a 6-digit verification code (`/api/connect/send-code` and `/api/connect/verify-code`).
- **Opaque Bearer Token Exchange**: Authenticates subsequent `/api/site/*` requests with `Authorization: Bearer <token>`.
- **Connected Site State**: Displays creator email, site ID, connected status badge, and Disconnect action. Automatically pulls and syncs site settings upon connection.

### 1.3. Home Tab (Cockpit & Onboarding)
- **Welcome Hero Card**: Highlights current workspace and site readiness.
- **Quick Action Cards**: One-click navigation to Connect, Page Scaffolding, Payments, and Tiers.
- **Documentation & Setup Tips**: Integrated guidance for new creators.

### 1.4. Settings Tab (Site Governance & Configuration)
- **Config Sub-tab**:
  - Theme preference selection (`System`, `Light`, `Dark`).
  - Core membership routing paths: Sign-In (`/sign-in`), Sign-Up (`/sign-up`), Dashboard (`/dashboard`), and Unauthorized Redirect (`/pricing`).
  - Global signup toggle (`Allow Sign-ups`).
  - Session duration configuration.
- **Page Locks Sub-tab (Route Shielding)**:
  - Pattern-based URL route shielding (e.g., `/premium/*`, `/courses/*`).
  - Required minimum tier association for each route pattern.
  - Backend route shield verification endpoint (`/api/shield/verify`) applying past-due grace logic.
- **Fields Sub-tab (Custom Profile Fields - FP-09 / F16)**:
  - Custom field definitions: Text, Select/Dropdown, Boolean/Checkbox, Date.
  - Dropdown options manager.
  - Required vs Optional flag.
  - "Show in onboarding modal" toggle for progressive onboarding.
- **Integration Sub-tab (OAuth 2.0 Providers)**:
  - Social Sign-In providers: Google, GitHub, Apple, Discord.
  - Client ID & Client Secret inputs with backend AES-256-GCM encryption.
  - Copyable OAuth redirect callback URI.

### 1.5. Manage Tab (Administrative Cockpit)
- **Members Segment**:
  - Live member directory with search, status filters (`active`, `past_due`, `canceled`, `trialing`), and tier filter.
  - Member Flyout drawer:
    - View member metadata and answered custom profile fields.
    - Change member tier manually (admin override).
    - Send Magic Link / password reset email to member.
    - Cancel membership or delete member.
- **Tiers Segment**:
  - Tier Editor with rank uniqueness validation (Rank 0 Free, Rank 1 Silver, Rank 2 Gold, Rank 3 VIP, custom tiers).
  - Multi-interval pricing: Monthly, Yearly (with calculated savings), Lifetime.
  - Tier perks/features checklist.
  - Real-time monetary parsing (`parseMinor`) preventing fractional cent errors.
- **Payments Segment (Tri-Gateway Payments - FP-16 / F03)**:
  - Mode Switcher: Test Mode vs Live Mode.
  - Direct Creator Payouts (zero platform fees enforced by automated tests).
  - Multi-Gateway Key Vault with AES-256-GCM encryption:
    - **Stripe**: Publishable Key, Secret Key (`sk_test_` / `sk_live_`), automatic webhook registration.
    - **Lemon Squeezy**: API Key, Store ID, product variant IDs for monthly/yearly/lifetime.
    - **Razorpay**: Key ID, Key Secret, Webhook Secret, with bridge page for UPI QR payments.
  - Checkout & Routing Settings:
    - Default gateway selector.
    - Geolocation buyer routing (India -> Razorpay/UPI, EU/UK -> Lemon Squeezy, Global -> Stripe).
    - Default currency (`USD`, `EUR`, `GBP`, `INR`).
    - Grace period days (for renewal retry).
    - Pricing page path and after-purchase return path.
- **Files Segment (Protected File Vault - FP-12 / F10)**:
  - Secure asset upload (raw binary stream up to 250MB) or external cloud storage link (Google Drive, Dropbox direct download conversion).
  - Allowed plan/tier restriction per file.
  - One-click copy Asset ID for canvas component pairing.
  - Download counter tracking per asset.

### 1.6. Builder Tab & Canvas Code Components
- **Automatic Membership Page Scaffolder**:
  - One-click creates all required Framer pages: Sign In, Sign Up, Forgot Password, Reset Password, Dashboard, Pricing.
  - Non-destructive (keeps existing pages, never overwrites).
- **12 Deployable Canvas Code Components**:
  1. `<MemberGate>` (F01/F22): Gating wrapper for frames with 7 property controls, blurred/frosted glass overlay, and upgrade CTA.
  2. `<MemberAuth>` (F05): Universal multi-provider auth box (Email/Password, OTP, Google, GitHub, Apple, Discord).
  3. `<MemberLogin>` (F05 dedicated): Clean dedicated login screen for `/sign-in`.
  4. `<MemberRegister>` (F05 dedicated): Dedicated registration screen for `/sign-up`.
  5. `<PasswordReset>` (F05 dedicated): Forgot password request and new password confirmation.
  6. `<OtpVerification>` (F05 dedicated): 6-digit passwordless OTP email verification screen.
  7. `<MemberDashboard>` (F06): Member self-service portal (profile info, custom fields editing, billing management & portal link, sign out).
  8. `<OnboardingModal>` (F16/FP-09): Progressive profile completion modal, triggers automatically if member has missing required profile fields.
  9. `<MemberPricing>` (F03/FP-16): Live pricing table, monthly/yearly toggle with discount pill, tier feature checklists, instant checkout session launch.
  10. `<MeteredPaywall>` (F07/F08): Soft paywall with Free Articles Meter pill (e.g., 3 free articles/month) or Read More teaser cut with frost & Schema.org JSON-LD SEO injection.
  11. `<ProtectedDownload>` (F10/FP-12): Secure download button, checks member tier, generates 60-second HMAC signed streaming URL.
  12. `<BookmarkButton>` & `<BookmarksTray>` (F14/FP-10): Save article/CMS item with animated ribbon/heart/star icon, count badge, slide-over drawer with search and one-click removal.

---

## 2. Test Environment Setup & Prerequisites

Before beginning the manual testing workflow, confirm both frontend and backend development servers are running:

### 2.1. Start Backend Server
1. Open a terminal in `d:\project\Framer APP\memberframe-backend`.
2. Run:
   ```sh
   npm run dev
   ```
3. Verify output confirms server listening at `http://localhost:3001` (or configured port).
4. Verify database connection (Prisma / MySQL).

### 2.2. Start Plugin Server
1. Open a terminal in `d:\project\Framer APP\memberframe`.
2. Run:
   ```sh
   npm run dev
   ```
3. Open `https://127.0.0.1:5173` in your browser once and accept the self-signed SSL certificate warning (`localhost` fails where `127.0.0.1` succeeds).

### 2.3. Launch in Framer Desktop
1. Open the **Framer Desktop App**.
2. Open or create a test Framer project.
3. Open menu -> **Plugins** -> **Development** -> **Open Development Plugin**.
4. Enter URL: `https://127.0.0.1:5173`.
5. Open the plugin devtools console (`Ctrl + Shift + I` or right-click -> Inspect) to monitor console messages and network requests.

---

## 3. Step-by-Step QA Checking Process (Sequential Flow)

Follow this chronological testing flow to verify the entire system end-to-end, from initial creator connection to live member checkout and content gating.

```
Stage 1: Creator Connect & Authentication
   │
   ▼
Stage 2: Site Configuration & Route Shielding
   │
   ▼
Stage 3: Tiers, Payments & File Vault Setup
   │
   ▼
Stage 4: Canvas Components & Page Scaffolding (Builder)
   │
   ▼
Stage 5: Live Member Journey (Sign-up, Onboarding, Login)
   │
   ▼
Stage 6: Content Gating, Paywall & Download Verification
   │
   ▼
Stage 7: Checkout & Tier Upgrade (Stripe / Test)
   │
   ▼
Stage 8: Member Self-Service & Admin Cockpit Review
```

---

### Stage 1: Creator Account & Site Connection (Connect Flow)
*Feature: Creator Authentication & Handshake (FP-00 / F02)*

1. **Open Account View**:
   - In the Framer plugin top bar, click the **Account icon** (pinned to the right of the four tabs).
   - Expected: The Connect view opens showing the creator sign-in form.

2. **Send OTP Code**:
   - Enter your creator email (e.g., `creator@example.com`).
   - Click **Send Code** (or press Enter).
   - Expected: Button shows loading state; screen transitions to the 6-digit code entry screen. Toast or message confirms code was sent.
   - *Check*: Look at the backend terminal console for the generated 6-digit code (in development mode, the OTP is printed directly in the server log).

3. **Verify OTP Code**:
   - Enter the 6-digit code.
   - Click **Verify Code**.
   - Expected: System verifies the code via `POST /api/connect/verify-code`, stores the opaque Bearer token in connection storage, and renders the **Connected Site** card.
   - Expected Details: Shows creator email, Site ID, status badge `Connected`, and a **Disconnect** button.

4. **Verify Window Geometry & Theme**:
   - Click the **Collapse icon** in the window header.
   - Expected: Plugin window collapses smoothly to a 36px mini-bar. Clicking again restores height to 640px.
   - Switch Framer canvas theme between Light and Dark mode.
   - Expected: Plugin background, text, borders, and controls adapt seamlessly with zero contrast failure.

---

### Stage 2: Site Configuration & Route Shielding
*Feature: Settings Tab, Route Shielding & Custom Profile Fields (F02, F16 / FP-09)*

1. **Navigate to Settings Tab**:
   - Click the **Settings** tab in the tab bar.
   - Expected: Four segmented controls appear: `Config`, `Page Locks`, `Fields`, `Integration`.

2. **Configure Membership Paths (`Config` sub-tab)**:
   - Verify/set:
     - Sign In Path: `/sign-in`
     - Sign Up Path: `/sign-up`
     - Dashboard Path: `/dashboard`
     - Unauthorized Redirect Path: `/pricing`
     - Allow Sign-ups: Enabled (checked)
   - Click **Save Settings** (`.primary-cta`).
   - Expected: Toast appears: "Settings saved successfully".

3. **Configure Custom Profile Fields (`Fields` sub-tab)**:
   - Click **Fields** in the segmented control.
   - Add three test fields:
     - Field 1: Label: `Full Name`, Key: `full_name`, Type: `Text`, Required: `Yes`, Onboarding: `Yes`.
     - Field 2: Label: `Company Size`, Key: `company_size`, Type: `Select`, Options: `1-10, 11-50, 50+`, Required: `Yes`, Onboarding: `Yes`.
     - Field 3: Label: `Twitter / X`, Key: `twitter_handle`, Type: `Text`, Required: `No`, Onboarding: `No`.
   - Click **Save Fields**.
   - Expected: Fields table updates, definitions are normalized and saved to backend via `PUT /api/site/settings`.

4. **Configure Route Shielding (`Page Locks` sub-tab)**:
   - Click **Page Locks** in the segmented control.
   - Add a rule:
     - Path Pattern: `/premium/*`
     - Required Tier: `Gold` (or Tier 2)
   - Add a second rule:
     - Path Pattern: `/vip-lounge/*`
     - Required Tier: `VIP` (or Tier 3)
   - Click **Save Locks**.
   - Expected: Table displays configured rules. Backend `/api/shield/verify` is ready to enforce route shielding.

5. **Review Integrations (`Integration` sub-tab)**:
   - Click **Integration** in the segmented control.
   - Verify cards for: Google, GitHub, Apple, Discord.
   - Expand the **Google** card: verify Client ID and Client Secret inputs, callback URL displayed: `https://<api-domain>/api/oauth/callback/google`.

---

### Stage 3: Tiers, Pricing, Payments & File Vault Setup
*Feature: Manage Tab - Members, Tiers, Payments & Files (F02, F03 / FP-16, F10 / FP-12)*

1. **Navigate to Manage Tab**:
   - Click the **Manage** tab in the tab bar.
   - Expected: Four segments appear: `Members`, `Tiers`, `Payments`, `Files`.

2. **Configure Tiers (`Tiers` segment)**:
   - Click **Tiers**.
   - Review default tiers: Free (Rank 0), Silver (Rank 1), Gold (Rank 2), VIP (Rank 3).
   - Edit the **Gold** tier:
     - Set Monthly Price: `$29.00`
     - Set Yearly Price: `$290.00`
     - Add Features: "All premium articles", "Source code downloads", "Community access".
   - Edit the **VIP** tier:
     - Set Lifetime Price: `$499.00`
   - Test Validation: Attempt to assign duplicate rank or invalid price (e.g. `$29.999`).
   - Expected: Strict validation blocks saving and displays inline error. Valid input saves cleanly.

3. **Configure Payments & Gateways (`Payments` segment)**:
   - Click **Payments**.
   - Mode Toggle: Confirm set to **Test Mode**.
   - Expand the **Stripe** gateway card:
     - Enter Stripe Test Secret Key: `sk_test_...`
     - Enter Stripe Test Publishable Key: `pk_test_...`
     - Save Gateway.
     - Expected: Backend validates format, encrypts secret via AES-256-GCM, and shows "Connected (Test)".
   - Configure Checkout Settings:
     - Default Gateway: `Stripe`
     - Default Currency: `USD`
     - Grace Period: `7 days`
     - Pricing Page: `/pricing`
     - After Purchase: `/dashboard`
   - Save Checkout Settings.

4. **Setup Secure Assets in File Vault (`Files` segment)**:
   - Click **Files**.
   - Click **Add File / Upload**:
     - Mode A (File Upload): Upload a test `.pdf` or `.zip` file (e.g. `ebook-guide.pdf`).
     - Mode B (External Link): Enter a title `Design System UI Kit` and URL (e.g. a Dropbox/Drive link).
     - Required Access: Select **Gold** (requires Gold plan or higher).
     - Click **Save Asset**.
   - Expected: File appears in the files list showing filename, size, required tier ("Gold"), download count `0`, and a **Copy ID** button.
   - Action: Click **Copy ID** (copies the opaque Asset ID e.g. `ast_123abc`). Note this down for Stage 4.

---

### Stage 4: Scaffolding Pages & Canvas Component Insertion
*Feature: Builder Tab, Page Scaffolder & Component Deployment (F01, F04, F05, F06, F07, F10, F14, F16)*

1. **Scaffold Membership Pages**:
   - Click the **Builder** tab.
   - Under "Membership Pages", click **Scaffold Membership Pages**.
   - Expected: Framer creates the standard pages:
     - `/sign-in`
     - `/sign-up`
     - `/reset-password`
     - `/pricing`
     - `/dashboard`
   - Check: Verify existing pages are preserved without duplicate overwrites.

2. **Insert `<MemberAuth>` (or Dedicated Screens)**:
   - In Builder, select component **Member Auth** (or **Member Login** on `/sign-in` and **Member Registration** on `/sign-up`).
   - Click **Add to Canvas** (or Insert).
   - Expected: Component code is generated with baked-in site key and backend URL, added to Framer code files, and an instance is placed on the canvas.
   - Check Framer Properties Panel: Controls include Theme (Light/Dark), Initial Mode (Sign In/Sign Up), Social Providers toggle, Button text.

3. **Insert `<MemberPricing>` on `/pricing`**:
   - Select **Member Pricing** in the Builder picker.
   - Click **Add to Canvas** on the `/pricing` page.
   - Expected: Pricing table component is inserted. Live preview loads the tiers, prices ($29/mo, $290/yr), monthly/yearly billing toggle, and tier features.

4. **Insert `<MemberDashboard>` on `/dashboard`**:
   - Select **Member Dashboard** in the Builder picker.
   - Click **Add to Canvas** on the `/dashboard` page.
   - Expected: Dashboard component is inserted. Contains tabs: Profile (shows name, email, custom fields), Billing (subscription status, manage portal, cancel), Security (password change), and Sign Out.

5. **Insert `<OnboardingModal>`**:
   - Select **Onboarding Modal** in the Builder picker.
   - Click **Add to Canvas** on the master layout or protected page.
   - Expected: Modal component is inserted. It remains completely hidden at runtime unless the logged-in member has missing required profile fields.

6. **Insert `<ProtectedDownload>`**:
   - Select **Protected Download** in the Builder picker.
   - Click **Add to Canvas**.
   - In Framer properties panel, paste the **Asset ID** copied from Stage 3 (`ast_123abc`).
   - Expected: Button shows file info placeholder and plan requirement.

7. **Insert `<MeteredPaywall>`**:
   - Select **Soft Paywall** in the Builder picker.
   - Click **Add to Canvas** over an article body frame.
   - Set Paywall Type: `Free Articles Meter` (e.g., 3 free articles) or `Read More Teaser`.
   - Set Full Access For: `Gold` and up.

8. **Insert `<BookmarkButton>` & `<BookmarksTray>`**:
   - Select **Bookmark Button** -> Insert onto article or CMS template.
   - Select **Bookmarks Tray** -> Insert into the header/navigation bar.

9. **Insert `<MemberGate>`**:
   - Select **Member Gate** -> Place around a premium section frame.
   - Set Required Tier: `Gold`.
   - Set Fallback Action: `Show Lock Card` with blurred overlay and "Upgrade to unlock" CTA.

---

### Stage 5: Live Member Journey (Sign-Up, Onboarding, Login)
*Feature: Visitor Registration, Progressive Onboarding & Member Authentication (F05, F16 / FP-09)*

1. **Visitor Registration (`/sign-up`)**:
   - Open the published/preview site as a new visitor.
   - Navigate to `/sign-up`.
   - Enter email: `member1@test.com`, Password: `Password123!`.
   - Click **Create Account**.
   - Expected: Backend creates member record with status `active` on `free_member` tier, sets secure HTTP-only session cookie.

2. **Verify Progressive Onboarding (`<OnboardingModal>`)**:
   - Immediately after registration, observe the page.
   - Expected: Because `Full Name` and `Company Size` were configured as **Required** and **Onboarding: Yes**, the `<OnboardingModal>` automatically opens.
   - Attempt to dismiss or submit empty:
     - Expected: Modal blocks submission with validation errors on required fields.
   - Fill in answers:
     - Full Name: `Jane Doe`
     - Company Size: `11-50`
   - Click **Complete Profile**.
   - Expected: Answers are saved to `member.metadata` via `PATCH /api/member/metadata`. Modal closes smoothly.

3. **Test Sign-Out & Sign-In (`/sign-in`)**:
   - Go to `/dashboard` and click **Sign Out**.
   - Expected: Session cookie cleared; redirected to `/sign-in`.
   - Test Password Login: Enter `member1@test.com` and `Password123!`.
   - Expected: Sign in succeeds; redirected to `/dashboard`.
   - Test Passwordless OTP Login:
     - Switch to "Sign in with email code".
     - Enter email, request 6-digit code, enter code from backend log.
     - Expected: Signs in successfully without password.

---

### Stage 6: Content Gating, Paywall & Download Verification
*Feature: Member Gate, Soft Paywall, Protected Downloads & Bookmarks (F01, F07, F10, F14)*

1. **Verify Member Gate (`<MemberGate>`) as Free Member**:
   - As `member1@test.com` (currently on Free tier), navigate to the gated page.
   - Expected: Content is blocked by the blurred overlay. Lock card reads: "This content requires the Gold plan" with an **Upgrade** button pointing to `/pricing`.

2. **Verify Soft Paywall Metering (`<MeteredPaywall>`)**:
   - Open Article 1: Full content displays. Counter pill shows: "Article 1 of 3 free articles this month".
   - Open Article 2: Full content displays. Counter pill shows: "Article 2 of 3 free articles this month".
   - Open Article 3: Full content displays. Counter pill shows: "Article 3 of 3 free articles this month (Last free article)".
   - Open Article 4:
     - Expected: Content cuts off after designated preview paragraphs, bottom text is frosted/blurred, and Lock Card appears: "You have reached your free reading limit. Subscribe to continue reading." CTA points to `/pricing`.
   - Check SEO: Inspect DOM to confirm Schema.org JSON-LD paywall markup (`@type: WebPage`, `isAccessibleForFree: False`, `hasPart: WebPageElement`) is properly injected.

3. **Verify Protected Download (`<ProtectedDownload>`) as Free Member**:
   - Navigate to the download component created in Stage 4.
   - Expected: Button displays "Upgrade to Download - Included with Gold plan and above".
   - Click the button: Redirects to `/pricing` (or opens upgrade prompt). Download does not initiate.

4. **Verify Member Bookmarks (`<BookmarkButton>` & `<BookmarksTray>`)**:
   - On Article 1, click the **Bookmark Button**.
   - Expected: Bookmark icon instantly fills with accent color and plays a subtle pulse animation.
   - Check the **Bookmarks Tray** in the navigation bar:
     - Badge counter increments from `0` to `1`.
   - Click **Bookmarks Tray**:
     - Drawer slides open from the right.
     - Displays Article 1 with title, link, and saved timestamp.
     - Type in the drawer search input: filter matches article title.
     - Click the remove icon on the item: item is removed, badge decrements, database updates via `PATCH /api/member/bookmarks`.

---

### Stage 7: Paid Tier Checkout & Upgrade (Stripe / Test)
*Feature: Checkout Service, Webhooks & Automated Tier Provisioning (F03 / FP-16)*

1. **Initiate Checkout from Pricing Table**:
   - Navigate to `/pricing`.
   - Toggle billing between **Monthly** and **Yearly** (observe yearly discount pill update).
   - On the **Gold** card ($29/month), click **Get Gold**.
   - Expected: Initiates `POST /api/checkout/create-session`. Returns Stripe checkout URL and redirects browser to Stripe Test Checkout.

2. **Complete Test Payment**:
   - In Stripe Test Checkout, enter standard test card: `4242 4242 4242 4242`, any future date, CVC `123`.
   - Complete checkout.
   - Expected: Stripe triggers `checkout.session.completed` webhook to MemberFrame backend.
   - Expected Backend Log:
     ```
     [payments] member member1@test.com bought tier_2 (month) through stripe
     [payments] member member1@test.com now tier_2 (active)
     ```
   - Browser is redirected back to `/pricing?mf_checkout=<id>`.
   - Pricing component polls checkout status, shows "Payment confirmed! Welcome to Gold", and redirects to `/dashboard`.

3. **Verify Instant Content Unlock**:
   - Revisit the **Member Gate** page:
     - Expected: Content is now **100% unlocked and fully visible** with zero blur.
   - Revisit Article 4 (**Soft Paywall**):
     - Expected: Paywall is lifted; article renders completely with no meter limit.
   - Revisit the **Protected Download** button:
     - Expected: Button now displays "Download Source Files (ZIP, 42 MB)" with active state.
     - Click the button:
       - State shows "Preparing your download...".
       - Backend issues a 60-second HMAC signed streaming token (`/api/assets/download/:token`).
       - Browser initiates file download with `Content-Disposition: attachment`.
       - Download counter in backend increments.

---

### Stage 8: Member Self-Service & Admin Cockpit Review
*Feature: Member Dashboard Billing & Plugin Manage Cockpit (F02, F06)*

1. **Member Dashboard Billing Portal (`/dashboard`)**:
   - On the `/dashboard` page, open the **Billing** section.
   - Expected:
     - Shows current plan: **Gold**.
     - Renewal date: 1 month from today.
     - Payment status: `Active`.
   - Click **Manage Billing**:
     - Expected: Redirects to Stripe Customer Portal (where members can update payment methods or download invoices).
   - Test **Cancel Subscription**:
     - Click "Cancel Subscription". Confirm the prompt.
     - Expected: Subscription marked as `canceling`; access remains active until the end of the billing period.

2. **Admin Cockpit Verification in Framer Plugin**:
   - Switch back to the Framer Plugin -> **Manage** tab.
   - **Members Segment**:
     - Look for `member1@test.com` in the table.
     - Verify displayed Tier: `Gold`, Status: `active`.
     - Click on the member row to open the **Member Flyout**:
       - Verify custom fields: `Full Name: Jane Doe`, `Company Size: 11-50`.
       - Test manual tier override: Change tier to `VIP` -> Save -> Member updates immediately.
       - Test "Send Magic Link": Verifies email dispatch.
   - **Files Segment**:
     - Check the asset row: verify download count reflects the download completed in Stage 7.
   - **Payments Segment**:
     - Verify recent checkout / payment is logged.

---

## 4. Comprehensive QA Verification Checklist & Sign-Off Matrix

Use this matrix to record manual testing results across all functional areas:

| # | Functional Area | Specific Test Case | Expected Result | Status (Pass/Fail) | Tester Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1.0** | **Plugin Core & Shell** | | | | |
| 1.1 | Shell Navigation | Click between Home, Builder, Manage, Settings | Active tab highlights; views switch without lag | [ ] Pass [ ] Fail | |
| 1.2 | Window Collapse | Click collapse icon in header | Window shrinks to 36px; content preserves on expand | [ ] Pass [ ] Fail | |
| 1.3 | Theme Sync | Switch between Framer Light and Dark | All components adjust colors cleanly with WCAG AA | [ ] Pass [ ] Fail | |
| **2.0** | **Creator Connect** | | | | |
| 2.1 | OTP Request | Enter creator email & click Send Code | OTP dispatched; 6-digit code entry view displays | [ ] Pass [ ] Fail | |
| 2.2 | OTP Verification | Enter correct 6-digit code | Opaque token issued; Connected Site card rendered | [ ] Pass [ ] Fail | |
| 2.3 | Disconnect Action | Click Disconnect | Session terminated; returns to sign-in form cleanly | [ ] Pass [ ] Fail | |
| **3.0** | **Settings & Config** | | | | |
| 3.1 | Membership Paths | Set `/sign-in`, `/sign-up`, `/dashboard`, `/pricing` | Paths saved and utilized across all auth components | [ ] Pass [ ] Fail | |
| 3.2 | Route Shielding | Add path lock `/premium/*` -> Gold | Backend `/api/shield/verify` protects matching routes | [ ] Pass [ ] Fail | |
| 3.3 | Custom Profile Fields | Create Text, Select, Checkbox definitions | Fields saved and synced to onboarding and dashboard | [ ] Pass [ ] Fail | |
| 3.4 | OAuth Integrations | Configure Google/GitHub client credentials | Secrets stored encrypted; callback URLs accurate | [ ] Pass [ ] Fail | |
| **4.0** | **Tiers & Payments** | | | | |
| 4.1 | Tier Editor | Create/edit tier prices (monthly/yearly/lifetime) | Rank uniqueness enforced; money parsed cleanly | [ ] Pass [ ] Fail | |
| 4.2 | Gateway Vault | Save Stripe/Lemon Squeezy/Razorpay keys | Format validated; AES-256-GCM encrypted in DB | [ ] Pass [ ] Fail | |
| 4.3 | Geo-Routing | Verify gateway routing rules by country | Correct gateway selected based on buyer location | [ ] Pass [ ] Fail | |
| **5.0** | **Secure File Vault** | | | | |
| 5.1 | Asset Upload / Link | Upload file / add external link with tier gate | Asset record created with generated Asset ID | [ ] Pass [ ] Fail | |
| 5.2 | File Protection | Free member attempts download | Blocked with "Upgrade to Download" prompt | [ ] Pass [ ] Fail | |
| 5.3 | Signed Download | Eligible member clicks download | 60-second HMAC signed streaming URL downloads file | [ ] Pass [ ] Fail | |
| **6.0** | **Builder & Canvas** | | | | |
| 6.1 | Page Scaffolder | Click Scaffold Membership Pages | All standard membership pages created in Framer | [ ] Pass [ ] Fail | |
| 6.2 | Component Insert | Insert MemberAuth, Pricing, Dashboard, Paywall | Valid TSX generated with baked site keys & deployed | [ ] Pass [ ] Fail | |
| **7.0** | **Member Authentication** | | | | |
| 7.1 | Member Registration | Visitor signs up on `/sign-up` | Account created; session cookie established | [ ] Pass [ ] Fail | |
| 7.2 | Password & OTP Login | Member signs in via password and 6-digit OTP | Authentication succeeds; redirects to dashboard | [ ] Pass [ ] Fail | |
| 7.3 | Password Reset | Request reset email & submit new password | Token verified; password updated with scrypt hash | [ ] Pass [ ] Fail | |
| **8.0** | **Onboarding Modal** | | | | |
| 8.1 | Auto-Trigger | Member with missing required fields visits site | Modal opens automatically; blocks dismissal | [ ] Pass [ ] Fail | |
| 8.2 | Field Submission | Submit answers for required fields | Metadata saved to member record; modal closes | [ ] Pass [ ] Fail | |
| **9.0** | **Content Gating** | | | | |
| 9.1 | Member Gate | Unpaid member views gated frame | Content blurred; lock card displayed with upgrade CTA | [ ] Pass [ ] Fail | |
| 9.2 | Content Unlock | Upgraded member views gated frame | Content renders completely with no obstruction | [ ] Pass [ ] Fail | |
| **10.0**| **Soft Paywall** | | | | |
| 10.1| Free Reading Meter | Read articles 1, 2, 3 as visitor | Free counter pill increments ("Article 1 of 3 free") | [ ] Pass [ ] Fail | |
| 10.2| Paywall Enforcement | Read article 4 as visitor | Teaser cut with frost and lock card; CTA to pricing | [ ] Pass [ ] Fail | |
| 10.3| SEO Preserved | Inspect DOM on paywalled article | Schema.org JSON-LD paywall markup present | [ ] Pass [ ] Fail | |
| **11.0**| **Member Bookmarking**| | | | |
| 11.1| Save Article | Click Bookmark button on page | Icon fills & pulses; tray counter increments | [ ] Pass [ ] Fail | |
| 11.2| Bookmarks Tray | Open tray drawer from navigation | Shows saved items with search and one-click removal | [ ] Pass [ ] Fail | |
| **12.0**| **Pricing & Checkout**| | | | |
| 12.1| Pricing Table | View pricing table with monthly/yearly switch | Prices, discounts, and feature lists render live | [ ] Pass [ ] Fail | |
| 12.2| Checkout Launch | Click Get Gold on pricing card | Session created; redirects to gateway checkout | [ ] Pass [ ] Fail | |
| 12.3| Webhook Provisioning| Complete test payment | Webhook moves member to Gold tier automatically | [ ] Pass [ ] Fail | |
| **13.0**| **Member Dashboard** | | | | |
| 13.1| Profile Management | Edit profile custom fields in dashboard | Updates reflected immediately in member metadata | [ ] Pass [ ] Fail | |
| 13.2| Billing Management | Access Stripe Customer Portal / Cancel plan | Portal launches; cancellation grace logic enforced | [ ] Pass [ ] Fail | |
| **14.0**| **Admin Management** | | | | |
| 14.1| Member Directory | Search & filter members in Manage tab | Table filters by status/tier; shows correct counts | [ ] Pass [ ] Fail | |
| 14.2| Member Flyout | Open member flyout drawer | Details, answers, tier override, and actions work | [ ] Pass [ ] Fail | |

---

## 5. Review Sign-Off & Verdict

| Role | Name | Signature / Decision | Date |
| :--- | :--- | :--- | :--- |
| **QA Lead / Reviewer** | | [ ] APPROVED [ ] REJECTED [ ] BLOCKED | |
| **Lead Developer** | | [ ] APPROVED [ ] REJECTED [ ] BLOCKED | |
| **Product Owner** | | [ ] APPROVED [ ] REJECTED [ ] BLOCKED | |

### Verdict Definitions:
- **APPROVED**: All critical flows (Connect, Settings, Builder, Canvas Components, Auth, Gate, Paywall, Checkout, Downloads, Bookmarks) passed verification with zero blocking defects. Plugin is ready for release.
- **REJECTED**: One or more critical path defects failed testing. Must address reported issues before re-testing.
- **BLOCKED**: Environmental or third-party dependency failure prevented full test execution.
