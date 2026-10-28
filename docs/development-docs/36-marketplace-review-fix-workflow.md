# Marketplace রিভিউ সমস্যা সমাধানের ধাপে ধাপে প্রক্রিয়া

[`35-marketplace-review-report.md`](35-marketplace-review-report.md)-এর ১১টা সমস্যা কোন ক্রমে, কোন ফাইলে, কীভাবে ঠিক করতে হবে, আর প্রতিটা ধাপ শেষ হয়েছে কি না কীভাবে যাচাই করতে হবে।

**তারিখ**: ২৮ অক্টোবর ২০২৬
**কার জন্য**: MemberFrame প্লাগইন ও ব্যাকএন্ড টিম
**স্ট্যাটাস**: শুরু হয়নি
**রেপো**: `memberframe/` (প্লাগইন), `memberframe-backend/` (ব্যাকএন্ড)

---

## ০. কাজের নিয়ম

1. **ক্রম মেনে চলুন।**
   - প্রথমে যে ধাপে ইউজারের ফ্লো বদলায় না (ধাপ ১ থেকে ৩)।
   - তারপর ক্রিয়েটরের পেমেন্ট (ধাপ ৪), তারপর credentials (ধাপ ৫)।
   - ধাপ ৫-এর Stripe Connect অনুমোদন সময় নেয়, তাই এর আবেদন ধাপ ০-তেই করে রাখুন।
   - প্রতিটা ধাপ আলাদা কমিট, আলাদা রিভিউ।
2. **প্রতি ধাপের শেষে সব গেট পাস করতে হবে**:
   ```
   npm run lint:css && npm run lint:design && npx tsc --noEmit && npm test && npm run build && npm run check:no-cdn
   ```
   ব্যাকএন্ডে: `npx tsc --noEmit && npm test`।
3. **প্রতি ধাপের শেষে বিল্ড স্ক্যান** (ধাপ ৭.১-এর কমান্ড)। যে ধাপ যে সমস্যা ঠিক করে, তার লাইন শূন্য হতে হবে।
4. **ফিচার বা ফ্লো ভাঙা যাবে না।** প্রতিটা ধাপের "যাচাই" অংশে Framer-এ হাতে করা পরীক্ষা আছে। এজেন্ট বা টেস্ট Framer-এর ভেতরের আচরণ দেখতে পারে না, তাই সেগুলো মানুষকে করতে হবে।
5. **ডকুমেন্ট আপডেট**: প্রতি ধাপ শেষে এই ফাইলের শেষের অগ্রগতির টেবিলে স্ট্যাটাস বদলান, আর `IMPLEMENTATION-STATUS.md`-এ রো যোগ করুন।
6. **লেখার নিয়ম**: UI-র লেখা আর ডকুমেন্টে em-dash বা en-dash নয়, emoji নয় (`instruction/INSTRUCTION.md`)।

---

## ধাপ ০: প্রস্তুতি (আধা দিন)

| # | কাজ | কে |
| :--- | :--- | :--- |
| ০.১ | রিপোর্টের অংশ ৮-এর সাতটা সিদ্ধান্ত নিন: Stripe-এর পথ, ট্রায়ালের নিয়ম, billing নিয়ম বদল, F20, Stripe Connect-এর ধরন ও ফি, ডিফল্ট OAuth app, Razorpay OAuth | লিড |
| ০.১ক | Stripe Dashboard-এ Connect চালু করে platform প্রোফাইল জমা দিন। Razorpay partner প্রোগ্রামে আবেদন করুন। Google আর Apple-এ MemberFrame-এর OAuth app বানিয়ে যাচাইয়ের আবেদন করুন। এগুলোতে কয়েক দিন লাগে | লিড |
| ০.২ | একটা ব্রাঞ্চ খুলুন, যেমন `fix/marketplace-review` | ডেভেলপার |
| ০.৩ | এখনকার বিল্ডে ধাপ ৭.১-এর স্ক্যান চালিয়ে ফলাফল সেভ করুন। পরে তুলনার জন্য | ডেভেলপার |
| ০.৪ | এখনকার সব ফ্লো একবার Framer-এ চালিয়ে দেখুন (ধাপ ৭.৩-এর তালিকা), যাতে পরে বোঝা যায় কিছু ভেঙেছে কি না | QA |

**শেষ হয়েছে যখন**: সিদ্ধান্ত লেখা আছে, শুরুর স্ক্যানের ফলাফল সেভ করা আছে।

---

## ধাপ ১: স্থির production ঠিকানা (সমস্যা ২ ও ৮, আধা দিন)

### প্লাগইন

1. [`src/config/backend.ts`](../../src/config/backend.ts)
   - `getEnvApiBaseUrl`-এর `process.env` অংশ মুছুন।
   - `PRODUCTION_API_BASE_URL = "https://app.framefic.com/memberframe"` নামে একটা ধ্রুবক যোগ করুন।
   - `API_BASE_URL = import.meta.env.PROD ? PRODUCTION_API_BASE_URL : (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_APP_BASE_URL || "http://127.0.0.1:4001")`।
   - `DEFAULT_API_BASE_URL` আর `LOCAL_DEV_API_BASE_URL` মুছুন, যারা ব্যবহার করে তাদের `API_BASE_URL` দিন।
   - `deployBaseUrl`: মন্তব্য যা বলে, কোড সেটাই করুক। loopback ঠিকানা হলে `PRODUCTION_API_BASE_URL` ফেরত দিক।
2. [`vite.config.ts`](../../vite.config.ts): `command === "build"` হলে চেক করুন ঠিকানা `https://` দিয়ে শুরু আর loopback না। না হলে `throw`, বিল্ড থামবে।
3. `.ngrok` header:
   - কম্পোনেন্টের কোডে (`src/canvas-components/*.tsx`, ৭টা ফাইল) `ngrok-skip-browser-warning` এর লাইনগুলো একটা চিহ্নিত ব্লকে রাখুন।
   - জেনারেটর ([`canvasComponentCodeGenerator.ts`](../../src/services/canvasComponentCodeGenerator.ts)) production বিল্ডে সেই ব্লক বাদ দেবে।
   - [`src/services/apiClient.ts`](../../src/services/apiClient.ts)-এর `.ngrok` অংশ `import.meta.env.DEV` দিয়ে ঘিরে দিন।
4. টেস্ট: `test/` এ নতুন টেস্ট, যা production মোডে `API_BASE_URL` HTTPS আর loopback না, তা নিশ্চিত করে। আর একটা টেস্ট, যা জেনারেট করা কোডে `ngrok` না থাকা নিশ্চিত করে।

### যাচাই

- `npm run build` তারপর স্ক্যান: `127.0.0.1`, `localhost`, `process.env`, `ngrok` এর লাইন শূন্য।
- `npm run dev` এ লোকাল ব্যাকএন্ডের সাথে আগের মতো কাজ করে।

**শেষ হয়েছে যখন**: সব গেট পাস, স্ক্যান পরিষ্কার, dev আগের মতো চলে।

---

## ধাপ ২: প্রজেক্ট ও ইউজারের তথ্য কমানো (সমস্যা ৩, ৪, ৬, ৯, দেড় থেকে দুই দিন)

### ২.ক. প্লাগইন: Framer user id আর প্রজেক্টের নাম পাঠানো বন্ধ

1. [`src/services/framerProjectService.ts`](../../src/services/framerProjectService.ts): `readProjectContext` থেকে `framer.getCurrentUser()` কল মুছুন। `creatorName` আর `framerUserId` ফিল্ড বাদ।
2. [`src/services/connectService.ts`](../../src/services/connectService.ts): `AttachProjectInput` থেকে `framerUserId`, `projectName`, `framerProjectId` বাদ। থাকবে: `siteId` (থাকলে) আর `origins`।
3. [`src/hooks/useConnection.ts`](../../src/hooks/useConnection.ts), `signInWithToken` আর `linkProject`:
   - plugin data-তে `siteId` থাকলে সেটা পাঠিয়ে আবার connect করুন।
   - না থাকলে, বা প্রজেক্টটা কপি হলে, নতুন সাইট।
   - কপি চেনা: plugin data-তে সেভ করা `framerProjectId` আর `framer.getProjectInfo().id` প্লাগইনের ভেতরে তুলনা করুন। আলাদা হলে কপি।
4. `framer.json`: `getCurrentUser` এর কোনো permission থাকলে মুছুন।

### ২.খ. প্লাগইন: plugin data থেকে ব্যক্তিগত তথ্য সরানো

1. [`src/services/connectionStore.ts`](../../src/services/connectionStore.ts): plugin data-তে লিখবে শুধু `siteId`, `siteKey`, `framerProjectId`।
   - `creatorEmail`, `creatorName`, `creatorAvatarUrl`, `siteName` শুধু মেমরিতে থাকবে।
   - এগুলো আসবে `/api/connect/session` থেকে, যেটা প্লাগইন খুললেই কল হয়।
2. পুরোনো ভার্শনের লেখা connection পড়লে নতুন আকারে আবার লিখুন, ব্যক্তিগত ফিল্ড বাদ দিয়ে। আগের অডিটের C1-এ token যেভাবে মোছা হয়েছিল।
3. Profile, ConnectTab আর যেখানে `creatorEmail` দেখায়, সেখানে মেমরির মান ব্যবহার হচ্ছে কি না দেখুন।

### ২.গ. প্লাগইন: বাতিলের কারণ

1. [`src/components/billing/SubscriptionPage.tsx`](../../src/components/billing/SubscriptionPage.tsx): ৩ ধাপের ফ্লো একই রাখুন। মুক্ত লেখার ঘরের বদলে ঐচ্ছিক একটা তালিকা দিন: "দাম বেশি", "এখন দরকার নেই", "অন্য টুল ব্যবহার করছি", "অন্য কারণ"।
2. [`src/services/licenseService.ts`](../../src/services/licenseService.ts) `cancelPlan`: শুধু তালিকার key যাবে, অথবা কিছুই না।

### ২.ঘ. ব্যাকএন্ড

1. `src/routes/connect.ts` (attach-project, লাইন ১৭৫ থেকে ২০৩):
   - নতুন ইনপুট গ্রহণ করুন: `siteId?`, `origins`।
   - `framerUserId`, `projectName`, `framerProjectId` এলে উপেক্ষা করুন। পুরোনো প্লাগইন ভার্শন কিছুদিন এগুলো পাঠাতে পারে।
   - `siteId` থাকলে মালিক মিলিয়ে সেই সাইট দিন। না থাকলে নতুন সাইট, নাম "My site"।
2. `src/services/creatorAuthService.ts` `attachProject`: `framerSiteId`-এর বদলে `siteId` দিয়ে খোঁজা।
3. `src/services/license/trialService.ts`: ট্রায়ালের অধিকার শুধু `userId`/`email` আর `siteId` দিয়ে। `framerUserId` আর `framerProjectId` দিয়ে মেলানো বাদ।
4. `src/routes/pluginBilling.ts` লাইন ১৯২ থেকে ১৯৮: `framerUserId` পড়া বাদ।
5. `src/routes/pluginBilling.ts` cancel: কারণ শুধু অনুমোদিত তালিকার key, বা খালি।
6. `prisma/schema.prisma` আর নতুন মাইগ্রেশন:
   - `PluginTrial.framerUserId`, `PluginTrial.framerProjectId`, `PluginTrial.projectName`, `User.framerUserId`: এখন থেকে লেখা বন্ধ। মাইগ্রেশন আগের মান `NULL` বা খালি করে দেবে।
   - কলামগুলো পরের রিলিজে ড্রপ করুন, যাতে rollback চলে (আগের অডিটের I5-এর মতো)।
   - `Site.framerSiteId` এর unique index দরকার থাকলে রাখুন, কিন্তু নতুন সাইটে মান লেখা বন্ধ।

### যাচাই

- **টেস্ট**:
  - attach-project-এ `framerUserId` বা প্রজেক্টের নাম গেলে সেটা সেভ হয় না।
  - `siteId` দিয়ে আবার connect হয়।
  - কপি করা প্রজেক্টে নতুন সাইট হয়।
  - একই অ্যাকাউন্টে দ্বিতীয় ট্রায়াল হয় না।
- **স্ক্যান**: বিল্ডে `getCurrentUser`, `framerUserId`, `creatorEmail` এর লাইন শূন্য।
- **Framer-এ হাতে**:
  - নতুন প্রজেক্টে sign in -> connect -> ট্রায়াল চালু।
  - প্লাগইন বন্ধ করে খুললে আবার connect হয়।
  - প্রজেক্ট duplicate করে খুললে "Link This Project" আসে।
  - Profile-এ ইমেইল ও নাম দেখায়।
  - সাবস্ক্রিপশন বাতিলের ৩ ধাপ চলে।
- **ডেটাবেস**: নতুন সাইটের `sites`, `plugin_trials`, `users` টেবিলে Framer user id, প্রজেক্ট id আর নাম খালি।

**শেষ হয়েছে যখন**: উপরের সব পাস, আর পুরোনো প্লাগইন ভার্শন দিয়েও connect হয় (পিছনের দিকে সামঞ্জস্য)।

---

## ধাপ ৩: কম্পোনেন্ট থেকে `/api/license` বাদ (সমস্যা ৫, দেড় দিন)

### ৩.ক. ব্যাকএন্ড: মেম্বার রিকোয়েস্টেই সাইটের স্ট্যাটাস

1. `src/middleware/site.ts`: সাইট resolve করার সময় ক্রিয়েটরের license দেখুন (`src/services/license/licenseService.ts`)। মেয়াদ শেষ বা lock হলে মেম্বার API `402` আর `{ reason: "site_inactive" }` দেবে।
   - session-এর উত্তর ঠিক কী হবে, তা লিড ঠিক করবেন।
2. যেসব রুটে লাগবে: `/api/member/*`, `/api/checkout/*`, `/api/assets/*`, `/api/member/bookmarks`।
   - `/api/preview` আর `/api/member/auth-config`-এ লাগবে না, এডিটরে আসল ডেটা দেখাতে।
3. ঐচ্ছিক: `src/routes/shield.ts`-এর উত্তরে সাইটের স্ট্যাটাস যোগ করুন, যাতে sign in না করা ভিজিটরের metered paywall-ও lock হয়।
4. `src/routes/license.ts` (`GET /api/license`): নতুন প্লাগইন ভার্শনের কম্পোনেন্ট আর কল করবে না। পুরোনো কম্পোনেন্ট ক্রিয়েটরদের প্রজেক্টে থেকে যাবে, তাই রুটটা কিছুদিন রাখুন, পরে সরান।

### ৩.খ. কম্পোনেন্ট

1. ৭টা কম্পোনেন্ট থেকে `mfFetchLicense`, `useMfLicense`, `MF_LICENSE_CACHE_MS` আর countdown-এর সার্ভার অংশ মুছুন।
   - ফাইলগুলো: `BookmarkButton`, `BookmarksTray`, `MemberAuth`, `MemberDashboard`, `MemberPricing`, `MeteredPaywall`, `ProtectedDownload`।
   - `test/canvasLicenseParity.test.ts` এখন এদের একই রাখে, এখনো একই রাখবে।
2. watermark আর lock আসবে শুধু ফাইলের `IS_LOCKED`, `IS_TRIAL` লাইন থেকে।
   - ট্রায়ালের শেষ সময় ফাইলে লেখা থাকলে, সেই সেকেন্ডে lock দেখানো চলবে, সার্ভারে না গিয়ে।
   - ঘড়ির হিসাব ব্রাউজারেই হয়।
3. প্রতিটা মেম্বার API কলের উত্তরে `site_inactive` এলে কম্পোনেন্ট lock অবস্থায় যাবে।
   - অজানা site key-তে `404 site_not_found` এলে "copied" অবস্থা দেখাবে।
4. কম্পোনেন্টের `seal` প্রপ শুধু এডিটরে ব্যবহার হবে, লাইভ সাইটে পাঠানো হবে না।

### ৩.গ. প্লাগইন

1. [`src/hooks/useLicense.ts`](../../src/hooks/useLicense.ts) আর [`src/utils/lockPatcher.ts`](../../src/utils/lockPatcher.ts): license বদলালে ফাইলের লাইন আপডেট আগের মতোই। দেখুন trial-এর শেষ সময়ও ফাইলে লেখা হয় কি না, না হলে যোগ করুন।

### যাচাই

- **টেস্ট**:
  - জেনারেট করা কোডে `/api/license` নেই।
  - `site_inactive` উত্তরে lock অবস্থা।
  - lock লাইন বদলালে watermark বা lock বদলায়।
- **স্ক্যান**: কম্পোনেন্টের সোর্সে `/api/license` এর লাইন শূন্য।
- **Framer-এ হাতে**:
  - ট্রায়ালে watermark দেখায়।
  - প্ল্যান কেনার পর watermark চলে যায়।
  - sign out করলে ক্যানভাসে lock দেখায়।
  - ডেটাবেসে license মেয়াদোত্তীর্ণ করলে লাইভ সাইটে sign in চেষ্টায় lock দেখায়।
  - অন্য প্রজেক্টে পেস্ট করা কম্পোনেন্ট lock হয়।
- **নেটওয়ার্ক ট্যাব**: লাইভ সাইটে পেজ খুললে, মেম্বার কিছু না করলে, MemberFrame-এর কোনো রিকোয়েস্ট যায় না (shield ছাড়া)।

**শেষ হয়েছে যখন**: উপরের সব পাস, আর watermark ও lock আগের মতো দেখায়।

---

## ধাপ ৪: পেমেন্ট hosted checkout পেজে (সমস্যা ১, দুই থেকে তিন দিন)

> ধাপ ০.১-এ "CSP দিয়ে এখনকার ফর্ম" বাছাই করলে এই ধাপের বদলে নিচের ৪.চ করুন।

### ৪.ক. ব্যাকএন্ড: checkout পেজ

1. নতুন রুট `GET /checkout`, sign in পেজের পাশে (`src/routes/creatorAccount.ts`, যেখানে `/auth` আছে)। ইনপুট: `session` (প্লাগইনের বানানো র‍্যান্ডম id), `theme`।
   - পেজটা BEAF-এর PaymentModal-এর হুবহু ডিজাইন: Stripe Elements, কুপন, মোট দাম, light ও dark।
   - Stripe.js এখানে লোড হবে, এটা আমাদের ওয়েবসাইট, প্লাগইন না।
2. প্লাগইনের `POST /api/plugin/checkout` এখন `{ siteId, plan, coupon?, sessionId }` নেবে।
   - ফেরত দেবে: payment intent না, পেজের ঠিকানা।
   - যার সেভ করা কার্ড আছে আর 3D Secure লাগে না, তার upgrade সরাসরি চার্জ হবে, ফেরত দেবে `{ status: "paid", license }`।
3. নতুন `GET /api/plugin/checkout/status?session=…`: `pending`, `paid` (license সহ), `failed`। Sign in handoff যেভাবে কাজ করে।
4. পেমেন্ট শেষে পেজটা "পেমেন্ট সম্পন্ন, প্লাগইনে ফিরে যান" দেখাবে।
   - license আপডেট webhook দিয়ে আগের মতোই হবে, আর license stream প্লাগইনকে জানাবে।

### ৪.খ. প্লাগইন

1. [`src/components/billing/PaymentModal.tsx`](../../src/components/billing/PaymentModal.tsx):
   - Stripe Elements-এর অংশ সরান।
   - তার জায়গায় "Continue to payment" লিংক, যেটা নতুন ট্যাবে পেজ খোলে। [`AuthModal.tsx`](../../src/components/billing/AuthModal.tsx) sign in যেভাবে খোলে, `window.open` ছাড়া, আসল লিংক হিসেবে।
   - তারপর অপেক্ষার অবস্থা আর `checkout/status` poll।
2. প্ল্যান কার্ড ([`PaymentPlans.tsx`](../../src/components/billing/PaymentPlans.tsx)), কুপন, "Confirm Plan Change", 3 ধাপের cancel, আর [`PaymentSuccessModal.tsx`](../../src/components/billing/PaymentSuccessModal.tsx): অপরিবর্তিত।
3. `package.json` থেকে `@stripe/stripe-js` আর `@stripe/react-stripe-js` সরান।
4. `.agents/scripts/check-no-cdn.js` (`npm run check:no-cdn`): `js.stripe.com`-এর অনুমতি সরান। এখন বিল্ডে কোনো বাইরের লোড থাকবে না।
5. [`src/styles/billing/payment.css`](../../src/styles/billing/payment.css): Stripe Elements-এর স্টাইল ব্যাকএন্ডের পেজে সরান, প্লাগইনে অপেক্ষার অবস্থার স্টাইল যোগ করুন। `ffmf-` প্রিফিক্স রাখুন।

### ৪.গ. টেস্ট

- checkout status-এর poll: pending থেকে paid হলে success modal।
- failed হলে আগের "Payment Unavailable" বা ত্রুটির বার্তা।
- সেভ করা কার্ডে upgrade ট্যাব না খুলেই paid।
- বিল্ডে `stripe` প্যাকেজ নেই।

### ৪.ঘ. যাচাই

- **স্ক্যান**: `js.stripe.com`, `loadStripe`, `stripe-js` এর লাইন শূন্য।
- **Framer-এ হাতে (Stripe test mode)**:
  - Monthly, Yearly, Lifetime কেনা।
  - কুপন দিয়ে কেনা।
  - Monthly থেকে Yearly upgrade, সেভ করা কার্ডে।
  - 3D Secure কার্ড (`4000 0027 6000 3184`)।
  - ব্যর্থ কার্ড (`4000 0000 0000 0002`)।
  - পেমেন্টের মাঝপথে ট্যাব বন্ধ করলে প্লাগইন অপেক্ষা থেকে বের হওয়ার পথ দেয়।
  - light ও dark দুই থিমে পেজ।

### ৪.ঙ. শেষ হয়েছে যখন

সব কেনার পথ কাজ করে, success modal আসে, watermark চলে যায়, আর বিল্ডে Stripe-এর কিছু নেই।

### ৪.চ. বিকল্প: CSP দিয়ে এখনকার ফর্ম রাখা

1. `index.html`-এ `<meta http-equiv="Content-Security-Policy" content="script-src 'self' https://js.stripe.com; frame-src https://js.stripe.com https://hooks.stripe.com">`। বাকি directive আজকের ফন্ট আর API-র সাথে মিলিয়ে।
2. [`framer-data-justification.md`](../framer-data-justification.md) আর Framer-কে উত্তরে লিখুন: Stripe.js শুধু পেমেন্ট ফর্ম খুললে আসে, শুধু `js.stripe.com/v3` থেকে, PCI নিয়মে Stripe এটা bundle করতে দেয় না।
3. ঝুঁকি: রিভিউ আবার বাতিল করতে পারে। তখন ৪.ক থেকে ৪.ঙ করতেই হবে।

---

## ধাপ ৫: Credentials কমানো (সমস্যা ১০, চার থেকে পাঁচ দিন)

লক্ষ্য: যেখানে OAuth আছে, সেখানে ক্রিয়েটর কোনো secret paste করবে না। যেখানে নেই, সেখানে secret ঐচ্ছিক আর ব্যাখ্যা সহ। আগে থেকে secret দেওয়া ক্রিয়েটরদের সাইট এক মুহূর্তও বন্ধ হবে না।

### ৫.ক. Stripe Connect (ব্যাকএন্ড)

1. `.env`-এ নতুন: `STRIPE_PLATFORM_SECRET_KEY`, `STRIPE_CONNECT_CLIENT_ID`, `STRIPE_CONNECT_WEBHOOK_SECRET`। `src/config/env.ts`-এ যোগ করুন, production-এ বাধ্যতামূলক।
   - এগুলো আমাদের নিজেদের key, ক্রিয়েটরের না।
2. নতুন রুট:
   - `GET /api/site/payments/stripe/connect?siteId=…`: Stripe-এর OAuth পেজের ঠিকানা দেয়। `state` হিসেবে একটা র‍্যান্ডম, এক বারের, সাইটের সাথে বাঁধা টোকেন। sign in handoff-এর মতো ডেটাবেসে রাখা।
   - `GET /payments/stripe/callback`: Stripe ফেরত পাঠালে `code` বদলে `stripe_user_id` (`acct_…`) নেয়। `gateway_configs`-এ `publicId = acct_…` আর `secretsEncrypted` খালি রেখে সেভ করে। তারপর "সম্পন্ন, প্লাগইনে ফিরে যান" পেজ দেখায়।
   - `POST /api/site/payments/stripe/disconnect`: Stripe-এ deauthorize করে রো মুছে দেয়। প্যানেলে আগে ConfirmDialog দেখাবে (Framer-এর নিয়ম)।
3. `src/services/payments/`:
   - Stripe দিয়ে সব কাজ: checkout session, subscription, refund, billing portal।
   - রো-তে `acct_…` থাকলে platform key দিয়ে `{ stripeAccount: acct_… }` হেডারে কল।
   - পুরোনো রো-তে secret key থাকলে আগের মতোই সেই key দিয়ে কল। এটাই আগের ক্রিয়েটরদের সাইট চালু রাখে।
4. Webhook: Connect-এর জন্য একটা platform endpoint, যেমন `POST /api/webhooks/stripe-connect`, `STRIPE_CONNECT_WEBHOOK_SECRET` দিয়ে যাচাই। ইভেন্টের `account` থেকে সাইট বের করে আগের handler-এ পাঠান।
5. Platform ফি: সিদ্ধান্ত ০.১ অনুযায়ী। ফি শূন্য হলে `application_fee_amount` পাঠাবেন না।

### ৫.খ. Stripe Connect (প্লাগইন)

1. [`src/components/settings/integrationRegistry.ts`](../../src/components/settings/integrationRegistry.ts) আর [`gatewayKeys.ts`](../../src/components/settings/gatewayKeys.ts): Stripe-এর `secretKey` আর `webhookSecret` ঘর সরান। থাকবে "Connect Stripe" বাটন আর connect হলে অ্যাকাউন্টের নাম ও স্ট্যাটাস।
2. বাটনটা একটা আসল লিংক, নতুন ট্যাবে Stripe-এর OAuth খোলে, `window.open` ছাড়া (আগের অডিট I2)। প্যানেল তারপর `GET /api/site/payments/gateways` poll করে, connect হলে দেখায়।
3. [`src/services/paymentsService.ts`](../../src/services/paymentsService.ts): Stripe-এর secret পাঠানোর পথ বাদ। নতুন `stripeConnectUrl`, `disconnectStripe`।
4. পুরোনো secret key দেওয়া ক্রিয়েটর: Payments-এ একটা Banner, "Reconnect Stripe to keep payments secure", "Connect Stripe" বাটন সহ। connect হলে ব্যাকএন্ড পুরোনো `secretsEncrypted` মুছে দেবে।
5. "Test mode" আর "Live mode" দুটোই রাখুন। Connect-এ test আর live আলাদা `acct_…` না, একই অ্যাকাউন্ট দুই মোডে, তাই ব্যাকএন্ডের `mode` কলাম আগের মতোই কাজ করবে।

### ৫.গ. Razorpay

1. ধাপ ০.১ক-এ partner OAuth পাওয়া গেলে Stripe-এর মতোই: "Connect Razorpay" বাটন, `state` টোকেন, callback, টোকেন encrypt করে রাখা।
   - Razorpay-র OAuth access token দেয়, secret key না। ব্যাকএন্ড টোকেন রাখবে আর মেয়াদ শেষে refresh করবে।
2. না পাওয়া গেলে: key secret থাকবে। শুধু webhook secret সরান, ব্যাকএন্ড Razorpay-র API দিয়ে নিজে webhook আর secret বানাবে।

### ৫.ঘ. Lemon Squeezy

1. API key থাকবে, ঘরের পাশে এক লাইনের ব্যাখ্যা: কেন লাগে, কীভাবে encrypt করা থাকে।
2. Signing secret-এর ঘর সরান। connect-এর সময় ব্যাকএন্ড Lemon Squeezy-র API (`POST /v1/webhooks`) দিয়ে নিজেই webhook বানাবে, নিজের তৈরি র‍্যান্ডম secret দিয়ে, আর সেটা encrypt করে রাখবে।

### ৫.ঙ. Sign in providers (Google, GitHub, Apple, Discord)

1. ব্যাকএন্ড: `.env`-এ MemberFrame-এর নিজের app-এর client id ও secret, প্রতিটা provider-এর জন্য।
   - OAuth রুট: সাইটের নিজের app না থাকলে আমাদের app ব্যবহার করবে।
   - redirect ঠিকানা আমাদের একটাই: `https://app.framefic.com/memberframe/api/member/oauth/<provider>/callback`। সাইট চেনা যাবে `state` থেকে।
2. প্লাগইন: Settings-এ প্রতিটা provider-এর পাশে শুধু একটা toggle (চালু বা বন্ধ)। "Use my own OAuth app" একটা Advanced অংশে থাকবে, ভেতরে আজকের client id ও secret ঘর।
3. `integrationSecrets.ts`-এর `SECRET_FIELDS` একই থাকবে, শুধু Advanced বেছে নিলে ব্যবহার হবে।

### ৫.চ. নিজের SMTP

1. Settings, Email: নিজের SMTP-র ঘরগুলো একটা Advanced অংশে নিন, এক লাইনের ব্যাখ্যা সহ। ডিফল্ট আমাদের mailer, আজকের মতোই।

### ৫.ছ. টেস্ট

- **Stripe Connect**:
  - `state` টোকেন এক বারের, মেয়াদ আছে, অন্য সাইটের টোকেনে কাজ করে না।
  - callback-এ `acct_…` সেভ হয়, কোনো secret না।
  - connected অ্যাকাউন্টের কল `stripeAccount` হেডার সহ যায়।
  - পুরোনো secret key রো আগের মতোই চার্জ করে।
  - connect হলে পুরোনো secret মুছে যায়।
- **Webhook**: Connect ইভেন্ট সঠিক সাইটে যায়, ভুল signature বাতিল হয়।
- **OAuth**:
  - নিজের app না থাকলে আমাদের app ব্যবহার হয়।
  - Advanced-এ নিজের app দিলে সেটা ব্যবহার হয়।
- **প্লাগইন**:
  - Stripe-এর ফর্মে কোনো password ঘর নেই।
  - Disconnect-এ ConfirmDialog আসে।

### ৫.জ. যাচাই

- **স্ক্যান**: প্লাগইনের বিল্ডে Stripe-এর `secretKey` বা `webhookSecret` ঘরের লেবেল ("Secret key", "Webhook secret") নেই। sign in providers-এর client secret শুধু Advanced অংশে।
- **Framer-এ হাতে (Stripe test mode)**:
  - নতুন সাইটে "Connect Stripe" করুন, তারপর লাইভ সাইটে মেম্বার হিসেবে কিনুন। টাকা ক্রিয়েটরের Stripe অ্যাকাউন্টে আসে।
  - subscription বাতিল, refund, মেম্বারের billing portal।
  - পুরোনো secret key দেওয়া সাইট: আগের মতো চলে, Banner দেখায়, reconnect করলে চলতেই থাকে।
  - Disconnect Stripe: ConfirmDialog, তারপর মেম্বার পেমেন্ট বন্ধ, পরিষ্কার বার্তা সহ।
  - নিজের app ছাড়া Google দিয়ে মেম্বার sign in। Advanced-এ নিজের app দিয়েও।
  - Lemon Squeezy connect: শুধু API key দিলেই webhook নিজে তৈরি হয়, পেমেন্ট আসে।
- **ডেটাবেস**: নতুন Stripe রো-তে `secrets_encrypted` খালি, `public_id`-এ `acct_…`।

**শেষ হয়েছে যখন**: সব পাস, আগের ক্রিয়েটরদের কোনো পেমেন্ট বন্ধ হয়নি, আর Stripe ও sign in-এর ডিফল্ট পথে কোনো secret নেওয়া হয় না।

---

## ধাপ ৬: ডকুমেন্ট ও নিয়ম আপডেট (আধা দিন)

| # | ফাইল | কী বদলাবে |
| :--- | :--- | :--- |
| ৬.১ | [`../framer-data-justification.md`](../framer-data-justification.md) | প্রতিটা রিকোয়েস্ট: কী যায়, কেন, কী সেভ হয়। স্পষ্ট লেখা: analytics নেই, Framer user id নেই, প্রজেক্ট id সার্ভারে যায় না, Stripe প্লাগইনে নেই। নতুন "Credentials" অংশ: কোন secret এখনো নেওয়া হয় আর কেন, AES-256-GCM, প্যানেলে ফেরত আসে না, কোনগুলো OAuth দিয়ে সরানো হয়েছে। সমস্যা ১১-এর জন্য site settings document-এর প্রতিটা ঘর কেন সার্ভারে লাগে, আর Protected Download-এ শুধু ঠিকানা যায় |
| ৬.২ | [`../framer-review-instructions.md`](../framer-review-instructions.md) | নতুন পেমেন্ট ফ্লোর ধাপ (নতুন ট্যাব) |
| ৬.৩ | [`../memberframe-complete-prd.md`](../memberframe-complete-prd.md) | F20 বাতিল বা "ক্রিয়েটরের চালু করা opt-in, ইমেইল আর user id ছাড়া" হিসেবে নতুন করে লেখা। অংশ ১৭-এ নতুন conflict রো |
| ৬.৪ | `.agents/rules/framer-sdd-standards.md` অংশ ১২ | telemetry বাধ্যতামূলক নিয়মটা বদলান, Framer-এর নিয়মের সাথে মিলিয়ে |
| ৬.৫ | `.agents/skills/framer-plugin-suite/references/pro-lock-engine.md`, `telemetry-and-tracking.md`, `profile-and-subscription-ui.md` | নতুন licensing আর পেমেন্টের ধরন, যাতে নতুন প্লাগইন পুরোনো ভুল কপি না করে |
| ৬.৬ | [`../IMPLEMENTATION-STATUS.md`](../IMPLEMENTATION-STATUS.md) | প্রতিটা ধাপের রো, আর ৪.৮ ও ৪.৯ (F20) এর নতুন স্ট্যাটাস |
| ৬.৭ | [`35-marketplace-review-report.md`](35-marketplace-review-report.md) | স্ট্যাটাস "সমাধান সম্পন্ন", আর কোন সিদ্ধান্ত নেওয়া হলো |

---

## ধাপ ৭: চূড়ান্ত যাচাই (এক দিন)

### ৭.১. বিল্ড স্ক্যান

`memberframe/` ফোল্ডারে, `npm run build` এর পরে:

```bash
# প্রতিটা লাইনের ফলাফল শূন্য হতে হবে
grep -rlE "127\.0\.0\.1|localhost" dist --include=*.js --include=*.mjs
grep -rl "process\.env" dist --include=*.js --include=*.mjs
grep -rl "js\.stripe\.com" dist --include=*.js --include=*.mjs
grep -rl "getCurrentUser" dist --include=*.js --include=*.mjs
grep -rl "ngrok" dist --include=*.js --include=*.mjs
grep -rlE "framerUserId|creatorEmail" dist --include=*.js --include=*.mjs
grep -l "/api/license" src/canvas-components/*.tsx

# শুধু একটা ঠিকানা থাকবে: https://app.framefic.com/memberframe
grep -rhoE "https?://[a-z0-9.-]+\.(com|app|io)[a-z0-9/._-]*" dist --include=*.js --include=*.mjs | sort -u
```

শেষ কমান্ডের তালিকায় শুধু আমাদের ব্যাকএন্ড, Framer-এর নিজের ঠিকানা আর ডকুমেন্টের লিংক থাকতে পারে। অন্য কিছু পেলে খুঁজে দেখুন।

### ৭.২. সব গেট

প্লাগইন আর ব্যাকএন্ড দুটোতেই অংশ ০-এর গেট।

### ৭.৩. Framer-এ পুরো ফ্লো (মানুষ করবে)

| # | ফ্লো | ঠিক আছে যদি |
| :--- | :--- | :--- |
| ১ | নতুন প্রজেক্ট, sign up | hosted পেজ খোলে, প্লাগইন connect হয় |
| ২ | ট্রায়াল শুরু | countdown বার, watermark |
| ৩ | Builder: ৫টা পেজ তৈরি, প্রতিটা কম্পোনেন্ট যোগ | প্রথম ক্লিকেই, কনসোলে ত্রুটি নেই |
| ৪ | Manage: tier, মেম্বার | আগের মতো |
| ৫ | Settings: page lock, section lock, gateway, email | আগের মতো |
| ৬ | Reports | আগের মতো |
| ৭ | প্ল্যান কেনা (প্রতিটা প্ল্যান, কুপন সহ) | success modal, watermark চলে যায় |
| ৮ | upgrade, cancel, resume | আগের মতো |
| ৯ | publish, লাইভ সাইটে মেম্বার sign up, sign in, পেমেন্ট, বুকমার্ক, ডাউনলোড | আগের মতো |
| ১০ | লাইভ সাইটে নেটওয়ার্ক ট্যাব | পেজ খুললে shield ছাড়া কোনো MemberFrame রিকোয়েস্ট নেই |
| ১১ | প্রজেক্ট duplicate | "Link This Project" |
| ১২ | sign out | ক্যানভাসে lock |
| ১৩ | license মেয়াদোত্তীর্ণ (ডেটাবেসে) | লাইভ সাইটে মেম্বার কাজে lock |
| ১৪ | Settings: Connect Stripe, তারপর লাইভ সাইটে মেম্বারের পেমেন্ট | কোনো secret paste ছাড়া, টাকা ক্রিয়েটরের Stripe-এ |
| ১৫ | পুরোনো secret key দেওয়া সাইট | আগের মতো চলে, reconnect Banner দেখায় |
| ১৬ | নিজের app ছাড়া Google দিয়ে মেম্বার sign in | আমাদের app দিয়ে কাজ করে |
| ১৭ | Lemon Squeezy connect | শুধু API key, webhook নিজে তৈরি হয় |

**শেষ হয়েছে যখন**: স্ক্যান পরিষ্কার, সব গেট পাস, ১৭টা ফ্লো ঠিক।

---

## ধাপ ৮: জমা দেওয়া ও Framer-কে উত্তর (আধা দিন)

1. ব্যাকএন্ড আগে deploy করুন। পুরোনো প্লাগইন ভার্শনের সাথে সামঞ্জস্য ধাপ ২.ঘ আর ৩.ক-তে রাখা আছে।
2. প্যাকেজিংয়ের নিয়ম মেনে (PRD অংশ ১৬, টাস্ক ৮.৮) প্লাগইনের নতুন ভার্শন বানান। Framer-এর নির্দেশমতো **পুরোনোটা মুছবেন না, নতুন ভার্শন publish করুন।**
3. MemberFrame আগে বাতিল হয়ে থাকলে Framer-এর ইমেইলে উত্তর দিন। ইংরেজি খসড়া:

```
Hi Andreu,

Thanks for the review. We have published a new version that addresses these points:

1. Data: the plugin no longer reads or sends the Framer user, the project id, or the
   project name. It sends only the published domains, which the backend needs as the
   allowlist for the creator's own member API. Nothing is sent before the creator signs
   in, there is no analytics, and the backend address is fixed at build time with no
   localhost or runtime switching.
2. Stripe: the plugin no longer loads Stripe.js. Payment opens on our hosted checkout
   page in the browser, and the plugin only waits for the result.
3. Credentials: creators no longer paste a Stripe secret key or webhook secret. They
   connect Stripe through Stripe Connect OAuth, and we store only the connected account
   id. Social sign in works with no creator secret by default; a creator's own OAuth app
   is an optional advanced setting. The secrets that remain (an optional own OAuth app,
   an optional own SMTP server, a Lemon Squeezy API key) are required by those
   providers, are encrypted at rest with AES-256-GCM, and are never returned to the
   plugin.

Membership requests from the published site (member sign up, sign in, gated content,
member payments) remain, because they are the plugin's core function and need a
server: Framer sites have none. The feature settings the plugin saves (page and
section locks, tiers, profile fields) are what the server uses to decide access.
All of this is listed in the data justification we attached.

Best regards,
Framefic
```

---

## ধাপ ৯: অন্য প্লাগইনে বসানো (প্রতি প্লাগইনে এক থেকে দুই দিন)

1. ধাপ ১ থেকে ৪-এর billing অংশ একটা শেয়ার করা মডিউলে আনুন: hosted checkout, license-এর ধরন, connection store, ঠিকানার config।
2. ধাপ ৫-এর নীতি প্রতিটা প্লাগইনে প্রয়োগ করুন: যেখানে ক্রিয়েটরের API key বা secret নেওয়া হয়, সেখানে OAuth, সরাসরি ব্রাউজার থেকে integration, বা ঐচ্ছিক Advanced। Formfic-এ ফর্মের ডেটা আমাদের সার্ভার দিয়ে না পাঠিয়ে সরাসরি ক্রিয়েটরের নিজের সার্ভিসে পাঠাতে হবে।
3. ক্রম: যেগুলো বাতিল হয়েছে আগে (Auto Table of Contents, Chat Bubbles, Formfic), তারপর BEAF আর বাকিগুলো।
4. প্রতিটা প্লাগইনে ধাপ ৭.১-এর স্ক্যান চালান, তারপর জমা দিন।
5. কোম্পানির billing নিয়ম (memory আর `.agents/` এর রেফারেন্স) নতুন ধরনে আপডেট করুন, যাতে ভবিষ্যতের প্লাগইন পুরোনো ধরন কপি না করে।

---

## অগ্রগতির টেবিল

| ধাপ | সমস্যা | আনুমানিক সময় | দায়িত্বে | স্ট্যাটাস | কমিট |
| :--- | :--- | :--- | :--- | :--- | :--- |
| ০. প্রস্তুতি | সব | আধা দিন | | শুরু হয়নি | |
| ১. স্থির ঠিকানা | ২, ৮ | আধা দিন | | শুরু হয়নি | |
| ২. তথ্য কমানো | ৩, ৪, ৬, ৯ | দেড় থেকে দুই দিন | | শুরু হয়নি | |
| ৩. `/api/license` বাদ | ৫ | দেড় দিন | | শুরু হয়নি | |
| ৪. hosted checkout | ১ | দুই থেকে তিন দিন | | শুরু হয়নি | |
| ৫. credentials কমানো | ১০ | চার থেকে পাঁচ দিন (Stripe ও Google অনুমোদনের অপেক্ষা বাদে) | | শুরু হয়নি | |
| ৬. ডকুমেন্ট ও নিয়ম | ৭, ১১, F20 | আধা দিন | | শুরু হয়নি | |
| ৭. চূড়ান্ত যাচাই | সব | এক দিন | | শুরু হয়নি | |
| ৮. জমা ও উত্তর | | আধা দিন | | শুরু হয়নি | |
| ৯. অন্য প্লাগইন | | প্রতি প্লাগইনে এক থেকে দুই দিন | | শুরু হয়নি | |

**মোট (MemberFrame)**: আনুমানিক ১১ থেকে ১৪ কর্মদিবস। Stripe Connect, Razorpay partner আর Google ও Apple app যাচাইয়ের অনুমোদনে বাড়তি কয়েক দিন লাগতে পারে, তাই সেগুলোর আবেদন ধাপ ০.১ক-তেই করুন।
