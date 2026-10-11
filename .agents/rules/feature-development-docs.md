---
description: Mandatory rule for automatic feature development documentation. Whenever a feature is developed, modified, or planned, a dedicated technical document must be created or updated in docs/development-docs/<feature-name>.md.
globs: ["**/*"]
alwaysApply: true
---

# Feature Development Documentation Rule

This rule enforces continuous, structured documentation generation during the engineering lifecycle of MemberFrame.

---

## 1. Mandatory Trigger: Automatic Feature Documentation

Whenever the AI agent develops, refactors, or finishes any feature or component in this workspace:

1. **Dedicated Document Creation**:
   The agent **MUST IMMEDIATELY CREATE OR UPDATE** a dedicated documentation markdown file inside:
   `docs/development-docs/<feature-slug>.md`
   *(Example: `docs/development-docs/01-member-gate.md`, `docs/development-docs/02-in-plugin-cockpit.md`, `docs/development-docs/03-member-auth.md`)*.

2. **No Exceptions**:
   Never build a feature without producing its corresponding development documentation file. Documentation must ship in the exact same step as code changes.

---

## 2. Standard Feature Development Document Template

Every file inside `docs/development-docs/<feature-slug>.md` must adhere to this standardized structure:

```markdown
# Feature: [Feature Name in Title Case]

Technical development specification, user flow, architectural wiring, and testing checklist for [Feature Name].

---

## 1. Overview and Problem Solved
- **Feature Name**: [Name]
- **Target Audience**: [Framer Creator / Site Member / Visitor]
- **Value Proposition**: Plain-language description of why this feature exists and how it improves on competitor limitations.
- **Priority Tier**: [P0: Core MVP / P1: Creator Enhancement / P2: Global Expansion]

---

## 2. User Flows
### 2.1. In-Plugin Configuration Flow (Framer Designer)
Step-by-step description of how the creator configures this feature in the 360x640 plugin window or sidebar properties.

### 2.2. Visitor / Member Runtime Flow
Step-by-step description of what a site visitor experiences on the published Framer site.

---

## 3. Architecture and File Inventory
- **Plugin UI Components**: Paths to React files inside `src/components/`
- **Canvas Code Components**: Paths to Framer canvas files inside `src/canvas-components/`
- **Backend API Endpoints**: REST or webhook routes consumed
- **Styling**: Modular CSS files and design tokens used (Strict Zero Inline CSS)

---

## 4. Framer Property Controls Specification
If this feature deploys or interacts with a canvas component, list all Framer Property Controls (`ControlType.*`):
| Control Title | Control Type | Default Value | Description |
| :--- | :--- | :--- | :--- |
| ... | ... | ... | ... |

---

## 5. Data Contracts and Core User Schema
TypeScript interfaces for all state objects, local storage payloads, and API requests:
```typescript
// Insert TypeScript interface
```

---

## 6. Verification and Testing Checklist
- [ ] Light mode and dark mode color contrast verified with `data-framer-theme`.
- [ ] Zero inline CSS compliance verified (`node .agent/scripts/lint-zero-inline-css.js`).
- [ ] Framer Property Controls render cleanly in canvas sidebar.
- [ ] Backend API endpoints return proper status codes and handle network errors gracefully.
- [ ] All action buttons utilize `.primary-cta` double-gradient standard.
- [ ] Strictly Lucide or Framer SVG icons used (zero unicode emojis).
```

---

## 3. Persistent Scope Across All Conversations

This rule applies universally across all conversations, feature additions, and refactoring tasks. When a user requests work on any feature, the agent must check `docs/development-docs/` first, update the existing file, or create a new numbered file if none exists.
