# Framer Marketplace রিভিউ রিপোর্ট: সমস্যা ও সমাধান

Framer-এর স্বয়ংক্রিয় কোড রিভিউ আমাদের তিনটা প্লাগইন বাতিল করেছে। একই সমস্যা MemberFrame (প্লাগইন ও ব্যাকএন্ড) এ আছে কি না, তার পূর্ণ বিশ্লেষণ ও সমাধান।

**তারিখ**: ২৮ অক্টোবর ২০২৬
**কার জন্য**: MemberFrame প্লাগইন ও ব্যাকএন্ড টিম
**স্ট্যাটাস**: রিপোর্ট সম্পন্ন, সমাধানের কাজ এখনো শুরু হয়নি
**ধাপে ধাপে কাজের প্রক্রিয়া**: [`36-marketplace-review-fix-workflow.md`](36-marketplace-review-fix-workflow.md)
**আগের অডিট**: [`34-marketplace-audit-fixes.md`](34-marketplace-audit-fixes.md), [`../framer-marketplace-audit.md`](../framer-marketplace-audit.md)

---

## ১. সারসংক্ষেপ

- Framer **Auto Table of Contents**, **Chat Bubbles** আর **Formfic** প্লাগইন তিনটা Marketplace থেকে সরিয়ে দিয়েছে। কারণ:
  - প্লাগইন বাইরের ব্যাকএন্ডে ইউজার, প্রজেক্ট, পেমেন্ট ও সাবস্ক্রিপশনের তথ্য পাঠায়।
  - রানটাইমে Stripe.js লোড করে।
  - ইউজারের integration credentials (API key, secret) আর প্রজেক্টের ডেটা নিজেদের সার্ভার দিয়ে পাঠায়।
- প্রথম দুটো প্লাগইন আর MemberFrame একই billing ব্যবস্থা ব্যবহার করে, যেটা BEAF প্লাগইন থেকে হুবহু কপি করা। আর MemberFrame-ও Formfic-এর মতো ক্রিয়েটরের payment gateway আর sign in provider-এর secret নিজেদের ব্যাকএন্ডে রাখে। তাই **MemberFrame জমা দিলে একই কারণে বাতিল হওয়ার সম্ভাবনা খুব বেশি।**
- MemberFrame-এ মোট **১১টা সমস্যা** পাওয়া গেছে: ৬টা বেশি গুরুত্বের, ৩টা মাঝারি, ২টা কম। এর বাইরে একটা পরিকল্পিত ফিচার (F20) আছে, যেটা বানালে নিশ্চিতভাবে বাতিল হবে।
- সুখবর:
  - MemberFrame-এ কোনো আসল analytics নেই (view বা click রেকর্ড করা হয় না), আর ব্যাকএন্ড পাবলিক রিকোয়েস্ট থেকে কিছু সেভ করে না।
  - সব secret encrypt করে রাখা হয়, আর কখনো প্যানেলে ফেরত আসে না।
- সমাধানের মূল নীতি: **মেম্বারশিপের কাজের জন্য যা লাগে তা থাকবে। আমাদের নিজেদের licensing আর billing-এর জন্য যা পাঠানো হয়, আর ক্রিয়েটরের যত secret আমরা নিই, দুটোই ন্যূনতমে আনতে হবে।**
- প্রস্তাবিত সমাধানে বর্তমান সব ফিচার ও ফ্লো থাকে। ইউজারের চোখে বদল মাত্র দুটো:
  - পেমেন্টের ধাপ ব্রাউজারের নতুন ট্যাবে খুলবে, ঠিক যেমন এখন sign in খোলে।
  - Stripe secret key paste করার বদলে "Connect Stripe" বাটনে এক ক্লিক।

---

## ২. Framer কী বলেছে

### ২.১. Auto Table of Contents (২৮ অক্টোবর ২০২৬)

1. প্লাগইন প্রজেক্ট বা সাইটের id, বর্তমান ইউজারের ইমেইল, আর সাবস্ক্রিপশন বা পেমেন্টের telemetry বাইরের ব্যাকএন্ডে পাঠায়। প্লাগইন ব্যবহারকারীর প্রজেক্ট বা অ্যাকাউন্টের তথ্য ডেভেলপারের নিয়ন্ত্রিত বা রানটাইমে বদলানো যায় এমন ঠিকানায় যাওয়া চলবে না। এই ডেটা পাঠানো বন্ধ করতে হবে, বা কঠোরভাবে কমাতে হবে, আর **localhost বা রানটাইমে ঠিকানা বদলানোর ব্যবস্থা সরাতে হবে।**
2. প্লাগইন রানটাইমে Stripe.js লোড করে। রিমোট কোড Marketplace-এ জমা দেওয়া ভার্শনের বাইরে বদলে যেতে পারে। রিমোট লোড সবচেয়ে ছোট পেমেন্ট ফ্লোতে সীমিত রাখতে হবে, বাকি সব কোড লোকালি bundle করতে হবে, আর নিশ্চিত করতে হবে যে Stripe থেকে শুধু তাদের সাধারণ লাইব্রেরিটাই আসে।

### ২.২. Chat Bubbles (২৭ অক্টোবর ২০২৬)

1. উইজেট দেখা ও ক্লিকের সময়, আর auth ও পেমেন্ট ফ্লোতে, প্লাগইন analytics আর পেমেন্ট বা সাবস্ক্রিপশনের তথ্য বাইরের ব্যাকএন্ডে পাঠায়। এডিটর, প্রজেক্ট, ইউজার, পেমেন্ট বা সাবস্ক্রিপশনের সাথে জড়িত রিকোয়েস্ট সরাতে হবে, **যদি না সেটা মূল কাজের জন্য একদম দরকারি হয় এবং ন্যূনতম ডেটায় সীমিত থাকে।**

### ২.৩. Formfic

1. প্লাগইন `source/src/App.tsx` থেকে ফর্মের ডেটা আর integration credentials বাইরের ব্যাকএন্ডে পাঠায়। এর মধ্যে প্রজেক্টে লেখা ডেটা আর অ্যাকাউন্টের তথ্যও আছে। ইউজারের প্রজেক্টের ডেটা বা secret এমন অবকাঠামো দিয়ে যাওয়া চলবে না, যা integration-এর জন্য একদম দরকারি না। **ফর্ম আর credential-এর ফ্লো থেকে vendor ব্যাকএন্ড সরাতে হবে**, আর নেটওয়ার্ক রিকোয়েস্ট সেটুকুতে সীমিত রাখতে হবে, যেটুকু ইউজারের নিজের সেট করা integration-এর জন্য লাগে। নিজেদের সার্ভিস দিয়ে যেকোনো প্রজেক্ট ডেটা বা সেভ করা credential পাঠানো চলবে না।

### ২.৪. তিনটা ইমেইল থেকে যে নিয়মগুলো বোঝা যায়

| নিয়ম | মানে |
| :--- | :--- |
| ইউজারের secret আমাদের সার্ভারে যত কম সম্ভব | integration সরাসরি বা OAuth দিয়ে হলে secret নেওয়াই উচিত না |
| প্রজেক্টের ডেটা শুধু যেটুকু ফিচারের জন্য লাগে | যেকোনো প্রজেক্ট ডেটা পাঠানো চলবে না |
| মূল কাজের জন্য দরকারি ডেটা চলবে | মেম্বার sign up, পেজ লক, মেম্বারের পেমেন্ট: এগুলো MemberFrame-এর মূল কাজ |
| ডেভেলপারের নিজের licensing বা billing মূল কাজ না | ট্রায়াল, প্ল্যান, কুপন, বাতিলের কারণ: এগুলো ইউজারের উপকারে আসে না |
| ইমেইল আর প্রজেক্ট id যত কম সম্ভব | ব্যবহার করা গেলেও কেন লাগে তা ব্যাখ্যা করতে হবে |
| বিল্ডে localhost বা বদলানো যায় এমন ঠিকানা থাকবে না | production ঠিকানা স্থির থাকতে হবে |
| রিমোট কোড নয় | সব কোড bundle-এ থাকবে। Stripe-এর ব্যতিক্রমও সবচেয়ে ছোট পরিসরে |
| উইজেট দেখা বা ক্লিকের সময় রিকোয়েস্ট সন্দেহজনক | বিশেষ করে সাবস্ক্রিপশন চেক বা analytics |

---

## ৩. কেন MemberFrame-এও একই সমস্যা

দুটো আলাদা কারণে:

1. **billing:** ২০২৬-১০-১৮ তারিখে কোম্পানির সিদ্ধান্ত ছিল: প্রতিটা Framefic প্লাগইন BEAF-এর billing UI, ফ্লো আর কোড হুবহু কপি করবে। MemberFrame-এর `src/components/billing/` আর `src/styles/billing/` সেই কপি। Auto Table of Contents আর Chat Bubbles-ও একই কপি ব্যবহার করে। তাই সমস্যাটা একটা প্লাগইনের না, **পুরো billing ব্যবস্থার।**
2. **credentials:** Formfic-এর মতো MemberFrame-ও ক্রিয়েটরের কাছ থেকে payment gateway আর sign in provider-এর secret নিয়ে নিজেদের ব্যাকএন্ডে রাখে।

পার্থক্য একটাই: Auto Table of Contents বা Chat Bubbles-এর মূল কাজের জন্য কোনো সার্ভার লাগে না। Formfic-এর ফর্মের ডেটা সরাসরি ব্রাউজার থেকে ইউজারের নিজের সার্ভিসে যেতে পারে।

MemberFrame একটা মেম্বারশিপ প্লাগইন, তাই এর মূল কাজের জন্য ব্যাকএন্ড লাগেই:
- Stripe-এর webhook একটা সার্ভারে আসতে হয়।
- মেম্বারের session সার্ভারে যাচাই হতে হয়।
- পেমেন্ট নিশ্চিত করা ব্রাউজার থেকে নিরাপদে হয় না।
- Framer-এর নিজের কোনো সার্ভার নেই।

ফলে MemberFrame-এর ব্যাকএন্ড পুরোপুরি বাদ দেওয়ার দরকার নেই। ঠিক করতে হবে licensing আর billing-এর অংশ, আর যত কম secret নেওয়া যায় সেই ব্যবস্থা।

---

## ৪. বিস্তারিত সমস্যা

### সমস্যা ১ (বেশি): রানটাইমে Stripe.js লোড হয়

- **কী হচ্ছে**: ক্রিয়েটর প্লাগইনের ভেতরে প্ল্যান কিনলে পেমেন্ট ফর্ম খোলে, আর তখন প্লাগইন `https://js.stripe.com/v3` থেকে Stripe.js ডাউনলোড করে।
- **কোথায়**: [`PaymentModal.tsx`](../../src/components/billing/PaymentModal.tsx) লাইন ২৭ থেকে ৪০ (`import("@stripe/stripe-js/pure")` তারপর `loadStripe`)। বিল্ডে `dist/assets/index-*.js` ফাইলে `https://js.stripe.com/v3` লেখা আছে।
- **আগে কী করা হয়েছিল**: আগের অডিটে (C2) Stripe শুধু পেমেন্ট ফর্ম খুললে লোড হয় এমন করা হয়েছিল। Framer তবুও Auto Table of Contents-এ এই ব্যবস্থাই ধরেছে।
- **কেন সমস্যা**: Framer-এর ইমেইলের দ্বিতীয় পয়েন্টের সাথে হুবহু মেলে।

### সমস্যা ২ (বেশি): বিল্ডে localhost আর ঠিকানা বদলানোর ব্যবস্থা

- **কী হচ্ছে**: production বিল্ডে `http://127.0.0.1:4001` লেখা আছে, আর `process.env` থেকে তিনটা আলাদা ভেরিয়েবল পড়ার একটা চেইন আছে।
- **কোথায়**: [`backend.ts`](../../src/config/backend.ts) লাইন ২০ থেকে ৪৮ (`getEnvApiBaseUrl`, `DEFAULT_API_BASE_URL`, `LOCAL_DEV_API_BASE_URL`)। `deployBaseUrl` ফাংশনের মন্তব্যে লেখা আছে এটা loopback ঠিকানা আটকায়, কিন্তু কোডে আসলে আটকায় না।
- **কেন সমস্যা**: Framer সরাসরি বলেছে "localhost বা runtime endpoint switching সরান"। বিল্ড স্ক্যান করলেই এটা পাওয়া যায়।

### সমস্যা ৩ (বেশি): sign in-এর সাথে সাথে Framer অ্যাকাউন্ট ও প্রজেক্টের তথ্য যায়

- **কী হচ্ছে**: প্লাগইন `framer.getCurrentUser()` থেকে Framer user id, আর `getProjectInfo()` থেকে প্রজেক্ট id ও নাম পড়ে। Sign in শেষ হলেই এগুলো publish করা ডোমেইনের সাথে `/api/connect/attach-project` এ পাঠায়।
- **কোথায়**: [`framerProjectService.ts`](../../src/services/framerProjectService.ts) লাইন ৩৬ থেকে ৬২, [`useConnection.ts`](../../src/hooks/useConnection.ts) লাইন ২১৬ থেকে ২২৫ (`signInWithToken`) আর ২৪৪ থেকে ২৫০ (`linkProject`)।
- **আগে কী করা হয়েছিল**: আগের অডিটের নোটে (I1) লেখা আছে এটা শুধু "Link This Project" ক্লিক করলে হয়। কিন্তু `signInWithToken` এখনো sign in-এর পরপরই স্বয়ংক্রিয়ভাবে পাঠায়।
- **কেন সমস্যা**: Framer নির্দিষ্ট করে "project identifiers" আর "account-related information" এর কথা বলেছে।

### সমস্যা ৪ (বেশি): ব্যাকএন্ড ট্রায়ালের জন্য পরিচয়ের তথ্য একসাথে রাখে

- **কী হচ্ছে**: একজনকে একটার বেশি ট্রায়াল না দেওয়ার জন্য ব্যাকএন্ড প্রতিটা ট্রায়ালে ইমেইল, Framer user id, Framer প্রজেক্ট id আর প্রজেক্টের নাম একসাথে স্থায়ীভাবে রাখে। অ্যাকাউন্ট মুছে দিলেও এই রো থেকে যায়।
- **কোথায়**: ব্যাকএন্ড `prisma/schema.prisma` এ `PluginTrial` মডেল (লাইন ৯৪৪ থেকে ৯৫৩), `User.framerUserId`, `src/routes/connect.ts` লাইন ১৭৫ থেকে ২০৩, `src/services/license/trialService.ts`, `src/routes/pluginBilling.ts` লাইন ১৯২ থেকে ১৯৮।
- **কেন সমস্যা**: সমস্যা ৩-এর ডেটা এখানে এসে জমা হয়। এগুলো licensing-এর জন্য, ইউজারের কাজের জন্য না।

### সমস্যা ৫ (বেশি): প্রতিবার কম্পোনেন্ট দেখালেই `/api/license` কল হয়

- **কী হচ্ছে**: ক্যানভাসে বসানো ৭টা কম্পোনেন্টের প্রত্যেকটা দেখানোর সময় `GET /api/license?site=…&seal=…` কল করে। এটা হয় Framer এডিটরে আর লাইভ সাইটে প্রত্যেক ভিজিটরের ব্রাউজারে। উদ্দেশ্য: ট্রায়ালের watermark, মেয়াদ শেষে lock, আর কপি করা কম্পোনেন্ট চেনা।
- **কোথায়**: `BookmarkButton`, `BookmarksTray`, `MemberAuth`, `MemberDashboard`, `MemberPricing`, `MeteredPaywall`, `ProtectedDownload` (সব [`src/canvas-components/`](../../src/canvas-components/) এ), ফাংশন `mfFetchLicense` আর `useMfLicense`। ব্যাকএন্ডে `src/routes/license.ts`।
- **কেন সমস্যা**: Chat Bubbles-এর ইমেইলে হুবহু এটাই বলা: "উইজেট দেখার সময় সাবস্ক্রিপশনের সাথে জড়িত রিকোয়েস্ট"। এই চেক আমাদের licensing-এর জন্য, মেম্বারের কাজের জন্য না।
- **ভালো দিক**: ব্যাকএন্ড এই রিকোয়েস্ট থেকে কিছু সেভ করে না, শুধু উত্তর দেয়।

### সমস্যা ৬ (মাঝারি): ক্রিয়েটরের ইমেইল, নাম ও ছবি প্রজেক্টের ভেতরে সেভ হয়

- **কী হচ্ছে**: পুরো connection অবজেক্ট (`creatorEmail`, `creatorName`, `creatorAvatarUrl` সহ) Framer প্রজেক্টের plugin data-তে লেখা হয়। Plugin data প্রজেক্টের অংশ, তাই প্রত্যেক collaborator আর যে প্রজেক্ট remix করে, সবাই এটা পায়।
- **কোথায়**: [`connectionStore.ts`](../../src/services/connectionStore.ts) লাইন ২৫৫ থেকে ২৯০ (`writeKey(CONNECTION_KEY, JSON.stringify(connection))`)।
- **কেন সমস্যা**: ব্যক্তিগত তথ্য প্রজেক্টের ডেটায় ঢুকছে, যেটা অন্যরাও দেখতে পায়।

### সমস্যা ৭ (মাঝারি): এডিটর থেকে `/api/preview` কল হয়

- **কী হচ্ছে**: ক্যানভাসে আসল প্ল্যান, প্রোফাইলের প্রশ্ন আর ফাইল দেখানোর জন্য `MemberPricing`, `MemberDashboard` আর `ProtectedDownload` এডিটরে `GET /api/preview?site=…` কল করে। প্রতি ১৫ সেকেন্ডে সর্বোচ্চ একবার।
- **কেন মাঝারি**: এটা analytics না। কম্পোনেন্ট configure করার কাজ, আর Chat Bubbles-এর ইমেইল configure করাকে বৈধ বলে। শুধু পড়ে, কোনো ইউজারের তথ্য নেই। তবে এডিটর থেকে যায়, তাই ব্যাখ্যা দিতে হবে।

### সমস্যা ৮ (কম): ইউজারের প্রজেক্টের কোডে dev-এর জিনিস

- **কী হচ্ছে**: ৭টা কম্পোনেন্ট আর `apiClient.ts`-এ `.ngrok` ঠিকানা চিনে বিশেষ header যোগ করার কোড আছে। কম্পোনেন্টের কোড ক্রিয়েটরের প্রজেক্টে লেখা হয়, তাই রিভিউয়ার এটা পড়তে পারে।
- **কেন সমস্যা**: dev tunnel-এর অবশিষ্ট, "রানটাইমে ঠিকানা বদলানো"-র ইঙ্গিত দেয়।

### সমস্যা ৯ (কম): বাতিলের কারণ মুক্ত লেখা হিসেবে যায়

- **কী হচ্ছে**: সাবস্ক্রিপশন বাতিলের ৩ ধাপের ফ্লোতে ক্রিয়েটর যা লেখে, তা `/api/plugin/cancel` এ যায়।
- **কোথায়**: [`SubscriptionPage.tsx`](../../src/components/billing/SubscriptionPage.tsx) লাইন ১৮৮, [`licenseService.ts`](../../src/services/licenseService.ts) `cancelPlan`।
- **কেন সমস্যা**: এটা subscription telemetry।

### সমস্যা ১০ (বেশি): ক্রিয়েটরের integration secret আমাদের ব্যাকএন্ডে যায় ও সেভ হয়

- **কী হচ্ছে**: ক্রিয়েটর প্লাগইনের Settings-এ নিজের অ্যাকাউন্টের secret paste করে। প্লাগইন সেগুলো আমাদের ব্যাকএন্ডে পাঠায়, ব্যাকএন্ড encrypt করে রাখে আর পরে ক্রিয়েটরের হয়ে সেই সার্ভিসে কল করে।

| secret | কোথা থেকে যায় | কোথায় সেভ হয় |
| :--- | :--- | :--- |
| Stripe secret key, webhook secret | Settings, Payments: `PUT /api/site/payments/gateways/stripe` | `gateway_configs.secrets_encrypted`, `webhook_secret_encrypted` |
| Lemon Squeezy API key, signing secret | একই পথ, `.../lemonsqueezy` | একই টেবিল |
| Razorpay key secret, webhook secret | একই পথ, `.../razorpay` | একই টেবিল |
| Google, GitHub, Apple, Discord-এর OAuth client secret | Settings, Sign in methods: site settings দিয়ে | `integration_secrets` |
| নিজের SMTP সার্ভারের পাসওয়ার্ড | Settings, Email | `integration_secrets` |

- **কোথায়**:
  - প্লাগইন: [`paymentsService.ts`](../../src/services/paymentsService.ts) লাইন ৯৪ থেকে ১১৭ আর ১৬৫ থেকে ২৩৩, [`integrationRegistry.ts`](../../src/components/settings/integrationRegistry.ts), [`gatewayKeys.ts`](../../src/components/settings/gatewayKeys.ts), [`EmailSettings.tsx`](../../src/components/settings/EmailSettings.tsx)।
  - ব্যাকএন্ড: `src/services/payments/gatewayStore.ts`, `src/services/integrationSecrets.ts` (`SECRET_FIELDS`), `src/lib/secretBox.ts`, `prisma/schema.prisma` এ `GatewayConfig` আর `IntegrationSecret`।
- **ভালো দিক**:
  - সব secret AES-256-GCM দিয়ে encrypt করা।
  - encryption key ছাড়া production সার্ভার চালুই হয় না (`src/config/env.ts`)।
  - secret কখনো প্যানেলে ফেরত আসে না, প্যানেল শুধু "Saved. Type to replace it." দেখায়।
  - plugin data বা localStorage-এ secret থাকে না।
- **কেন সমস্যা**: Formfic-এর ইমেইলে হুবহু এটাই বলা: "stored credentials through your own service"। স্বয়ংক্রিয় রিভিউ secret paste করার ঘর দেখেই ধরতে পারে, encrypt করা থাকলেও।

### সমস্যা ১১ (মাঝারি): প্রজেক্টে লেখা ডেটা ব্যাকএন্ডে যায়

- **কী হচ্ছে**:
  - **Site settings document** (`PUT /api/site/settings`): পেজ লক, সেকশন লক, tier, প্রোফাইলের প্রশ্ন, লেবেল আর ইমেইল টেমপ্লেট যায়।
  - **Protected Download** ([`assetsService.ts`](../../src/services/assetsService.ts), [`useSealGuard.ts`](../../src/hooks/useSealGuard.ts) এর `secureDownloadsOnce`): ক্যানভাসে রাখা ফাইলের Framer ঠিকানা পাঠায়, আর ব্যাকএন্ড ফাইলটা নিজে এনে মেম্বারকে দেয়।
  - **লাইভ সাইট**: মেম্বারের sign up আর প্রোফাইল ফর্মের উত্তর যায়।
- **কেন মাঝারি**: এগুলো সব ফিচারের জন্য দরকারি, যেকোনো প্রজেক্ট ডেটা না। লাইভ সাইটে কে কোন পেজ দেখবে, সেটা সার্ভারেই ঠিক করতে হয়। তবে Formfic-এর ইমেইল "data authored in the project" নিয়ে আপত্তি করেছে, তাই প্রতিটা ঘর কেন যায় তা ব্যাখ্যা দিতে হবে।

### ভবিষ্যতের ঝুঁকি: F20 "Framer Site Telemetry Sync"

- PRD-র F20 ([`memberframe-complete-prd.md`](../memberframe-complete-prd.md) লাইন ১২৯৪) বলে: `getCurrentUser()` থেকে ইমেইল, ইউজার id, সাইটের নাম ও ঠিকানা `POST /api/user/site-info` এ পাঠাতে হবে, প্রতিটা লগইন আর সাবস্ক্রিপশন চেকে। সাথে কম্পোনেন্টের সংখ্যা।
- এটা এখনো বানানো হয়নি (IMPLEMENTATION-STATUS টাস্ক ৪.৮ ও ৪.৯ এখনো `todo`)। কিন্তু বানালে Framer নিশ্চিতভাবে বাতিল করবে।
- এর উৎস `.agents/rules/framer-sdd-standards.md` অংশ ১২। **এই কোম্পানি নিয়ম আর Framer-এর নিয়ম এখন পরস্পরবিরোধী।**

---

## ৫. যেগুলো ঠিক আছে (রাখা যাবে, ব্যাখ্যা দিতে হবে)

| কী | কেন রাখা যাবে |
| :--- | :--- |
| লাইভ সাইটে মেম্বার sign up, sign in, OTP, পাসওয়ার্ড রিসেট | মেম্বারশিপের মূল কাজ |
| মেম্বারের পেমেন্ট (`/api/checkout/*`), বুকমার্ক, প্রোফাইল, ডাউনলোড | মূল কাজ, মেম্বার নিজেই চালায় |
| Route shield (`shield.js`) | পেজ ও সেকশন লক এটা ছাড়া চলে না |
| Metered paywall-এর `/api/member/meter` | শুধু sign in করা মেম্বার, শুধু পড়া আর্টিকেলের তালিকা। device id ডিভাইসেই থাকে |
| publish করা ডোমেইন পাঠানো | সিকিউরিটির allowlist: অন্য কারো সাইট থেকে আমাদের API ব্যবহার আটকায় |
| প্লাগইনের Manage, Settings, Reports ট্যাব | ক্রিয়েটরের নিজের মেম্বার আর পেমেন্টের তথ্য, ক্রিয়েটর নিজেই দেখে |
| ক্রিয়েটরের sign in | hosted পেজে হয়, ইমেইল প্লাগইনে টাইপ হয় না |
| ফিচারের config (লক, tier, প্রোফাইলের প্রশ্ন, টেমপ্লেট) | লাইভ সাইটে প্রবেশাধিকার সার্ভার ঠিক করে, তাই নিয়মগুলো সার্ভারে থাকতে হয়। শুধু ফিচারের ঘর যায়, পুরো প্রজেক্ট না |
| Protected Download-এর ফাইলের ঠিকানা | ফাইল লক করার ফিচারের জন্য দরকার। ঠিকানা যায়, ফাইলের কোনো কপি প্লাগইন পাঠায় না |
| Secret রাখার ধরন | AES-256-GCM, প্যানেলে কখনো ফেরত আসে না, ডাউনলোডের পাসওয়ার্ড hash করা। (কতগুলো secret নেওয়া হয়, সেটা সমস্যা ১০) |
| আসল analytics | **নেই।** view বা click রেকর্ড হয় না, ট্র্যাকিং পিক্সেল নেই, `/api/license`, `/api/preview`, shield কিছু সেভ করে না |

---

## ৬. সমাধান

### সমাধান ১: পেমেন্ট hosted checkout পেজে (সমস্যা ১)

- প্ল্যান কার্ড, কুপন, "Confirm Plan Change"-এর হিসাব আর "Payment Completed" modal প্লাগইনেই থাকবে। এগুলোতে Stripe.js লাগে না।
- "Pay" চাপলে ব্রাউজারে `app.framefic.com/memberframe/checkout?session=…` খুলবে। পেজটা ব্যাকএন্ড দেবে, sign in পেজ (`/auth`, `src/routes/creatorAccount.ts`) যেভাবে দেয়। সেখানে একই ডিজাইনের Stripe Elements ফর্ম থাকবে।
- প্লাগইন "পেমেন্টের অপেক্ষায়" দেখাবে আর poll করবে, sign in-এর handoff যেভাবে করে। পেমেন্ট হলে আগের success modal।
- যার কার্ড সেভ করা আছে, তার upgrade সার্ভার নিজেই চার্জ করবে, ট্যাব খুলবে না। ব্যাংক 3D Secure চাইলে তখন ট্যাব খুলবে।
- **ফলাফল**: প্লাগইনে কোনো রিমোট কোড থাকবে না। `@stripe/stripe-js` আর `@stripe/react-stripe-js` প্লাগইন থেকে সরে যাবে। PCI-এর দায়ও প্লাগইনের বাইরে যায়।
- **বিকল্প (সুপারিশ না)**: এখনকার ফর্ম রেখে `index.html`-এ CSP যোগ করা (`script-src 'self' https://js.stripe.com`) আর Framer-কে উত্তর দেওয়া। রিভিউ স্বয়ংক্রিয়, তাই আবার বাতিলের ঝুঁকি থাকে।

### সমাধান ২: স্থির production ঠিকানা (সমস্যা ২ ও ৮)

- `backend.ts`: `import.meta.env.PROD` হলে সরাসরি `https://app.framefic.com/memberframe`, নইলে `.env`-এর মান বা localhost। Vite production বিল্ড থেকে dev-এর অংশ পুরোপুরি বাদ দেয়। `process.env` চেইন মুছে দিতে হবে।
- `vite.config.ts`: production বিল্ডে ঠিকানা HTTPS না হলে, বা loopback হলে, বিল্ড fail করবে।
- `.ngrok` header: কম্পোনেন্টের কোড জেনারেট করার সময় শুধু dev বিল্ডে বসবে।
- **ফ্লোতে প্রভাব**: কিছু না। লোকাল ডেভেলপমেন্ট আগের মতো।

### সমাধান ৩: প্রজেক্ট ও ইউজারের তথ্য কমানো (সমস্যা ৩ ও ৪)

| এখন যায় | পরে |
| :--- | :--- |
| `framerUserId` | বন্ধ। প্লাগইন আর `getCurrentUser()` কলই করবে না |
| প্রজেক্টের নাম | বন্ধ। সাইটের নাম ডিফল্ট "My site", Settings থেকে বদলানো যাবে |
| Framer প্রজেক্ট id | সার্ভারে যাবে না। প্লাগইনের ভেতরে থাকবে: token-এর key আর duplicate চেনার জন্য |
| publish করা ডোমেইন | থাকবে (সিকিউরিটির allowlist) |

- **আবার connect করা**: plugin data-তে `siteId` আগে থেকেই আছে, সেটা দিয়ে।
- **Remix বা duplicate চেনা**: plugin data-তে সেভ করা প্রজেক্ট id আর বর্তমান প্রজেক্ট id মেলানো হবে প্লাগইনের ভেতরে। আলাদা হলে প্রজেক্টটা কপি, তখন "Link This Project" দেখাবে আর নতুন সাইট বানাবে।
- **ট্রায়ালের নিয়ম**: প্রতি অ্যাকাউন্টে একটা, প্রতি সাইটে একটা। অ্যাকাউন্টের ইমেইল যাচাই করা থাকে।
- **trade-off**: কেউ নতুন ইমেইলে নতুন অ্যাকাউন্ট খুললে আবার ট্রায়াল পাবে। এখন Framer user id দিয়ে সেটা আটকানো হয়।
- **ব্যাকএন্ড**: `PluginTrial` থেকে `framerUserId`, `framerProjectId`, `projectName` কলাম বাদ, `User.framerUserId` বাদ। মাইগ্রেশন আগের মান মুছে দেবে, কলাম পরের রিলিজে ড্রপ হবে (আগের অডিটের I5-এর মতো, যাতে rollback চলে)।

### সমাধান ৪: কম্পোনেন্ট থেকে `/api/license` বাদ (সমস্যা ৫)

- **ট্রায়ালের watermark আর lock**: প্লাগইন আগে থেকেই প্রতিটা কম্পোনেন্ট ফাইলের `IS_LOCKED` আর `IS_TRIAL` লাইন license অনুযায়ী আপডেট করে ([`lockPatcher.ts`](../../src/utils/lockPatcher.ts), [`useLicense.ts`](../../src/hooks/useLicense.ts))। কম্পোনেন্ট শুধু এটা দিয়েই চলবে।
- **মেয়াদ শেষে লাইভ সাইট আটকানো**: কম্পোনেন্ট আগে থেকেই মেম্বারের কাজে ব্যাকএন্ডে যায় (session, login, register, checkout, bookmarks)। মেয়াদ শেষ হলে ব্যাকএন্ড সেই কলেই `site_inactive` উত্তর দেবে, আর কম্পোনেন্ট lock দেখাবে। নতুন কোনো রিকোয়েস্ট লাগবে না। জায়গা: ব্যাকএন্ড `src/middleware/site.ts`।
- **কপি করা কম্পোনেন্ট চেনা**: অজানা site key-তে ব্যাকএন্ড আগে থেকেই ৪০৪ দেয়। অন্যের ডোমেইন থেকে এলে origin allowlist আটকায়। এডিটরে পেস্ট করা কম্পোনেন্ট [`useSealGuard.ts`](../../src/hooks/useSealGuard.ts) আগে থেকেই lock করে।
- **ছোট পার্থক্য**: sign in না করা ভিজিটরের জন্য metered paywall গণনা ডিভাইসেই করে। তাই মেয়াদ শেষেও ক্রিয়েটর প্লাগইন না খোলা পর্যন্ত সেটা চলবে। চাইলে shield-এর উত্তরে সাইটের স্ট্যাটাস যোগ করা যায়, নতুন রিকোয়েস্ট ছাড়াই।
- **লাইভ সাইটে seal চেক**: এটা বাদ যাবে। এডিটরের seal guard আর origin allowlist যথেষ্ট।

### সমাধান ৫: বাকি ছোটগুলো (সমস্যা ৬, ৭, ৯)

| সমস্যা | সমাধান | ফ্লোতে প্রভাব |
| :--- | :--- | :--- |
| ৬. plugin data-তে ইমেইল, নাম, ছবি | plugin data-তে শুধু `siteId`, `siteKey`, প্রজেক্ট id। ইমেইল ও নাম `/api/connect/session` থেকে, যেটা প্লাগইন খুললেই কল হয়, মেমরিতে থাকবে। পুরোনো ভার্শনের লেখা মান প্রথম লোডে মুছে যাবে | Profile আগের মতো |
| ৭. এডিটর থেকে `/api/preview` | রেখে দিন, রিভিউয়ারদের জন্য ব্যাখ্যায় লিখুন | কিছু না |
| ৯. বাতিলের কারণ | ৩ ধাপের ফ্লো একই। কারণ হবে ঐচ্ছিক, নির্দিষ্ট তালিকা থেকে (যেমন "দাম বেশি", "দরকার নেই", "অন্য টুল", "অন্য কারণ") | প্রায় একই |
| F20 | এভাবে বানানো যাবে না। PRD-র F20 আর `framer-sdd-standards.md` অংশ ১২ বদলাতে হবে | কিছু না, এখনো বানানো হয়নি |

### সমাধান ৬: রিভিউয়ারদের জন্য ব্যাখ্যা (সমস্যা ১১ সহ)

[`../framer-data-justification.md`](../framer-data-justification.md) আপডেট করতে হবে: কোন রিকোয়েস্ট কেন লাগে, কী ডেটা যায়, কী সেভ হয়।

স্পষ্ট লিখতে হবে:
- কোনো analytics নেই।
- Framer user id পাঠানো হয় না, প্রজেক্ট id সার্ভারে যায় না।
- Stripe প্লাগইনে লোড হয় না।

সমস্যা ১১-এর জন্য:
- **site settings document-এর প্রতিটা ঘর:** কেন সার্ভারে লাগে।
- **Protected Download:** শুধু ঠিকানা যায়।
- **একটা "Credentials" অংশ:**
  - কোন secret এখনো নেওয়া হয় আর কেন।
  - কীভাবে encrypt করা থাকে।
  - প্যানেলে কখনো ফেরত আসে না।
  - কোনগুলো OAuth দিয়ে পুরোপুরি সরানো হয়েছে।

### সমাধান ৭: secret যত কম নেওয়া যায় (সমস্যা ১০)

মূল ধারণা: যেখানে সার্ভিসটা OAuth দেয়, সেখানে ক্রিয়েটর "Connect" বাটনে ক্লিক করবে, আমরা কোনো secret নেব না। যেখানে OAuth নেই, সেখানে secret থাকবে, কিন্তু ঐচ্ছিক "Advanced" অপশন হিসেবে, ব্যাখ্যা সহ।

| # | এখন | প্রস্তাব | ফ্লোতে প্রভাব |
| :--- | :--- | :--- | :--- |
| ৭.ক | Stripe secret key আর webhook secret paste | **Stripe Connect (OAuth)**: "Connect Stripe" বাটন, ক্রিয়েটর Stripe-এর নিজের পেজে অনুমতি দেয়। আমরা রাখি শুধু connected account id (`acct_…`), কোনো secret key না। চার্জ হয় আমাদের platform key দিয়ে, ক্রিয়েটরের অ্যাকাউন্টের নামে। webhook আসে আমাদের platform-এর একটাই endpoint-এ, তাই ক্রিয়েটরকে webhook secret-ও দিতে হয় না | paste-এর বদলে এক ক্লিক, আগের চেয়ে সহজ |
| ৭.খ | Razorpay key secret আর webhook secret paste | Razorpay-র partner OAuth দিয়ে একইভাবে connect। ব্যবহারের আগে Razorpay-র ডকুমেন্টেশন আর partner অনুমোদন যাচাই করতে হবে। না পাওয়া গেলে ৭.গ-এর মতো | একই রকম |
| ৭.গ | Lemon Squeezy API key আর signing secret paste | Lemon Squeezy-তে platform OAuth আছে বলে আমাদের জানা নেই। API key থাকবে, ব্যাখ্যা দিতে হবে। webhook আর তার signing secret আমরা API দিয়ে নিজেরাই বানাব, তাই ক্রিয়েটরকে সেটা paste করতে হবে না | একটা ঘর কম |
| ৭.ঘ | Google, GitHub, Apple, Discord-এর client secret paste | **ডিফল্টে MemberFrame-এর নিজের OAuth app**, ক্রিয়েটরকে কিছু paste করতে হয় না। নিজের OAuth app থাকবে "Advanced" অপশন হিসেবে, যারা নিজের ব্র্যান্ড দেখাতে চায় | বেশিরভাগের জন্য সহজ। consent পর্দায় "MemberFrame" দেখাবে |
| ৭.ঙ | নিজের SMTP পাসওয়ার্ড | ডিফল্টে আমাদের mailer থাকবেই। নিজের SMTP ঐচ্ছিক "Advanced", ব্যাখ্যা সহ | কোনো বদল নেই |

- **আগে থেকে secret দেওয়া ক্রিয়েটর**:
  - তাদের সেভ করা key কাজ করতে থাকবে।
  - প্যানেল তাদের "Connect Stripe" দিয়ে আবার connect করতে বলবে।
  - connect হলে পুরোনো key মুছে যাবে।
  - কিছুদিন পরে paste করার পথ পুরোপুরি বন্ধ।
- **ফলাফল**: সবচেয়ে বড় দুটো secret-এর উৎস (Stripe আর sign in providers) বন্ধ হয়। বাকি যা থাকে তা ঐচ্ছিক, ব্যাখ্যা সহ।

---

## ৭. ফিচার ও ফ্লোর উপর প্রভাব

| ফিচার বা ফ্লো | পরিবর্তনের পরে |
| :--- | :--- |
| ক্রিয়েটরের sign in ও sign up | একই |
| প্রজেক্ট connect ও আবার connect | একই। শুধু কপি করা প্রজেক্টে "Link This Project" আসবে, এখনো যেমন আসে |
| ৭ দিনের ট্রায়াল | একই। নিয়ম বদলায়: প্রতি অ্যাকাউন্ট ও প্রতি সাইটে একটা |
| ট্রায়ালের countdown, watermark, lock | একই |
| প্ল্যান কেনা ও upgrade | প্ল্যান বাছাই, কুপন, হিসাব একই। **কার্ড দেওয়ার ধাপ নতুন ট্যাবে খুলবে** |
| সাবস্ক্রিপশন বাতিল | ৩ ধাপ একই, কারণটা তালিকা থেকে |
| Builder, Manage, Reports | একই |
| Settings: Stripe connect | secret key paste-এর বদলে "Connect Stripe" বাটন, আগের key থাকলে আবার connect করার অনুরোধ |
| Settings: Razorpay, Lemon Squeezy | Razorpay OAuth পাওয়া গেলে "Connect" বাটন। Lemon Squeezy-তে API key থাকে, webhook secret আর লাগে না |
| Settings: sign in methods | ডিফল্টে কিছু paste করতে হয় না। নিজের OAuth app "Advanced"-এ |
| Settings: Email | একই, নিজের SMTP "Advanced"-এ |
| মেম্বারের পেমেন্ট (লাইভ সাইট) | একই, চার্জ এখন Stripe Connect দিয়ে |
| লাইভ সাইটের সব মেম্বার ফিচার | একই |
| মেয়াদ শেষে লাইভ সাইট lock | একই, তবে এখন প্রথম মেম্বার রিকোয়েস্টে ধরা পড়ে |
| ক্যানভাসে আসল প্ল্যান দেখানো | একই |

---

## ৮. যে সিদ্ধান্তগুলো দরকার

| # | সিদ্ধান্ত | সুপারিশ | কে নেবে |
| :--- | :--- | :--- | :--- |
| ১ | Stripe: hosted checkout, নাকি CSP দিয়ে এখনকার ফর্ম | hosted checkout | প্রোডাক্ট ও টেক লিড |
| ২ | ট্রায়াল: "প্রতি অ্যাকাউন্টে একটা" মেনে নেওয়া, নাকি Framer user id রেখে ব্যাখ্যা দেওয়া | প্রতি অ্যাকাউন্টে একটা | প্রোডাক্ট |
| ৩ | কোম্পানির billing নিয়ম (BEAF-এর হুবহু কপি) বদলানো | হ্যাঁ, সব প্লাগইনের জন্য | ম্যানেজমেন্ট |
| ৪ | `framer-sdd-standards.md` অংশ ১২ (telemetry) আর PRD-র F20 বাতিল বা বদল | বাতিল, বা শুধু ক্রিয়েটরের চালু করা opt-in হিসেবে | টেক লিড |
| ৫ | মেম্বারের পেমেন্টে Stripe Connect (Standard বা Express অ্যাকাউন্ট), আর platform ফি নেওয়া হবে কি না | Standard, ফি শূন্য, যাতে আজকের মতোই টাকা সরাসরি ক্রিয়েটরের কাছে যায় | প্রোডাক্ট ও ফিন্যান্স |
| ৬ | sign in-এ ডিফল্টে MemberFrame-এর নিজের OAuth app | হ্যাঁ, নিজের app "Advanced"-এ | প্রোডাক্ট |
| ৭ | Razorpay partner OAuth-এর জন্য আবেদন | হ্যাঁ, না পেলে API key ব্যাখ্যা সহ | টেক লিড |

---

## ৯. ঝুঁকি

- **পেমেন্টের ধাপে একটা বাড়তি ক্লিক**: কার্ডের ধাপ নতুন ট্যাবে যায়, তাই কিছু ক্রিয়েটর হয়তো মাঝপথে ছেড়ে দেবে। Sign in আগে থেকেই এভাবে চলে, তাই ক্রিয়েটররা ধরনটা চেনে।
- **ট্রায়ালের অপব্যবহার**: নতুন ইমেইলে নতুন ট্রায়াল নেওয়া সহজ হবে। ইমেইল যাচাই আর প্রতি সাইটে একটা ট্রায়ালের নিয়ম এটা কিছুটা আটকায়।
- **মেয়াদ শেষের lock একটু দেরিতে**: লাইভ সাইট এখন প্রথম মেম্বার রিকোয়েস্টে lock হবে। sign in না করা ভিজিটরের metered paywall ক্রিয়েটর প্লাগইন না খোলা পর্যন্ত চলবে।
- **পুরোনো ভার্শনের ডেটা**: plugin data-তে আগের ইমেইল ও নাম থেকে যাবে, যতক্ষণ না নতুন ভার্শন প্রজেক্টটা খোলে।
- **Stripe Connect-এর প্রস্তুতি**:
  - Stripe-এ platform অ্যাকাউন্ট আর Connect চালু করতে Stripe-এর অনুমোদন লাগে।
  - ব্যাকএন্ডের `src/services/payments/` এ চার্জ করার কোড বদলাতে হবে।
  - আগে থেকে key দেওয়া ক্রিয়েটরদের সরানোর সময় দুটো পথ একসাথে চালাতে হবে।
- **নিজেদের OAuth app-এর দায়**: Google আর Apple-এর app যাচাই (verification) আমাদের করতে হবে। সব ক্রিয়েটরের মেম্বার একই app দিয়ে sign in করবে, তাই app বন্ধ হলে সবার sign in বন্ধ। ক্রিয়েটরের নিজের app-এর বিকল্প সেজন্য রাখা দরকার।
- **Lemon Squeezy-র API key থেকে যায়**: OAuth না থাকলে এটা ব্যাখ্যা দিয়েই পার করতে হবে। রিভিউ না মানলে Lemon Squeezy সাময়িকভাবে বন্ধ রাখার কথা ভাবতে হবে।
- **রিভিউ আবার বাতিল করতে পারে**: স্বয়ংক্রিয় রিভিউ কী ধরবে, আমরা পুরোপুরি জানি না। তাই জমা দেওয়ার আগে বিল্ড স্ক্যান করতে হবে ([`36-marketplace-review-fix-workflow.md`](36-marketplace-review-fix-workflow.md) ধাপ ৭)।

---

## ১০. অন্য প্লাগইনে প্রভাব

BEAF, Auto Table of Contents, Chat Bubbles, আর BEAF-এর billing কপি করা প্রতিটা Framefic প্লাগইনে সমস্যা ১, ২, ৩, ৪, ৬ আর ৯ থাকার কথা। সমস্যা ৫ থাকবে যেখানে কম্পোনেন্ট নিজে license চেক করে। সমস্যা ১০ আর ১১ থাকবে যেখানে প্লাগইন ক্রিয়েটরের API key বা secret নেয়, বা প্রজেক্টের ডেটা নিজেদের সার্ভারে পাঠায়, যেমন Formfic। প্রস্তাব: সমাধানটা একবার একটা শেয়ার করা billing মডিউল হিসেবে বানানো, তারপর সব প্লাগইনে বসানো। কপি করে করে আলাদাভাবে ঠিক করলে আবার ভুল ছড়াবে।
