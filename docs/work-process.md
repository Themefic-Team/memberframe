# MemberFrame Development Work Process

The authoritative, step-by-step master engineering work process guide for building MemberFrame from scratch is maintained at:

👉 **[work-precess/work-process.md](file:///d:/project/Framer%20APP/memberframe/work-precess/work-process.md)**

---

## Quick Navigation

1. **Part 1: Beginner-to-Developer Setup and Workspace Orientation**
   - Node.js and Framer Desktop/Web environment setup
   - Plugin manifest `framer.json` configuration
   - Standard 360x640 window geometry in `framer.showUI`
   - Workspace directory layout and file orientation
   - Design tokens, dual light/dark theme synchronization, and `.primary-cta` standard
2. **Part 2: Feature Prioritization Architecture**
   - Phase 1: Essential Core MVP (P0: Shell, Tiers, Members, MemberGate, MemberAuth, Stripe, MemberDashboard)
   - Phase 2: Creator Enhancements (P1: Metered Paywall, SEO Schema, CMS Gating, LMS Suite, Asset Vault, Live Studio)
   - Phase 3: Scale and Global Reach (P2: Lemon Squeezy, Razorpay/UPI, Team Seats, Donation Slider, Bookmarks, Directory)
3. **Part 3: Step-by-Step Implementation Guide for Each Feature**
   - Detailed file-by-file roadmap and coding sequence for all 17 features
4. **Part 4: Continuous Feature Documentation Workflow**
   - Mandatory rule `.agent/rules/feature-development-docs.md`
   - Dedicated documentation files inside `docs/development-docs/<feature-name>.md`
5. **Part 5: Quality Assurance, Packaging, and Marketplace Release**
   - Zero Inline CSS linting, dual-theme verification, Pro-Lock checks, and `npm run pack`
