# Feature Development Documentation Index

One technical document per feature. Under `.agent/rules/feature-development-docs.md`, a feature's document is created or updated in the same change as its code.

Status words are defined in [../development-plan.md](../development-plan.md), section 4.1. "Prototype" means the UI exists and the data is simulated. Live progress is in [../../work-precess/progress-tracker.md](../../work-precess/progress-tracker.md).

---

## Feature Documentation Roster

| No. | Feature | Priority | Feature status | Document |
| :--- | :--- | :--- | :--- | :--- |
| 00 | Setup, Standards and Workspace | Foundation | Done | [00-workspace-setup-and-standards.md](00-workspace-setup-and-standards.md) |
| 00 | Plugin Shell and Window Geometry | P0 | Done | [00-plugin-shell.md](00-plugin-shell.md) |
| 01 | Canvas Components Suite (overview of 8) | P0 and P1 | Prototype | [01-canvas-components-suite.md](01-canvas-components-suite.md) |
| 01 | `MemberGate` | P0 | Prototype | [01-member-gate.md](01-member-gate.md) |
| 02 | In-Plugin Cockpit (Members, Tiers, Settings) | P0 | Prototype | [02-in-plugin-cockpit.md](02-in-plugin-cockpit.md) |
| 03 | Payments (Stripe, Lemon Squeezy, Razorpay) | P0 and P2 | Not started | Not written. File name: `03-tri-gateway-payments.md` |
| 04 | Live Preview Studio | P1 | Not started | Not written. File name: `04-live-preview-studio.md` |
| 05 | `MemberAuth` | P0 | Prototype | Not written. File name: `05-member-auth.md` |
| 06 | `MemberDashboard` | P0 | Prototype | Not written. File name: `06-member-dashboard.md` |
| 07 | `MeteredPaywall` | P1 | Prototype | Not written. File name: `07-metered-paywall.md` |
| 08 | SEO Paywall Schema | P1 | Not started | Not written. File name: `08-seo-paywall-schema.md` |
| 09 | `CMSGatedTemplate` | P1 | Prototype | Not written. File name: `09-cms-gated-template.md` |
| 10 | `ProtectedDownload` | P1 | Prototype | Not written. File name: `10-protected-download.md` |
| 11 | Creator LMS Suite | P1 | Prototype (1 of 3 components) | Not written. File name: `11-creator-lms-suite.md` |
| 12 | `TeamManagement` | P2 | Not started | Not written. File name: `12-b2b-team-management.md` |
| 13 | `DonationSlider` | P2 | Prototype | Not written. File name: `13-donation-slider.md` |
| 14 | Bookmarks | P2 | Not started | Not written. File name: `14-member-bookmarks.md` |
| 15 | `MemberDirectory` | P2 | Not started | Not written. File name: `15-member-directory.md` |
| 16 | Access Rules (Access tab, site script) | Core | Not started | Not written. File name: `16-access-rules.md` |
| 17 | `PricingTable` | Core | Not started | Not written. File name: `17-pricing-table.md` |
| 18 | Backend Connection (`apiClient`, site keys) | Core | Not started | Not written. File name: `18-backend-connection.md` |

Under plan version 2, the in-scope features are 00, 01 (`MemberGate`), 02, 05, 16, 17, and 18. Numbers 03, 04, and 06 to 15 are parked. See [../development-plan.md](../development-plan.md), section 1.

The numbers `00` and `01` are each used twice. They are kept because other documents link to these file names. New documents use the reserved file names above. Do not reuse a number.
