# Technical Specification: Part 1 — Beginner-to-Developer Setup and Workspace Orientation

* **Module:** `00-workspace-setup-and-standards`
* **Status:** Implemented and Verified
* **Target Environment:** Framer Canvas Plugin & Standalone Browser Preview
* **Geometry:** 360x640 (Floating Top-Right)
* **Design Standard:** Framer framefic Unified Design System v0.3.7

---

## 1. Executive Summary

This document establishes the developer environment, directory structure, Framer manifest standard, design system token bindings, and core TypeScript contracts for **MemberFrame**. It provides the authoritative foundation for all subsequent Phase 1, Phase 2, and Phase 3 features.

---

## 2. Environment Prerequisites

Before developing or running MemberFrame, ensure the following tools are installed:

| Tool | Version Requirement | Purpose |
| :--- | :--- | :--- |
| **Node.js** | `>= 18.0.0` (LTS recommended) | JavaScript runtime |
| **npm** | `>= 9.0.0` | Package management and lifecycle scripts |
| **Framer** | Web or Desktop App | Host platform for plugin execution |
| **Git** | `>= 2.30.0` | Version control |

---

## 3. Plugin Manifest Configuration (`framer.json`)

> [!IMPORTANT]
> **Framer Manifest 6-Character ID Rule:**
> Framer's plugin manifest validation strictly enforces that the `"id"` property in [framer.json](file:///d:/project/Framer%20APP/memberframe/framer.json) must be **exactly 6 characters long** (e.g., `"memfrm"`). Setting IDs longer or shorter will cause Framer Web to reject the plugin with:
> `Failed to load framer.json "id" property must be 6 characters long.`

### Active Manifest (`framer.json`)
```json
{
  "id": "memfrm",
  "name": "MemberFrame",
  "version": "1.0.0",
  "description": "The ultimate native membership and recurring monetization suite for Framer.",
  "icon": "icon.png",
  "main": "dist/index.html",
  "modes": ["canvas"],
  "permissions": [
    "createCodeFile",
    "CodeFile.setFileContent",
    "CodeFile.remove",
    "addComponentInstance",
    "setParent",
    "Node.remove",
    "setPluginData",
    "getPluginData"
  ]
}
```

---

## 4. Window Geometry and Theme Synchronization

### Window Initialization
The plugin window is initialized to **360px width by 640px height** anchored at the top-right corner of the Framer canvas:

```typescript
import { framer } from "framer-plugin";

framer.showUI({
  position: "top right",
  width: 360,
  height: 640,
});
```

When collapsed, the height collapses to **48px** (header bar only), and restores to **640px** upon expansion.

### Dual-Theme Synchronization (`useFramerTheme`)
The plugin automatically synchronizes its color tokens with the active Framer workspace theme or OS preference:
- Sets `data-framer-theme="dark"` or `"light"` on `document.body`.
- Sets `data-user-theme="dark"` or `"light"` on `document.documentElement`.
- Provides manual override toggles within the Settings tab.

---

## 5. Architectural Directory Layout

```
d:/project/Framer APP/memberframe/
├── .agent/                                          # Agent skills, rules, and linters
│   ├── rules/
│   │   ├── framer-sdd-standards.md                 # SDD and design standards
│   │   └── feature-development-docs.md             # Automatic technical docs rule
│   ├── scripts/
│   │   └── lint-zero-inline-css.js                 # Zero Inline CSS automated linter
│   └── skills/                                      # Domain skill definitions
├── .github/agents/                                  # 9 Specialized Sub-Agents
├── docs/                                            # Product and market documentation
│   ├── list-the-features-of-the-competitors.md     # Competitive research
│   ├── missing-scopes-we-can-implement.md           # Opportunity matrix
│   ├── final-feature-specifications.md             # 15-Feature master specification
│   ├── work-process.md                             # Work process overview pointer
│   └── development-docs/                           # Dedicated technical feature docs
│       ├── 00-workspace-setup-and-standards.md     # This document
│       ├── 00-plugin-shell.md                      # Plugin shell and layout spec
│       ├── 02-in-plugin-cockpit.md                 # In-plugin cockpit tab spec
│       └── ...
├── work-precess/                                    # Master execution roadmap
│   └── work-process.md                             # End-to-end beginner-to-advanced guide
├── src/                                             # Plugin source code
│   ├── App.tsx                                     # Plugin entry point & geometry
│   ├── App.css                                     # Global reset & layout styles
│   ├── main.tsx                                    # React DOM mounting
│   ├── types/                                      # Central TypeScript contracts
│   │   └── index.ts                                # Tier, Member, Gate, Telemetry models
│   ├── hooks/                                      # Custom React hooks
│   │   ├── useFramerTheme.ts                       # Dynamic theme token sync
│   │   ├── usePluginStorage.ts                     # Persistent plugin storage
│   │   └── useSiteTelemetry.ts                     # Framer site info extraction
│   ├── services/                                   # Platform integrations
│   │   ├── storageService.ts                       # Framer get/setPluginData wrapper
│   │   └── framerCanvasService.ts                  # Canvas operations & CodeFiles
│   ├── components/                                 # UI presentation layer
│   │   ├── shell/                                  # PluginShell (Header, Tabs, Footer)
│   │   ├── tabs/                                   # Cockpit tabs (Home, Builder, etc.)
│   │   ├── preview/                                # Live Preview Studio & Simulator
│   │   └── ui/                                     # Reusable UI kit primitives
│   ├── canvas-components/                          # Code files for Framer canvas
│   │   └── templates/                              # Master external CSS strings
│   └── styles/                                     # Design tokens and form controls
│       ├── design-tokens.css                       # Company color and typography tokens
│       └── components.css                          # .primary-cta and form components
├── framer.json                                     # Framer manifest (id: memfrm)
├── package.json                                    # Dependencies and scripts
└── vite.config.ts                                  # Vite + HTTPS + Framer plugin config
```

---

## 6. Design System and Token Governance

1. **Mandatory `.primary-cta` Button Standard:**
   All primary actions use the double-gradient border standard:
   ```css
   .primary-cta {
     background: linear-gradient(var(--secondary-default, #5271ff), var(--secondary-default, #5271ff)) padding-box,
                 linear-gradient(180deg, #708aff 0%, #3358ff 100%) border-box;
     border: 2px solid transparent !important;
     border-radius: var(--radius-md, 8px);
   }
   ```
2. **Strict Zero Inline CSS Rule:**
   Zero `style={{ ... }}` objects in React JSX. All styles are declared in external `.css` files or modular CSS strings. Verified via `npm run lint:css`.
3. **Strict Icon Standard:**
   Exclusively Lucide React (`lucide-react`) SVG icons with `stroke="currentColor"`. Zero Unicode emojis are allowed in UI buttons, headings, or badge labels.

---

## 7. Verification Results

* **Linting:** `node .agent/scripts/lint-zero-inline-css.js src` $\rightarrow$ **23 files scanned, 0 violations**.
* **TypeScript Compilation:** `tsc` passed with 0 errors.
* **Production Build:** `vite build` completed in **2.81s** producing clean `dist/index.html` and assets.
* **Framer Web Connection:** Validated with 6-character `"id": "memfrm"` manifest on HTTPS.
