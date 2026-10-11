---
description: Mandatory company standards for Framer plugin development: 100% frontend-focused, feature research intake, zero inline CSS, .primary-cta standard, light/dark theme sync, Pro-Lock security, 7-day trial flow, 1-instance limit, and Framer site telemetry.
globs: ["**/*"]
alwaysApply: true
---

# Add Your Plugin Specific Rules Here
....



# General Plugin Engineering & Architecture Rules

Whenever generating or editing code in this workspace:

1. **Frontend-Only Scope & Phased Execution**:
   - The agent ecosystem is **100% focused on frontend plugin development** (React + Vite + Framer SDK + Canvas Code Components).
   - Backend servers are maintained separately and are NOT in this agent's scope.
   - **Execution Order**:
     1. Step 0: Feature Analysis, Instructions & Research Intake.
     2. Phase 1: SPEC.md, SDD.md & TDD Plan.
     3. Phase 2: Plugin UI Panel, Customization Controls & Theme Sync.
     4. Phase 3: Canvas Code Component & Property Controls.
     5. Phase 4: Pro-Lock, 7-Day Trial & Subscription Management (added only AFTER core plugin workflow is complete).
     6. Phase 5: Frontend Site Telemetry (`getSiteInfo`, `/api/user/site-info` sync).
     7. Phase 6: Verification & Packaging (`npm run pack`).

2. **Multi-Agent Orchestrator & Sub-Agent Ecosystem**:
   - **Step 0: Interactive Research Intake**: When the user initiates a project or submits a feature prompt, `framer-orchestrator` begins by asking:
     - Core feature analysis, instructions, and research details.
     - Reference plugin preferences or design benchmarks.
     - Scope of customization (controls, layouts, styling, animation options).
   - After analyzing the feature requirements with the user, the Orchestrator generates the living plan, `SPEC.md`, `SDD.md`, and TDD plan, and maintains the **Agent Work Preview** table.
   - Work is dispatched to specialized frontend sub-agents:
     - `framer-frontend-ui`: Plugin UI panel (360x640, Tabs, Customizer, `.primary-cta`, external CSS, themes).
     - `framer-canvas-codegen`: Canvas Code Components, Property Controls, CSS template injection.
     - `framer-licensing-lock`: Client Pro-Lock, 7-day trial, 1-instance limit, watermark removal.
     - `framer-telemetry-tracking`: `getSiteInfo()`, `/api/user/site-info` sync, `componentsCount`, `framer.mode` safety.

3. **Mandatory Pre-Flight Check: `design-tokens.css` & Ecosystem Reference Adherence**:
   - Before writing or modifying any UI or CSS, the agent **MUST FIRST CHECK** if `design-tokens.css` (or `src/styles/variables.css`) exists in the project or references (`.agent/skills/framer-plugin-suite/references/design-tokens.css`).
   - If design tokens exist, the agent **MUST STRICTLY FOLLOW THE EXACT CSS RULES, TOKENS, AND VARIABLES** defined in the project. Do not introduce outside or arbitrary styling.
   - The agent **MUST CONSULT AND FOLLOW all reference folders in the ecosystem** (`.agent/skills/framer-plugin-suite/references/` and existing plugins in the workspace) as well as **`SKILL.md`**.
   - Standard window geometry MUST be initialized in `src/App.tsx`:
     ```typescript
     framer.showUI({
       position: "top right",
       width: 360,
       height: 640,
     })
     ```

4. **STRICT ZERO INLINE CSS RULE: USE EXTERNAL CSS ONLY**:
   - The AI agent **MUST NEVER USE INLINE CSS (`style={{ ... }}`) IN REACT JSX**.
   - All styling must reside exclusively in external `.css` files (e.g. `App.css`, `AuthModal.css`, `SettingsPage.css`, `Widgets.css`, `ProfilePage.css`, `variables.css`).
   - Never use inline `style={{ ... }}` for layout, dimensions, gaps, margins, colors, borders, or conditional display. Use semantic class names and state classes (e.g. `.form-row`, `.is-active`, `.is-disabled`, `.is-locked`).
   - In generated canvas code components, consolidate all styling into a CSS template module (`cssContent` string) injected via `<style>` with semantic class names, rather than inline style objects.

5. **Mandatory Actions & Button Standards (Figma Node `13085:7951` & `13030:281`)**:
   - **Primary CTA (`.primary-cta` / `<Button variant="primary">`)**:
     - Exactly **ONE** primary action button per view (e.g. "Add to Canvas", "Insert Component", "Sign In to Unlock", "Create calculator", "Upgrade to Unlock"). Never two primary buttons in the same view.
     - Sourced from Figma brand gradient (180° `#5271ff` $\rightarrow$ `#3b51b8`), 10px radius (Medium) or 8px radius (Small), lit top highlight (`inset 0 1px 0 rgba(255,255,255,0.20)`), and whisper glow (`0 2px 6px -2px rgba(82,113,255,0.14)`).
     - **PROHIBITION**: Never use flat `#5271FF` as button fill — white text on `#5271FF` fails WCAG AA (4.07:1). Always use the gradient or `brand/action` (`#3358FF` / `#4761db` at 5.28:1 contrast).
   - **Secondary (`.secondary-cta` / `<Button variant="secondary">`)**: Alternatives and default actions (`Cancel`, `Test webhook`). Fill `var(--framer-color-bg-tertiary)` with hairline divider border.
   - **Ghost (`<Button variant="ghost">`)**: Low-emphasis toolbar and header actions.
   - **Danger (`<Button variant="danger">`)**: Destructive actions only (`Delete calculator`). Must confirm before acting.
   - **Action Copy**: Verb + object, sentence case, 2–4 words, ≤ 25 characters (`Insert on canvas`, `Copy code`). Leading icon as verb cue (`Plus` for add/insert, `Sparkles` for AI actions).
   - **Sizes**: Small (30px, radius 8, plugin default) and Medium (36px, radius 10, prominent CTAs).

6. **Mandatory Plugin Shell Architecture**:
   - All plugins MUST use `<PluginShell>` with the authoritative 4-part shell structure:
     1. **Plugin Header (48px)**: 24px Logo (`.framefic-header-logo`), Plugin Name (`Title/Small`), Collapse toggle (`<ChevronDown size={14} />`), and Close (`<X size={14} />` calling `framer.closePlugin()`).
     2. **Tab Bar (36px)**: 2-4 Tabs with active 2px bottom gradient pill indicator (`.framefic-tab.active`), spacer, and Account icon button (`<UserRound size={16} />`).
     3. **Content Scroll Area**: `.framefic-content-area` scrolls between header and pinned footer.
     4. **Plugin Footer (40px)**: Pinned at bottom (`.framefic-footer`), company link (`<ExternalLink size={12} />`), spacer, and version tag (`v1.0.0` opening Changelog).
   - Collapse toggle must shrink the panel to 48px height via `framer.showUI({ position: "top right", width: 360, height: 48 })` and restore to 640px when tapped again.

7. **Strict Icon & Icon Button Standard (Figma Node `13031:89`)**:
   - The AI agent **MUST ALWAYS use exclusively official Lucide React icons (`lucide-react`) or Framer SVG icons**.
   - **STRICT PROHIBITION**: NEVER use unicode emojis anywhere in the plugin UI, tabs, buttons, dialogs, badges, or canvas components.
   - All icons must use `stroke="currentColor"` or `fill="currentColor"` to inherit CSS theme tokens automatically.
   - **Icon Buttons (`<IconButton />` / `.icon-button`)**: 30×30px, 8px radius (`var(--radius-md)`), 16px centered icon. Supports `variant="secondary"` (bg/tertiary with divider border) and `variant="ghost"` (transparent base with hover bg/tertiary). Must always include `aria-label` and `title` for accessibility. Keyboard focus shows 1px tint ring + 3px halo glow. Disabled state is 50% opacity and excluded from Tab navigation.

8. **Light Mode & Dark Mode Color Synchronization Guidelines**:
   - The plugin UI must dynamically synchronize with Framer's workspace theme (`body[data-framer-theme="light|dark"]`) and user preference (`html[data-user-theme="light|dark|system"]`).
   - **ZERO HARDCODED HEX COLORS**: Never hardcode colors like `#fff`, `#000`, `#1a1e22` in component JSX or CSS. Always reference variables:
     - Main App Background: `var(--framefic-page-bg)`
     - Cards / Navbar: `var(--framefic-surface)`
     - Card Headers / Table Rows: `var(--framefic-surface-2)`
     - Inputs / Inner Wells: `var(--bg-card-inner)`
     - Dividers & Borders: `var(--framefic-surface-border)`
     - Headings / Primary Text: `var(--title)`
     - Paragraph / Descriptive Text: `var(--paragraph)`
     - Muted Text / Inactive Icons: `var(--paragraph-faint)`
     - Brand Accent: `var(--secondary-default)`
   - Form inputs must follow the authoritative `.field-row` pattern (or legacy `.crest-field`).
   - Native `<select>` options MUST include the contrast fix: `select option { background-color: var(--framer-color-bg-tertiary, var(--bg-card-inner)) !important; color: var(--title) !important; }`.
   - All SVG icons must use `stroke="currentColor"` or `fill="currentColor"`.

9. **Authoritative Form Controls & Field Row Standards (Figma Node `13085:8044`)**:
   - **Properties Panel Pattern**: Controls sit on the right with the label on the left, perfectly mirroring Framer's native properties panel.
   - **Field Row Layout (`.field-row`)**: Horizontal flex, `justify-content: space-between`, `align-items: center`, `min-height: 30px`, `gap: 12px` (`space/12`). Rows are stacked inside `.field-rows` with `gap: 8px` (`space/8`).
   - **Label Left (`.field-row-label`)**: 12px, line-height 18px, weight 500, `color: var(--framer-color-text-secondary)`. Always link with `htmlFor`.
   - **Control Right (`.field-row-control`)**: Fixed `160px` or `.fill` (`100%`).
   - **Form Controls Specs**:
     - **Control Height & Radius**: Inputs, selects, and segmented controls are **strictly 30px tall** with **8px radius** (`var(--radius-md)`).
     - **Background Fill**: `var(--framer-color-bg-tertiary)` (#ededed in Light, #313030 in Dark).
     - **Focus State**: 1px tint ring (`var(--px-color-focus-ring, #0099ff)`) + 3px whisper halo (`box-shadow: 0 0 0 3px var(--px-color-focus-halo, rgba(82, 113, 255, 0.20))`).
     - **Error State**: 1px danger border (`var(--px-color-danger, #dc2626)`), with error message below linked via `aria-describedby`. Never rely on color alone for errors.
     - **Disabled State**: 50% opacity, `cursor: not-allowed`.
     - **Toggle (`.framefic-toggle`)**: 28x16px pill, 12x12px circle knob, `role="switch"`, `aria-checked`. Never use a toggle for settings that require a "Save" action — use Checkbox.
     - **Checkbox (`.framefic-checkbox`)**: 16x16px square, 4px radius, checkmark/dash glyph, row is click target.
     - **Segmented Control (`.framefic-segmented`)**: 30px tall container, 24px active segment with subtle shadow & inner top lit highlight.

10. **Pro-Lock Security Rules**:
   - Never allow unauthenticated or unpaid users to deploy unlocked code components to Framer canvas.
   - All generated code components must have `const IS_LOCKED = true/false;` and `// @plugin-lock-state: (locked|unlocked)`.
   - All generated components must render the Frosted Glass Pro Lock Banner when `IS_LOCKED === true`.
   - The primary CTA button must dynamically swap between:
     - `<Lock /> Sign In to Unlock` (unauthenticated)
     - `<Lock /> Upgrade to Unlock` (unpaid / expired)
     - `<Plus /> Add to Canvas` (subscribed / trialing)
   - `App.tsx` must always include the `enforceLockState` effect to rewrite existing CodeFiles when subscription changes.

11. **Trial User Flow & Watermark Rules**:
    - Free trial duration is 7 days with live ticker countdown in the sticky top banner (`framefic-trial-sticky-banner`).
    - Anti-abuse trial verification: Checked across `email`, `site_id`, and `framer_user_id`.
    - **1-Instance Limit per Component**: A trial user can add each component only 1 time into their Framer project. If already added, the UI CTA swaps to `<Crown size={16} /> Upgrade to Add More`, blocking duplicate insertions.
    - **Canvas Duplicate Protection**: Internal registry `__instances__` blocks copy/pasting duplicate components on canvas during trial, displaying `.framefic-duplicate-limit-container`.
    - **Mandatory Trial Watermark**: All canvas components rendered during trial MUST display the subtle company watermark badge (`.framefic-trial-watermark`).
    - **Automatic Removal Post-Purchase**: Immediately upon buying any paid plan, `IS_TRIAL` flips to `false`, the watermark is automatically removed from all components, and the 1-instance limit is permanently lifted.

12. **Framer Site Telemetry & API Guardrails**:
   - **`getSiteInfo()` Extraction**: Retrieve project metadata (`siteId`, `siteName`, `siteUrl`, `userId`, `userEmail`) strictly via official Framer SDK calls (`getProjectInfo`, `getPublishInfo`, `getCurrentUser`).
   - **Site Info Sync**: Push `{ email, siteId, userId, siteName, siteUrl, framerSiteName, framerSiteUrl }` to `/api/user/site-info` upon login or subscription check.
   - **Component Telemetry**: Count deployed plugin files and transmit `componentsCount` in query params to `/api/subscription-status`.
   - **`framer.mode` Guardrail**: ALWAYS verify `framer.mode` before calling `framer.getCodeFiles()`. Do NOT call `getCodeFiles()` during `configureManagedCollection` or `syncManagedCollection` to avoid sandbox permission errors.
   - **2kB Storage Compression**: Use differential compression for `setPluginData` to strictly respect Framer's 2kB limit.

13. **Mandatory Feedback System Standards (Figma Nodes `13085:8408`, `13085:8413`, `13085:8422`)**:
   - **Decision Hierarchy ("Which One?")**:
     - **Toast (`.plugin-toast`)**: Action finished brief confirmation (≤ 45 characters, auto-dismiss ≥ 5s, pauses on hover/focus, optional "Undo" action). Always use `role="status"` (or `role="alert"` for error toasts).
     - **Banner (`.plugin-banner`)**: Persistent screen state (Info / Success / Warning / Danger). Danger uses `role="alert"`. Max 2 banners on a screen at once.
     - **Empty State (`.empty-state`)**: Screen/area has no content yet, with exactly one clear next-step action button (`.primary-cta.btn-sm` or `.btn-secondary.btn-sm`). Never leave blank areas without an Empty state.
     - **Field Error**: Inline message directly under the offending form field (linked via `aria-describedby`), **NOT a Banner**.
   - **Designer Rules & "Don'ts"**:
     - ✕ Never use Toast for errors that require user decision or action (use Banner or modal dialog).
     - ✕ Never display more than 2 banners simultaneously.
     - ✕ Never use colour as the only signal — always combine icon + explanatory copy.
   - **Geometry & Styling**:
     - Toast: 40px height, 14px radius, frosted glass (`var(--px-toast-bg)` with 16px backdrop blur), popover shadow (`var(--px-toast-shadow)`).
     - Banner: Min-height 64px, 14px radius, 12px padding, 10px item spacing, 12px Semi-Bold title, 12px Medium message.
     - Empty State: Min-height 200px, 16px radius, hairline divider border, 40×40 icon tile, 14px Semi-Bold title, 12px Medium description.
   - **Accessibility & Contrast**:
     - All status text and icon pairings must maintain WCAG AA contrast (≥ 4.5:1) in both Light and Dark themes.

