# Feature: [Feature Name in Title Case]

Technical development specification, user flow, architectural wiring, and testing checklist for [Feature Name].

> Copy this file to `NN-slug.md` matching the row in [`README.md`](README.md). Structure is fixed by
> [`.agents/rules/feature-development-docs.md`](../../.agents/rules/feature-development-docs.md) section 2. Do not drop sections.
> Delete this quote block once you start writing.

**PRD reference**: [F##](../memberframe-complete-prd.md) section 8
**Status**: planned | in progress | done
**Tasks**: #.# (see [`../IMPLEMENTATION-STATUS.md`](../IMPLEMENTATION-STATUS.md))

---

## 1. Overview and Problem Solved

- **Feature Name**: [Name]
- **Target Audience**: [Framer Creator / Site Member / Visitor]
- **Value Proposition**: Plain-language description of why this feature exists and how it improves on competitor limitations.
- **Priority Tier**: [P0: Core MVP / P1: Creator Enhancement / P2: Global Expansion / P3: Later]

---

## 2. User Flows

### 2.1. In-Plugin Configuration Flow (Framer Designer)

Step-by-step description of how the creator configures this feature in the 360x640 plugin window or sidebar properties.

### 2.2. Visitor / Member Runtime Flow

Step-by-step description of what a site visitor experiences on the published Framer site.

---

## 3. Architecture and File Inventory

- **Plugin UI Components**: paths inside `src/components/`
- **Canvas Code Components**: paths inside `src/canvas-components/`
- **Backend API Endpoints**: REST or webhook routes consumed. Backend is out-of-repo, see PRD section 10
- **Styling**: modular CSS files and design tokens used (strict zero inline CSS)

---

## 4. Framer Property Controls Specification

If this feature deploys or interacts with a canvas component, list all Framer Property Controls (`ControlType.*`):

| Control Title | Control Type | Default Value | Description |
| :--- | :--- | :--- | :--- |
| | | | |

---

## 5. Data Contracts and Core User Schema

TypeScript interfaces for all state objects, local storage payloads, and API requests:

```typescript
// Insert TypeScript interface
```

---

## 6. Verification and Testing Checklist

- [ ] Light mode and dark mode color contrast verified with `data-framer-theme`.
- [ ] Zero inline CSS compliance verified (`npm run lint:css`).
- [ ] Framer Property Controls render cleanly in canvas sidebar.
- [ ] Backend API endpoints return proper status codes and handle network errors gracefully.
- [ ] All action buttons utilize `.primary-cta` double-gradient standard, exactly one per view.
- [ ] Strictly Lucide or Framer SVG icons used (zero unicode emojis).
- [ ] Acceptance criteria from PRD section 8 F## all verified.
- [ ] `tsc --noEmit` and `npm run build` pass.

---

## 7. Verified By Whom

The agent cannot see rendered pixels in the Framer desktop app, and cannot exercise live payment gateways.
Record who checked what, so an unticked box is never mistaken for a passed one.

| Check | Verified by | Date | Evidence |
| :--- | :--- | :--- | :--- |
| Renders correctly in Framer | | | |
| Gateway sandbox transaction | | | |
| Automated gates | agent | | command output |
