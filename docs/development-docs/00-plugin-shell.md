# Feature: Plugin Shell and Window Geometry

Technical development specification, user flow, architectural wiring, and testing checklist for the MemberFrame Plugin Shell.

---

## 1. Overview and Problem Solved
- **Feature Name**: Plugin Shell and Window Geometry
- **Target Audience**: Framer Designers and Site Creators
- **Value Proposition**: Establishes standard 360x640 Framer plugin window geometry, standard 4-part shell layout (Header, Tab Bar, Content Area, Footer), seamless Light/Dark theme synchronization with Framer's workspace, and the mandatory `.primary-cta` double-gradient button standard.
- **Priority Tier**: P0: Core MVP Foundation

---

## 2. User Flows
### 2.1. In-Plugin Configuration Flow (Framer Designer)
1. The designer launches MemberFrame from the Framer plugins menu.
2. The plugin initializes at 360x640 geometry in the top-right corner.
3. The designer can click the collapse toggle in the header to shrink the panel to 48px height, or click it again to expand back to 640px.
4. The designer switches between the five navigation tabs: Home, Builder, Members, Tiers, and Settings.
5. The designer clicks the close button (`X`) to cleanly exit the plugin via `framer.closePlugin()`.

### 2.2. Visitor / Member Runtime Flow
Not applicable directly on the canvas; this component governs the creator cockpit experience inside Framer.

---

## 3. Architecture and File Inventory
- **Plugin UI Shell Component**: `src/components/shell/PluginShell.tsx`
- **Shell Stylesheet**: `src/components/shell/PluginShell.css`
- **Root Entry**: `src/App.tsx` and `src/App.css`
- **Design Tokens**: `src/styles/design-tokens.css`
- **Reusable Form & Button Components**: `src/styles/components.css`

---

## 4. Framer Property Controls Specification
Not applicable (Plugin UI Panel component).

---

## 5. Data Contracts and Core User Schema
```typescript
export type NavTabId = "home" | "builder" | "members" | "tiers" | "settings";

export interface PluginShellProps {
  activeTab: NavTabId;
  onSelectTab: (tab: NavTabId) => void;
  children: React.ReactNode;
}
```

---

## 6. Verification and Testing Checklist
- [x] Window initializes at 360x640 via `framer.showUI`.
- [x] Collapse toggle shrinks window to 48px and expands back to 640px.
- [x] Light mode and dark mode color contrast verified with `data-framer-theme`.
- [x] Zero inline CSS compliance verified (`node .agent/scripts/lint-zero-inline-css.js`).
- [x] All primary action buttons implement `.primary-cta` double-gradient border standard.
- [x] Strictly Lucide React and Framer SVG icons used (zero unicode emojis).
