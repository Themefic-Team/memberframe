# Competitor Feature Analysis and Market Research

A comprehensive, deep-dive competitive intelligence report analyzing the leading Framer plugins and platforms for subscriptions, authentication, digital sales, and content gating.

---

## 1. Executive Summary and Ecosystem Taxonomy

The Framer ecosystem is experiencing surging demand for membership, gated content, and subscription billing tools. Website creators, designers, and agencies want to transform static Framer designs into interactive web applications without maintaining custom server backends or writing complex APIs.

The market splits into three distinct architectural categories:

1. **Framer-Dedicated Native Membership Plugins:**
   * **Examples:** **FrameAuth (formerly FramerAuth)** and **Thenty**.
   * **Characteristics:** Purpose-built exclusively for Framer. They offer drag-and-drop canvas components (Sign In, Sign Up, Profile, OTP), Framer code overrides, native layer gating, and deep integration with Framer site tokens.
2. **Framer Micro-Monetization and Drop-in Checkout Plugins:**
   * **Example:** **Subscription Payments** (developed by Khushal Dewra / KDX Studios).
   * **Characteristics:** Built by an individual creator for lightweight monetization. Inserts a customized Subscribe button onto the canvas, provides dual Stripe and Razorpay gateway auto-detection, and charges a single one-time Pro license with zero monthly platform subscriptions.
3. **Global Multi-Platform SaaS Platforms with Framer Embeds:**
   * **Example:** **Outseta**.
   * **Characteristics:** A comprehensive, multi-platform business operating system that works across Webflow, WordPress, and Framer. It bundles full CRM, automated email marketing, customer support help desk ticketing, and subscription billing into a hosted suite connected to Framer via header scripts and embed widgets.

---

## 2. In-Depth Competitor Breakdown

---

### 2.1. FrameAuth (formerly FramerAuth)

* **Source URLs:**
  * [FrameAuth Official Features](https://frameauth.com/features)
  * [FrameAuth Official Pricing](https://frameauth.com/pricing)
  * [Frameplate Directory Listing](https://frameplate.co/plugins/framerauth)
* **Product Identity:** Framer-native membership, user authentication, and digital product access control.
* **Target Audience:** Framer designers, template sellers, digital course creators, and private communities.

#### Verified In-Built Feature Inventory

1. **Google Sign In / Sign Up:**
   * Streamlined one-click OAuth authentication using Google accounts.
   * Significantly reduces registration friction and abandonment on landing pages.
2. **GitHub Sign In / Sign Up:**
   * Developer-focused OAuth authentication via GitHub.
   * Tailored for tech blogs, developer documentation portals, and SaaS staging sites.
3. **Lock On-Page Content (Section Gating):**
   * Protects specific canvas sections, visual layers, or frames on a page.
   * Allows public visitors to see hero headers and introductions while hiding premium modules.
4. **Lock Pages (Full-Page Access Gating):**
   * Restricts complete pages or entire sub-routes.
   * Automatically redirects unauthorized or non-logged-in visitors to a custom login page or paywall.
5. **Mark as Complete (LMS / Course Progress):**
   * Allows logged-in members to track progress by checking off completed lessons, chapters, or steps.
   * Persists completion state per user, turning Framer into a lightweight Learning Management System.
6. **Bookmarking:**
   * Enables users to save their favorite articles, tools, resources, or templates.
   * Bookmarked items are stored on the user's profile dashboard for fast retrieval.
7. **Upgrade to Continue Reading (Soft Paywall / Content Metering):**
   * Shows a preview portion of an article or tutorial before displaying a frosted fade-out or call-to-action lock card.
   * Maximizes SEO indexing while driving subscription conversions.
8. **OTP (One-Time Password Authentication):**
   * Passwordless login via 6-digit verification codes sent directly to the user's inbox.
   * Improves account security and removes the need for visitors to remember passwords.
9. **Password Protection (Shared and Individual):**
   * Supports traditional account passwords as well as shared group passwords for VIP client reviews, agency previews, and company team access.
10. **Custom Fields:**
    * Allows site owners to collect specialized onboarding data during registration (such as job title, company size, phone number, or preferences).
    * Custom metadata is stored directly on the member's profile record.
11. **Framer Code Overrides:**
    * Pre-configured Framer code overrides that allow advanced visual control.
    * Enables dynamic showing, hiding, or styling of elements based on user login state and purchased plan tiers.
12. **Upgrade to Download (Digital Asset Gating):**
    * Restricts file downloads (ZIP archives, design kits, PDF resources, code templates) exclusively to paying members.
    * Prevents direct URL scraping by verifying member entitlement before download.
13. **ReCAPTCHA Bot and Spam Protection:**
    * Integrated Google ReCAPTCHA to safeguard authentication and registration forms from automated spam bots and fraudulent attempts.
14. **Localization (Multi-Language Support):**
    * Customizable user interface strings, automated system emails, and error messages in multiple languages.
    * Enables international creators to deliver a localized membership experience.

#### Payment Gateway Integrations
* **Stripe:** Direct integration for credit cards, Apple Pay, Google Pay, and recurring subscription cycles.
* **Lemon Squeezy:** Supported as an alternative gateway and Merchant of Record (MoR), solving international sales tax, VAT, and invoice compliance automatically.

#### Pricing Structure and Platform Fees
* **14-Day Free Trial:** Full feature access across all tiers.
* **Starter Plan:** $19.99 per month. Includes 1,000 members, 1 collaborator, 3 products, and 10,000 monthly API calls.
* **Growth Plan:** $49.99 per month. Includes 5,000 members, 3 collaborators, 50 products, and 100,000 monthly API calls.
* **Business Plan:** $124.99 per month. Includes 10,000 members, 10 collaborators, 150 products, and 1,000,000 monthly API calls.
* **Enterprise Plan:** Custom pricing with tailored user thresholds and dedicated account support.
* **Platform Transaction Fee:** **0% commission**. Merchants keep 100% of revenue minus standard payment processor fees.

#### Key Strengths and Limitations
* **Strengths:**
  * Native Framer experience with no clunky external iframes.
  * 0% platform transaction fee.
  * Support for Lemon Squeezy alongside Stripe.
  * Specialized creator features like lesson completion tracking, bookmarking, and soft paywalls.
* **Limitations:**
  * Substantial recurring monthly expense ($19.99 to $124.99 per month).
  * Requires setting up code overrides for advanced gating.
  * No built-in email broadcast marketing engine or customer help desk.

---

### 2.2. Thenty

* **Source URLs:**
  * [Thenty Official Website](https://thenty.io)
  * [Thenty Pricing](https://thenty.io/pricing)
  * [Frameplate Directory Listing](https://frameplate.co/plugins/thenty)
* **Product Identity:** Native Framer membership and community monetization plugin.
* **Target Audience:** Framer designers building paid communities, gated blogs, and recurring membership sites.

#### Verified In-Built Feature Inventory

1. **Authentication Engine:**
   * Complete user identity management including sign-up, login, password recovery, session handling, and logout.
2. **Stripe Integration:**
   * Direct Stripe checkout sessions for recurring subscriptions, free trials, and one-time purchases.
   * Real-time webhook synchronization between Stripe payment events and member access levels.
3. **Member Dashboard:**
   * Dedicated self-serve member account portal.
   * Enables customers to update passwords, view active subscriptions, manage billing info, and view purchase history.
4. **Custom Fields:**
   * Ability to define custom input attributes on sign-up forms to collect user profile details and survey questions.
5. **Framer Authentication Components:**
   * Drag-and-drop canvas components for Sign Up, Sign In, Profile Card, and Account Settings.
   * Components automatically inherit typography, colors, and layout properties from Framer.
6. **Zapier Integration:**
   * Dispatches trigger events to Zapier whenever a member signs up, cancels, or upgrades.
   * Enables automated syncing with email providers (Mailchimp, ConvertKit) and external databases (Airtable, Notion).
7. **Google SSO:**
   * Fast, frictionless one-click registration and sign-in via Google accounts.
8. **Gated Pages and Content Tiers:**
   * Restricts complete pages or specific components based on customer membership tiers (such as Free, Silver, and Gold).
   * Automatically handles unauthorized access redirects.
9. **Extended Marketing Integrations:**
   * **Rewardful:** Built-in support for launching and tracking affiliate and referral programs.
   * **Intercom:** Embeds chat support for authenticated members directly inside the gated experience.
10. **Turnkey Setup Service ("Build It For You"):**
    * Paid professional implementation service where Thenty engineers configure membership workflows on client sites.

#### Pricing Structure and Platform Fees
* **14-Day Free Trial:** Full feature access on all plans.
* **Lite Plan:** $12 per month (billed annually only). Supports up to 100 members.
* **Launch Plan:** $29 per month ($24 per month billed annually). Supports up to 1,000 members, with a **1.5% transaction fee**.
* **Grow Plan:** $59 per month ($49 per month billed annually). Supports up to 5,000 members, with a **1.0% transaction fee**.
* **Scale Plan:** $99 per month ($79 per month billed annually). Supports up to 10,000+ members, with a **0.5% transaction fee**.
* **Additional Site Fee:** **$29 per month per additional domain**, which increases costs for agencies managing multiple client sites.

#### Key Strengths and Limitations
* **Strengths:**
  * Clean drag-and-drop components designed specifically for Framer canvas workflows.
  * Direct Rewardful and Intercom marketing integrations.
  * Tiered membership levels handle multi-plan clubs effectively.
* **Limitations:**
  * Charges a monthly subscription fee AND takes a 0.5% to 1.5% transaction cut on every payment.
  * Expensive for agencies due to the $29/mo penalty for each extra site.
  * Limited exclusively to Stripe (no Lemon Squeezy, Razorpay, or local wallets).

---

### 2.3. Subscription Payments (by KDX Studios / Khushal Dewra)

* **Source URLs:**
  * [Framer Marketplace Plugin](https://www.framer.com/marketplace/plugins/subscription-payments/)
* **Product Identity:** Independent micro-checkout and recurring payment button plugin for Framer.
* **Target Audience:** Freelancers, indie hackers, and creators who need simple recurring billing without membership overhead.

#### Official Product Scope and Verbatim Breakdown

> "Recurring revenue, set and forget. Sell subscriptions in Framer without a single line of code.
> Subscription Payments adds a drop-in Subscribe button to any Framer page. Paste your Razorpay or Stripe API key, paste your subscription link, drop the component on the canvas. Customers subscribe in seconds, billing happens on autopilot."

#### Verified Feature Breakdown

1. **Customizable Drop-in Subscribe Button:**
   * Drop-in canvas component with styling controls for background color, text, corner radius, borders, padding, and billing frequency labels.
2. **Real-Time Live Preview Studio:**
   * Interactive preview inside the plugin panel that updates in real time as the merchant tweaks colors and typography.
3. **Dual Gateway Auto-Detection (Razorpay + Stripe):**
   * Automatically detects the target gateway based on the API key prefix:
     * `pk_live_` / `pk_test_` routes to **Stripe**.
     * `rzp_live_` / `rzp_test_` routes to **Razorpay**.
   * Allows creators to use both gateways simultaneously on the same site for global and Indian regional checkout.
4. **Cancel-Anytime Frictionless UX:**
   * Built-in conversion reassurance label ("Cancel anytime") that builds buyer confidence and lowers commitment resistance.
5. **Broad Recurring Use Cases:**
   * Built for SaaS recurring plans, newsletter clubs, ongoing courses, subscription boxes, and recurring donations.
6. **5-Step Setup Workflow:**
   * Step 1: Create a subscription plan in the Stripe or Razorpay dashboard.
   * Step 2: Paste the API key into the plugin (`pk_test_` or `rzp_test_` to begin).
   * Step 3: Paste the subscription checkout link.
   * Step 4: Style the button to match site branding.
   * Step 5: Insert the component onto the Framer canvas and publish.
7. **Built for Global and Regional Markets:**
   * **Razorpay:** Tailored for India with UPI, Indian debit/credit cards, and Netbanking.
   * **Stripe:** Built for global audiences with international cards, Apple Pay, Google Pay, and Link across 46+ countries.
8. **Free vs Pro Monetization Model:**
   * **Free Tier:** Fully functional with test API keys (`rzp_test_` and `pk_test_`) for unlimited staging and prototyping.
   * **Pro Tier:** **$29 one-time payment** to unlock live API keys for real recurring payments. Includes lifetime updates and a 30-day money-back guarantee.
9. **Zero Server / Direct Custody Architecture:**
   * No backend servers, databases, or middleman accounts.
   * Payments flow directly into the merchant's Stripe or Razorpay account. The plugin creator never touches transaction funds.

#### Key Strengths and Limitations
* **Strengths:**
  * **$29 one-time lifetime price** with zero recurring monthly platform fees.
  * Direct Razorpay and UPI support, which no other major Framer membership plugin offers.
  * Extremely fast setup taking under two minutes.
* **Limitations:**
  * **No user accounts or membership database:** Cannot store user credentials, sessions, or profiles.
  * **No content gating:** Cannot protect pages, restrict CMS items, or gate file downloads.
  * Only handles the payment button and checkout redirect.

---

### 2.4. Outseta

* **Source URLs:**
  * [Frameplate Directory Listing](https://frameplate.co/plugins/outseta)
  * [Outseta Official Pricing](https://www.outseta.com/pricing)
* **Product Identity:** All-in-one membership infrastructure platform for SaaS, communities, and digital publishers.
* **Target Audience:** Mature membership platforms, B2B software companies, and multi-tier subscription businesses.

#### Verified In-Built Feature Inventory

1. **Authentication and Protected Content Embeds:**
   * Embeds login, registration, and profile widgets via header scripts and modal popups.
   * Protects full pages and custom URL sub-directories behind membership tiers.
2. **Complete Customer Relationship Management (CRM):**
   * Full-featured CRM dashboard tracking individual member timelines, login history, lifetime spend, support tickets, and email engagements.
   * Supports company accounts, B2B team seats, and family account groupings.
3. **Email Marketing and Broadcast Engine:**
   * Transactional emails (welcome messages, payment receipts, password resets).
   * Marketing broadcast newsletters, segmented campaigns, and automated multi-step email drips.
4. **Integrated Customer Help Desk:**
   * Built-in support ticketing system with shared team inboxes.
   * Floating live support widget that members can access directly inside the Framer site.
5. **Stripe Subscription Billing and Invoicing:**
   * Self-serve customer billing portal for plan upgrades, downgrades, payment method updates, and invoices.
   * Supports add-on pricing, metered usage, and one-off setup fees.

#### Pricing Structure and Platform Fees
* **7-Day Free Trial:** Full platform access. No permanent free tier.
* **Founder Plan:** $47 per month ($37/mo billed yearly). Up to 1,000 contacts, with a **2.0% transaction fee**.
* **Start-up Plan:** $87 per month ($67/mo billed yearly). Up to 5,000 contacts, with a **1.0% transaction fee**.
* **Growth Plan:** $127 per month ($97/mo billed yearly). Up to 10,000 contacts, with a **1.0% transaction fee**.
* **50K Plan:** $167 to $497+ per month ($127 to $397+/mo billed yearly). Up to 50,000 contacts, with a **1.0% transaction fee**.
* **0% Transaction Fee Tier:** Only available on high-volume custom enterprise contracts.

#### Key Strengths and Limitations
* **Strengths:**
  * Replaces 4 to 5 separate subscriptions (CRM, email marketing, help desk, billing, auth).
  * Robust B2B team management with multiple seats per account.
  * Comprehensive self-serve customer billing portal.
* **Limitations:**
  * High entry pricing starting at $47/mo plus 2% transaction commission.
  * Not native to Framer; uses external embed scripts, iframe popups, and external redirects.
  * Steep learning curve for designers who just want simple paywalls.

---

## 3. Comprehensive Feature Comparison Matrix

| Feature / Capability | FrameAuth | Thenty | Subscription Payments | Outseta |
| :--- | :--- | :--- | :--- | :--- |
| **Product Category** | Native Auth & Gating | Native Membership | Drop-in Subscribe Button | All-in-One Business CRM |
| **Target Integration** | Framer Canvas Native | Framer Canvas Native | Framer Canvas Native | Global Script Embeds |
| **Payment Gateways** | Stripe, Lemon Squeezy | Stripe | Stripe, Razorpay (UPI) | Stripe |
| **Platform Commission** | **0%** | **0.5% to 1.5%** | **0%** | **1.0% to 2.0%** |
| **Pricing Model** | $19.99 to $124.99 / mo | $24 to $99 / mo | **$29 one-time (Lifetime)** | $37 to $127+ / mo |
| **Free Staging / Trial** | 14-day trial | 14-day trial | **Free with test keys** | 7-day trial |
| **Email/Password Auth** | Yes | Yes | No | Yes |
| **OTP Passwordless Auth** | Yes | No | No | No |
| **Google Sign In (SSO)** | Yes | Yes | No | Yes |
| **GitHub Sign In (SSO)** | Yes | No | No | No |
| **ReCAPTCHA Bot Defense** | Yes | No | No | Built-in |
| **Lock Pages (Full Page)** | Yes | Yes | No | Yes |
| **Lock On-Page Content** | Yes (Sections & Layers) | Yes (Frames) | No | Partial (URL paths) |
| **Soft Paywall (Read More)** | Yes | No | No | No |
| **LMS Mark as Complete** | Yes | No | No | No |
| **Member Bookmarking** | Yes | No | No | No |
| **Upgrade to Download** | Yes | No | No | No |
| **Shared Password Access** | Yes | No | No | No |
| **Custom Profile Fields** | Yes | Yes | No | Yes |
| **Member Dashboard** | Yes | Yes | No | Yes |
| **Built-in CRM** | Basic user table | Member list | No | Full CRM & timeline |
| **Email Marketing / Drips**| Transactional only | Via Zapier | No | Built-in email broadcasts |
| **Integrated Help Desk** | No | Via Intercom | No | Built-in ticket system |
| **Multi-Language Support** | Yes | English only | Custom text label | English only |
| **Live Preview in Plugin** | No | Partial | Yes (Real-time studio) | No |

---

## 4. Total Cost of Ownership (TCO) Comparison

This simulation models the monthly cost for a creator generating **$5,000 per month in subscription revenue** with **1,000 active members**:

| Metric | Subscription Payments | FrameAuth | Thenty | Outseta |
| :--- | :--- | :--- | :--- | :--- |
| **Software Subscription** | $0/mo ($29 paid once) | $19.99/mo (Starter) | $29.00/mo (Launch) | $47.00/mo (Founder) |
| **Platform Transaction Fee**| 0% ($0) | 0% ($0) | 1.5% ($75.00) | 2.0% ($100.00) |
| **Payment Processor Fee** | Stripe (2.9% + 30¢) | Stripe / Lemon Squeezy | Stripe (2.9% + 30¢) | Stripe (2.9% + 30¢) |
| **Total Monthly Software Cost**| **$0.00 / month** | **$19.99 / month** | **$104.00 / month** | **$147.00 / month** |
| **Annual Software Expense** | **$29 total (Year 1)** | **$239.88 / year** | **$1,248.00 / year** | **$1,764.00 / year** |

### Key Economic Insight
Charging a transaction commission on top of monthly subscription fees (as done by Thenty and Outseta) creates severe fee drag for creators as their revenue grows. FrameAuth and Subscription Payments gain a massive competitive advantage by charging **0% transaction fees**.

---

## 5. Market Vulnerabilities and Competitor Weaknesses

Analysis of community discussions across Framer groups reveals five persistent pain points:

1. **The Double-Taxation Problem:**
   * Creators strongly reject paying both a monthly SaaS bill and a percentage cut of their gross earnings.
2. **Geographic Payment Exclusions:**
   * Thenty and Outseta only support Stripe. Creators in India, parts of Latin America, Africa, and Southeast Asia cannot use them.
   * Subscription Payments supports Razorpay and UPI, but lacks membership gating entirely.
   * FrameAuth supports Lemon Squeezy, which helps with Merchant of Record tax compliance, but lacks native UPI.
3. **Rigid Styling vs Native Canvas Identity:**
   * Outseta relies on hosted script modals and iframes that clash with modern typography and dark-mode designs.
4. **Agency Multi-Site Penalties:**
   * Thenty charges an extra $29/mo for every additional website, making it cost-prohibitive for design agencies deploying client portals.
5. **Missing Creator Micro-Features:**
   * While FrameAuth offers LMS completion, soft paywalls, and download gating, no other competitor provides these tools in a single unified package.

---

## 6. Strategic Blueprint and Action Plan for MemberFrame

To capture dominant market share, **MemberFrame** should synthesize the best qualities of each competitor while eliminating their drawbacks.

### Core Architectural Pillars for MemberFrame

1. **Zero Transaction Fees (Creator-First Economics):**
   * Never charge transaction commission fees. Position MemberFrame as a transparent, 0% platform fee solution.
2. **Framer Canvas Native Design System (`.framefic-*` Tokens):**
   * Build all input fields, buttons, modal overlays, and member cards as native Framer React components.
   * Guarantee zero inline canvas styling and automatic synchronization with Framer light and dark mode styles.
3. **Multi-Gateway Versatility:**
   * Integrate **Stripe** for standard card and wallet payments.
   * Integrate **Lemon Squeezy** for turnkey sales tax, VAT, and Merchant of Record compliance.
   * Integrate **Razorpay** with UPI support to capture the rapidly growing Indian creator economy.
4. **All-in-One Creator Gating Suite:**
   * **Page-Level Locking:** Simple path redirects for full pages.
   * **Section and Layer Gating:** Granular visibility controls directly in Framer property controls.
   * **Soft Metered Paywall ("Upgrade to Continue Reading"):** Frosted fade-out with call-to-action lock.
   * **Upgrade to Download:** Protected digital asset delivery for template sellers.
   * **Lesson Completion Tracking:** Member progress checkboxes for course portals.
5. **Modern Authentication Suite:**
   * Email and password accounts.
   * Passwordless 6-digit OTP codes.
   * One-click Google and GitHub SSO.
   * Shared passwords for team and agency staging previews.
6. **In-Plugin Customizer with Live Preview:**
   * Adopt Subscription Payments' live preview studio directly inside MemberFrame's 360x640 UI window.
   * Enable creators to customize colors, corner radius, borders, and typography before inserting components onto the canvas.
7. **Agency and Pro-Lock Licensing Model:**
   * Provide a frictionless 7-day Pro trial with non-destructive Pro-Lock gating.
   * Support multi-site agency licensing without punitive per-domain penalties.
