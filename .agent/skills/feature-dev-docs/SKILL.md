---
name: feature-dev-docs
description: Authoritative workflow for generating and maintaining dedicated feature development documentation files in docs/development-docs/<feature-name>.md whenever any feature is developed, modified, or planned.
---

# Feature Development Documentation Skill

This skill enforces and automates the creation of comprehensive feature documentation within `docs/development-docs/` whenever any feature is developed or refactored for MemberFrame.

---

## 1. When to Use This Skill

Activate this skill whenever:
1. A new feature or canvas component is being implemented.
2. An existing feature is being refactored, extended, or patched.
3. The user requests progress, specifications, or verification for a specific feature.

---

## 2. Directory Structure and File Naming

All feature documentation must be placed in:
`docs/development-docs/`

Files must be prefixed with a 2-digit sequence indicating priority order, followed by the feature kebab-case name:
- `01-member-gate.md`
- `02-in-plugin-cockpit.md`
- `03-tri-gateway-payments.md`
- `04-live-preview-studio.md`
- `05-member-auth.md`
- `06-member-dashboard.md`
- `07-metered-paywall.md`
- `08-seo-paywall-schema.md`
- `09-cms-gated-template.md`
- `10-protected-download.md`
- `11-creator-lms-suite.md`
- `12-b2b-team-management.md`
- `13-donation-slider.md`
- `14-member-bookmarks.md`
- `15-member-directory.md`

---

## 3. Mandatory Document Structure

Every document in `docs/development-docs/` must contain:

1. **Title and Executive Summary**: Feature name in Title Case, target audience, and primary benefit.
2. **User Flows**:
   - Creator in-plugin configuration flow (360x640 panel)
   - End-visitor runtime flow on published Framer canvas
3. **Architecture and File Inventory**:
   - Plugin UI files (`src/components/...`)
   - Canvas Code Component files (`src/canvas-components/...`)
   - Backend API endpoints and webhook topics
   - Modular CSS stylesheets (Zero Inline CSS compliance)
4. **Framer Property Controls Specification**:
   - Table of all `ControlType` attributes (`String`, `Enum`, `Number`, `Boolean`, `ComponentInstance`, `Color`, etc.).
5. **Data Contracts and TypeScript Interfaces**:
   - Core user models, payload schemas, and session objects.
6. **Verification and Testing Checklist**:
   - Light/Dark theme check (`data-framer-theme`)
   - Zero inline CSS check
   - SDK mocks and edge case test notes.

---

## 4. Documentation Quality Guidelines

- Use Title Case for headings.
- Never use em-dashes (—) or en-dashes (–). Use a period, colon, semicolon, or parentheses instead.
- Use friendly, professional, and benefit-focused language.
- Keep documentation up to date with code in the same commit or step.
