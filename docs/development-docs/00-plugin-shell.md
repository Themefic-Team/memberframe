# Feature: Plugin Shell, UI Kit, And Theme Sync

Technical development specification, user flow, architectural wiring, and testing checklist for the plugin shell scaffold.

**PRD reference**: [sections 7.1 to 7.6](../memberframe-complete-prd.md), section 6.3 for the file layout
**Status**: in progress
**Tasks**: 0.2, 0.4, 0.5, 0.6, 0.7, and 0.9 (see [`../IMPLEMENTATION-STATUS.md`](../IMPLEMENTATION-STATUS.md))

> Not an F-numbered feature. The shell is the chrome every feature renders inside, so it has no row in
> [`README.md`](README.md). It gets a doc anyway because
> [`.agents/rules/feature-development-docs.md`](../../.agents/rules/feature-development-docs.md) section 1 triggers on
> any feature **or component**, and this is twenty of them.

---

## 1. Overview and Problem Solved

- **Feature Name**: Plugin Shell, UI Kit, and Theme Sync
- **Target Audience**: Framer Creator
- **Value Proposition**: Every later feature renders inside this frame. Building it once, from the company design system, means no feature has to invent a button, a field row, or a theme listener, and no feature can quietly introduce a hardcoded colour. The four-part shell is mandated rather than chosen: header 48px, tab bar 36px, scroll area, footer 40px.
- **Priority Tier**: P0: Core MVP

---

## 2. User Flows

### 2.1. In-Plugin Configuration Flow (Framer Designer)

1. The creator opens MemberFrame. `App.tsx` calls `framer.showUI({ position: "top right", width: 360, height: 640 })` once.
2. The shell renders. The tab the creator last used is already selected, restored from `localStorage`.
3. Four tabs navigate: Home, Builder, Manage, Settings. Selecting one writes the choice back to storage immediately.
4. Home offers one primary CTA, "Open builder", which moves to the Builder tab. The other three tabs are placeholders with no action, deliberately: a button that goes nowhere is worse than no button.
5. Settings offers a three-way theme control, Auto, Light, Dark. Auto follows the Framer workspace. Light and Dark pin the panel regardless of the workspace, and the choice persists.
6. The header collapse control shrinks the panel to 48px and restores it to 640px.
7. The header close control calls `framer.closePlugin()`.

### 2.2. Visitor / Member Runtime Flow

None. The shell is designer-side only and ships no canvas code.

---

## 3. Architecture and File Inventory

### Plugin UI Components

| Path | Role |
| :--- | :--- |
| `src/App.tsx` | Window geometry, collapse state, tab routing, `ToastProvider` |
| `src/components/shell/PluginShell.tsx` | Composes the four parts |
| `src/components/shell/PluginHeader.tsx` | 48px. Logo, name, collapse, close |
| `src/components/shell/TabBar.tsx` | 36px. Four tabs, spacer, account button |
| `src/components/shell/PluginFooter.tsx` | 40px pinned. Company link, version tag |
| `src/components/tabs/tabs.ts` | Tab registry. Single source of ids, order, titles |
| `src/components/tabs/{Home,Builder,Manage,Settings}Tab.tsx` | Four panels |
| `src/components/ui/*` | Button, IconButton, FieldRow, Toggle, Checkbox, Segmented, Toast, Banner, EmptyState |
| `src/hooks/useFramerTheme.ts` | Theme resolution and the user override |
| `src/hooks/useActiveTab.ts` | Tab persistence |
| `src/config/branding.ts` | Panel name, company name, links, version |
| `src/utils/cn.ts` | Class name joining |

### Canvas Code Components

None.

### Backend API Endpoints

None. The shell makes no network calls. The backend is out-of-repo, PRD section 10.

### Styling

Four CSS files, three of them verbatim slices of `.agents/skills/framer-plugin-suite/references/design-tokens.css`. Each carries a provenance header with the `diff` command that proves it has not drifted.

| File | Reference lines | Holds |
| :--- | :--- | :--- |
| `src/styles/design-tokens.css` | 1 to 256 | Variables only: dark default, light sync, forced dark |
| `src/App.css` | 554 to 578 | Base reset and app container, per PRD section 6.3 |
| `src/styles/components.css` | 258 to 553 and 580 to 2642 | Every component class |
| `src/styles/shell.css` | authored | Shell layout the reference does not cover. Zero hex |

Import order in `main.tsx` is load-bearing and commented there: `framer.css`, then `design-tokens.css`, then `App.css`, then `components.css`, then `shell.css`.

---

## 4. Framer Property Controls Specification

Not applicable. The shell deploys no canvas component.

| Control Title | Control Type | Default Value | Description |
| :--- | :--- | :--- | :--- |
| none | | | |

---

## 5. Data Contracts and Core User Schema

```typescript
// src/components/tabs/tabs.ts
export type TabId = "home" | "builder" | "manage" | "settings";

// src/hooks/useFramerTheme.ts
export type ThemeMode = "light" | "dark";
export type ThemePreference = ThemeMode | "auto";

export interface FramerTheme {
  framerTheme: ThemeMode;      // what the workspace reports
  preference: ThemePreference;  // the creator's override
  theme: ThemeMode;             // what is on screen
  setPreference: (preference: ThemePreference) => void;
}
```

Two `localStorage` keys, both plain strings:

| Key | Values |
| :--- | :--- |
| `memberframe.active-tab` | `home` / `builder` / `manage` / `settings` |
| `memberframe.theme-preference` | `light` / `dark`, absent means auto |

`localStorage` rather than `framer.setPluginData` because the `setPluginData` and `getPluginData` permissions are not declared until PRD task 5.6, and `framer.json` must not claim a permission ahead of the task that needs it. Security rule S2 bars tokens from local storage; neither of these is a credential. Revisit at 5.6 if per-project persistence is wanted.

---

## 6. Verification and Testing Checklist

- [ ] Light mode and dark mode colour contrast verified with `data-framer-theme`. **Needs a human.**
- [x] Zero inline CSS compliance verified. `npm run lint:css`, 28 files, 0 violations.
- [ ] Framer Property Controls render cleanly in canvas sidebar. Not applicable.
- [ ] Backend API endpoints return proper status codes. Not applicable.
- [x] Exactly one `.primary-cta` per view. Only `HomeTab` passes `variant="primary"`, confirmed by grep.
- [x] Strictly Lucide icons, zero unicode emoji. Confirmed by grep over `src/` and `docs/development-docs/`.
- [x] Zero hardcoded hex in authored files. Confirmed by grep, excluding the verbatim copies.
- [x] `tsc --noEmit` and `npm run build` pass.
- [ ] Panel opens in Framer with zero console errors. **Needs a human.**
- [ ] Collapse goes to 48px and restores to 640px in the real panel. **Needs a human.**

---

## 7. Verified By Whom

| Check | Verified by | Date | Evidence |
| :--- | :--- | :--- | :--- |
| Renders correctly in Framer at 360x640 | | | |
| All four tabs navigate, selection survives reopen | | | |
| Theme switch is clean in both directions, AA in both | | | |
| Collapse to 48px and restore to 640px | | | |
| Automated gates | agent | 2026-10-11 | `lint:css` 28 files 0 violations, `tsc --noEmit` clean, `vite build` 1607 modules |
| Dev server serves every new module | agent | 2026-10-11 | `curl -sk --http1.1 https://127.0.0.1:5173/...` returned 200 for each; Vite HMR log shows no transform error |

---

## 8. Decisions And Defects Found While Building

### 8.1. A specificity bug in the reference token CSS, worked around without editing it

The reference expresses the light layer as

```
body[data-framer-theme="light"]:not([data-user-theme="dark"])    specificity (0,2,1)
```

and the forced-dark layer as

```
html[data-user-theme="dark"] body                                specificity (0,1,2)
```

The light selector wins. So with the override attribute on `<html>` alone, "workspace is light, creator picks Dark" resolves to **light**, which is the opposite of what the creator asked for.

The `:not()` tests `data-user-theme` on **body**, while the forced-dark rule reads it on **html**, so the two layers disagree about where the attribute lives. `useFramerTheme` writes it to **both** elements. The `:not()` then fails as intended and the forced-dark layer applies. All four combinations resolve correctly, verified by hand:

| Workspace | Preference | Result |
| :--- | :--- | :--- |
| light | auto | light |
| dark | auto | dark |
| light | dark | dark |
| dark | light | light |

The copied CSS is untouched, so its `diff` against the reference still passes. **This is a defect in the source reference and the workaround lives in the consumer.** If the reference is ever fixed to read `html` consistently, writing both attributes stays harmless.

### 8.2. `.primary-cta` must not be combined with `.btn`

Both set a height, 36px and 30px, at equal specificity, and `.btn` is declared later in `components.css`. Adding both classes silently shrinks the medium CTA. `Button` therefore emits `.primary-cta` alone for the primary variant.

### 8.3. Icon size, 14px in the PRD against 16px in the reference CSS

PRD section 7.2 writes `<ChevronDown size={14} />`; PRD section 7.5 and the reference CSS both say 16px, and `.icon-button svg` sets it in CSS. Source precedence puts the reference above the PRD, and CSS beats an SVG presentation attribute anyway, so no `size` prop is passed and the CSS governs. 16px.

### 8.4. Collapsed height needs a modifier class

The reference sets `.framefic-shell { height: 100vh; min-height: 590px }`. In a 48px collapsed iframe that floor pushes the header out of a window that cannot scroll. `.framefic-shell.is-collapsed` in `shell.css` drops `min-height` to 0. The tab bar, content, and footer leave the DOM rather than being hidden, so nothing stays in the accessibility tree inside a 48px window.

### 8.5. The account button is present but disabled

PRD section 7.2 puts it in the tab bar, and the Account sheet is a later feature. `TabBar` takes an optional `onOpenAccount`; with no handler the button renders disabled. It enables itself the moment the sheet exists, and no scaffolding copy leaks to the creator in the meantime.

### 8.6. Two placeholder URLs

`src/config/branding.ts` carries `companyUrl` and `changelogUrl`. The PRD names only the backend host, `api.memberframe.framefic.com`, and never gives a marketing site or changelog location. Both are marked UNCONFIRMED in that file and must be replaced before packaging, task 8.8.

### 8.7. Task 0.9 arrived early

Task 0.9 is the collapse toggle in `App.tsx`. The header owns the control, so building the shell without wiring it would have left a dead button. The state and the second `showUI` call are three lines in `App.tsx` and are included here. The task is recorded as `awaiting review` alongside 0.4 to 0.7.
