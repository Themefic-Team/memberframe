# Feature: Canvas Component Appearance And Sizing

The shared appearance system every MemberFrame canvas component carries: Theme, Colors, Typography, Layout, and Labels in the Framer sidebar, fixed default sizing, and one sanitizer for every creator value that reaches CSS.

**PRD reference**: [sections 8 and 9](../memberframe-complete-prd.md), no F number
**Status**: in progress (awaiting review and human verification)
**Tasks**: cross-cutting. Components: `<MemberAuth>` and its four screens, `<MemberDashboard>`, `<MemberGate>`, `<OnboardingModal>`

---

## 1. Overview and Problem Solved

- **Feature Name**: Canvas appearance
- **Target Audience**: Framer Creator, and every visitor of their site
- **Value Proposition**: Fixes three reported defects, and gives creators full control over the look of every component.
  1. **Editor light, published site dark.** Every component switched palette on `@media (prefers-color-scheme: dark)`. The Framer canvas renders light, but that query follows the visitor's operating system, so anyone with a dark OS saw a dark component the creator never designed. Theme is now a control, Light by default, with Dark and Match visitor as explicit choices.
  2. **Frame size ignored.** The cards had a max width (360 to 560px) and never filled the height, so the selection box was larger than the component. Every component is now fixed size by default (`any-prefer-fixed` both ways) and fills its frame, scrolling inside if the frame is smaller than the content.
  3. **Sidebar values not taking effect.** The accent reached CSS only through a hex, rgb, or hsl whitelist, so a Framer colour style (`var(--token-…, rgb(…))`) silently fell back to the default. Dashboard and Onboarding read none of the panel's settings in their sidebar defaults. The gate had no style controls at all, and its code-override card used a class the stylesheet never defined.
- **Priority Tier**: P0: Core MVP

---

## 2. User Flows

### 2.1. In-Plugin Configuration Flow (Framer Designer)

Unchanged in the plugin. In Framer's sidebar every component now shows, after its own controls:

| Group | Controls |
| :--- | :--- |
| Accent Color, Corner Radius | As before (new on `<MemberGate>`) |
| Theme | Light (default), Dark, Match visitor |
| Colors | Background, Text, Muted text, Border, Field, Button text. All optional: unset follows the theme |
| Typography | Custom font (on or off), Font (Framer's picker, loads the font), Text size 70 to 160% |
| Layout | Padding, Spacing, Border width 0 to 4, Shadow |
| Labels | Every visible string, `{name}` placeholders where a value is inserted |

Not editable on purpose: the reset confirmation in `<MemberAuth>` ("If {email} has an account…"), because its wording is a security property (FP-02 section 3.4 rule 3); validation and server error messages; creator-only setup notices.

### 2.2. Visitor / Member Runtime Flow

Visitors see exactly what the creator saw on the canvas, in the chosen theme. Match visitor follows their OS.

---

## 3. Architecture and File Inventory

- **Shared block**: between `// @memberframe-appearance-start` and `// @memberframe-appearance-end` in all four `src/canvas-components/*.tsx`, byte-identical. Functions: `mfSafeColor`, `mfNumber`, `mfFontFamily`, `mfThemeClass`, `mfFill`, `mfLabel`, `mfAppearanceVars`, `mfThemeCss`, `mfAppearanceControls`, `mfLabelControls`.
- **CSS model**: `mfThemeCss(root)` declares the palette as `--mf-c-*` per theme (bare root and `.is-light` light, `.is-dark` dark, `.is-auto` dark only under the media query). `mfAppearanceVars` writes the creator's values as `--mf-*` in a per-instance scoped style block, declaring every one (`initial` when unset) so a nested component never inherits an outer one's overrides. Component stylesheets read only these.
- **Types**: `src/types/framer-canvas.d.ts` widened with `ControlType.Object`, `ControlType.Font`, `optional`, `controls`, `defaultFontType`, `buttonTitle`.
- **Tests**: `test/canvasAppearanceParity.test.ts` holds the copies identical, compiles the block with TypeScript and executes the sanitizers against injection attempts, and checks every component for Theme, fixed sizing, the controls, scaled font sizes, and that every label it renders is defined.

---

## 4. Framer Property Controls Specification

| Control Title | Control Type | Default Value | Description |
| :--- | :--- | :--- | :--- |
| Theme | `Enum` | `light` | Light, Dark, Match visitor |
| Colors | `Object` of 6 `Color`, `optional` | unset | Overrides the theme palette per colour |
| Typography | `Object`: `Boolean`, `Font`, `Number` | off, sans-serif, 100% | Custom font and text scale |
| Layout | `Object`: 3 `Number`, `Boolean` | per component (Auth 24/14/1/on, Gate 24/10/1/on, Dashboard 24/20/1/off, Onboarding 24/16/1/on) | Padding, spacing, border width, shadow |
| Labels | `Object` of `String` | the shipped copy | One per visible string |

---

## 5. Data Contracts and Core User Schema

```typescript
type MfThemeMode = "light" | "dark" | "auto";
interface MfAppearanceProps {
  theme?: MfThemeMode;
  colors?: Partial<Record<"onAccent" | "surface" | "text" | "muted" | "border" | "field", string>> | null;
  typography?: { customFont?: boolean; font?: unknown; textScale?: number } | null;
  layout?: { padding?: number; gap?: number; borderWidth?: number; shadow?: boolean } | null;
  labels?: Record<string, unknown> | null;
}
```

None of these are in the generator's config block, so the plugin's saved configuration is unchanged.

---

## 6. Verification and Testing Checklist

- [x] `lint:css`, `lint:design`, `tsc --noEmit`, `test` (708), `build` pass.
- [x] Sanitizers executed against injection attempts (colour, font, numbers).
- [x] No component keys its palette off `prefers-color-scheme` outside Match visitor.
- [ ] Redeploy each component from the Builder (Add to canvas updates the existing file) and check the canvas.
- [ ] Light and dark rendering, contrast, and scrolling inside a small fixed frame, in Framer.

---

## 7. Verified By Whom

The agent cannot see the Framer canvas, the sidebar, or a published site.

| Check | Status | Who |
| :--- | :--- | :--- |
| Theme Light on canvas and published page look identical | needs human | |
| Theme Dark and Match visitor render correctly | needs human | |
| Accent Color, including a colour style, changes the Sign in button | needs human | |
| Colors, Typography (custom font loads), Layout, and Labels groups appear and apply | needs human | |
| A new instance is Fixed size and the card fills the frame | needs human | |
| Framer's Font control value has a `fontFamily` string, as the shim assumes | needs human | |
| `<MemberGate>` code overrides (withSilverTier and so on) show a styled lock card | needs human | |
