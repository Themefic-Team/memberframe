# Company Framer Plugin Standard Components & Home Tab Layout
## Sourced from Figma Node `13085:8245` (Company Plugin UI Kit · Foundations v0.3.7)

This document provides drop-in, zero-inline-CSS React components and standard layout composition for every company Framer plugin. All CSS classes are defined in [`design-tokens.css`](design-tokens.css).

---

## 1. Hero Card Component (`<HeroCard />`)
The welcome/AI hero card on every plugin's **Home** tab. Built with a soft pastel aurora surface, top lit edge highlight, title, description, and primary CTA.

```tsx
import React from "react";
import { Sparkles } from "lucide-react";

interface HeroCardProps {
  title: string;
  description: string;
  badgeLabel?: string;
  badgeType?: "brand" | "pro";
  ctaLabel: string;
  ctaIcon?: React.ReactNode;
  onCtaClick: () => void;
  disabled?: boolean;
}

export const HeroCard: React.FC<HeroCardProps> = ({
  title,
  description,
  badgeLabel = "AI drafts included",
  badgeType = "brand",
  ctaLabel,
  ctaIcon = <Sparkles size={16} stroke="currentColor" />,
  onCtaClick,
  disabled = false,
}) => {
  return (
    <div className="hero-card">
      <div className="hero-card-content">
        {badgeLabel && (
          <span className={`badge badge-${badgeType}`}>{badgeLabel}</span>
        )}
        <h2 className="hero-card-title">{title}</h2>
        <p className="hero-card-desc">{description}</p>
      </div>

      <button
        type="button"
        className="primary-cta"
        onClick={onCtaClick}
        disabled={disabled}
      >
        {ctaIcon}
        <span>{ctaLabel}</span>
      </button>
    </div>
  );
};
```

---

## 2. Help Tiles Row (`<HelpRow />` & `<HelpTile />`)
A row of exactly 3 equal-width shortcut cards on the Home tab (Guide · Contact us · Changelog).

```tsx
import React from "react";
import { FileText, Mail, List } from "lucide-react";

interface HelpTileProps {
  label: string;
  icon: React.ReactNode;
  onClick?: () => void;
  href?: string;
  hasDot?: boolean;
}

export const HelpTile: React.FC<HelpTileProps> = ({
  label,
  icon,
  onClick,
  href,
  hasDot = false,
}) => {
  const content = (
    <>
      <div className="help-tile-icon-box">
        {icon}
        {hasDot && <span className="help-tile-dot" />}
      </div>
      <span className="help-tile-label">{label}</span>
    </>
  );

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="help-tile"
      >
        {content}
      </a>
    );
  }

  return (
    <button type="button" className="help-tile" onClick={onClick}>
      {content}
    </button>
  );
};

export const HelpRow: React.FC<{
  onOpenGuide?: () => void;
  onContactUs?: () => void;
  onOpenChangelog?: () => void;
  hasNewUpdate?: boolean;
}> = ({ onOpenGuide, onContactUs, onOpenChangelog, hasNewUpdate = false }) => {
  return (
    <div className="help-tile-row">
      <HelpTile
        label="Guide"
        icon={<FileText size={16} />}
        onClick={onOpenGuide}
      />
      <HelpTile
        label="Contact us"
        icon={<Mail size={16} />}
        onClick={onContactUs}
      />
      <HelpTile
        label="Changelog"
        icon={<List size={16} />}
        onClick={onOpenChangelog}
        hasDot={hasNewUpdate}
      />
    </div>
  );
};
```

---

## 3. "More from Company" Plugin Cards (`<FrameficCard />`)
Promotes sibling company plugins on the Framer Marketplace. Stacked below the Help section.

```tsx
import React from "react";
import { ArrowUpRight } from "lucide-react";

interface FrameficCardProps {
  name: string;
  description: string;
  logoIcon: React.ReactNode;
  marketplaceUrl: string;
}

export const FrameficCard: React.FC<FrameficCardProps> = ({
  name,
  description,
  logoIcon,
  marketplaceUrl,
}) => {
  return (
    <a
      href={marketplaceUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="framefic-card"
      aria-label={`Open ${name} on Framer Marketplace (opens in browser)`}
    >
      <div className="framefic-card-logo">{logoIcon}</div>
      <div className="framefic-card-info">
        <h4 className="framefic-card-name">{name}</h4>
        <p className="framefic-card-desc">{description}</p>
      </div>
      <div className="framefic-card-open">
        <ArrowUpRight size={14} />
      </div>
    </a>
  );
};
export const PluginCard = FrameficCard;
```

---

## 4. Badge System (`<Badge />`)
Standard pill badges for feature tiers and statuses.

```tsx
import React from "react";

export type BadgeType =
  | "pro"
  | "brand"
  | "new"
  | "neutral"
  | "success"
  | "warning"
  | "danger";

interface BadgeProps {
  type: BadgeType;
  children: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({ type, children }) => {
  return <span className={`badge badge-${type}`}>{children}</span>;
};
```

---

## 5. Unified Button Component (`<Button />`) & Actions System
Sourced from **Figma Node `13085:7951`** (Doc · Actions) and **Node `13030:281`** (Button Component Set).

### 5.1. Action Type Guidelines
* **Primary** (`variant="primary"`): Exactly **one** main action per view (`Insert on canvas`, `Create calculator`, `Apply draft`). Uses signature 180° indigo gradient, lit top highlight, and whisper glow.
* **Secondary** (`variant="secondary"`): Alternatives and default plugin actions (`Cancel`, `Test webhook`). Uses `bg/tertiary` fill with hairline divider border.
* **Ghost** (`variant="ghost"`): Low-emphasis actions, toolbars, and header buttons. Transparent base with hover `bg/tertiary`.
* **Danger** (`variant="danger"`): Destructive actions only (`Delete calculator`, `Remove integration`). Uses `status/danger-subtle` fill with `status/danger` text. Always confirm before acting.

### 5.2. Button Size Guidelines
* **Small** (`size="sm"`): 30px height, 8px radius, 0 12px padding. Framer plugin default target (exceeds WCAG 2.2 24px target minimum).
* **Medium** (`size="md"`): 36px height, 10px radius, 0 16px padding. Used for high-prominence CTAs.

### 5.3. Designer Rules & "Don'ts"
* ✕ Never use two Primary buttons in the same view.
* ✕ Never use generic labels (`OK`, `Submit`, `Click here`). Always use **Verb + object**, sentence case, ≤ 25 characters (`Insert on canvas`, `Copy code`).
* ✕ Never use `#5271FF` as a flat button fill (white text on flat `#5271FF` is only 4.07:1, failing WCAG AA). Always use the brand gradient or `brand/action` (`#3358FF` / `#4761db` at 5.28:1 contrast).
* Leading icon serves as a verb cue: `Plus` for Insert / Add, `Sparkles` for AI actions.

```tsx
import React from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = "secondary",
  size = "sm",
  iconLeft,
  iconRight,
  loading = false,
  disabled = false,
  className = "",
  children,
  onClick,
  ...props
}) => {
  const isPrimary = variant === "primary";
  const baseClass = isPrimary ? "primary-cta" : `btn btn-${variant}`;
  const sizeClass = size === "md" ? "btn-md" : "btn-sm";
  const btnClass = `${baseClass} ${sizeClass} ${className}`.trim();

  return (
    <button
      type="button"
      className={btnClass}
      disabled={disabled || loading}
      aria-disabled={disabled || loading}
      onClick={disabled || loading ? undefined : onClick}
      {...props}
    >
      {iconLeft && <span className="btn-icon-left">{iconLeft}</span>}
      <span className="btn-label">{children}</span>
      {iconRight && <span className="btn-icon-right">{iconRight}</span>}
    </button>
  );
};
```

---

## 6. Icon Button Component (`<IconButton />`)
Sourced from **Figma Node `13031:89`** (Actions · Doc `13085:7951`).
Compact 30×30 action buttons for header actions (Close, Collapse), toolbar actions (Copy, Link, Settings), and navigation.
Supports `variant="secondary"` (raised `var(--framer-color-bg-tertiary)` with subtle hairline divider) and `variant="ghost"` (transparent base with hover `var(--framer-color-bg-tertiary)`).
Meets WCAG 2.2 target standards (30×30px ≥ 24px minimum), includes keyboard-only focus ring (1px tint + 3px halo), micro-interaction press scaling, and disabled opacity.

```tsx
import React from "react";

export type IconButtonVariant = "secondary" | "ghost";

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: IconButtonVariant;
  icon: React.ReactNode;
  "aria-label": string;
  tooltip?: string;
  disabled?: boolean;
}

export const IconButton: React.FC<IconButtonProps> = ({
  variant = "ghost",
  icon,
  "aria-label": ariaLabel,
  tooltip,
  disabled = false,
  className = "",
  onClick,
  ...props
}) => {
  return (
    <button
      type="button"
      className={`icon-button ${variant} ${className}`.trim()}
      aria-label={ariaLabel}
      title={tooltip || ariaLabel}
      disabled={disabled}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      onClick={disabled ? undefined : onClick}
      {...props}
    >
      {icon}
    </button>
  );
};
```

---

## 7. Complete Standard Home Tab Layout (`HomePage.tsx`)
Drop-in layout for the Home tab across all Pixelfic Framer plugins with **Zero Inline CSS**:

```tsx
import React from "react";
import { Sparkles, Layers, Flame } from "lucide-react";
import { HeroCard } from "./components/HeroCard";
import { HelpRow } from "./components/HelpRow";
import { PluginCard } from "./components/PluginCard";

export const HomePage: React.FC<{
  onActionClick: () => void;
}> = ({ onActionClick }) => {
  return (
    <div className="home-tab-container">
      {/* 1. Hero Welcome Card */}
      <HeroCard
        title="Welcome to Calfic"
        description="Describe your pricing in plain words. Get an on-brand calculator in seconds."
        badgeLabel="AI drafts included"
        badgeType="brand"
        ctaLabel="Create calculator"
        ctaIcon={<Sparkles size={16} />}
        onCtaClick={onActionClick}
      />

      {/* 2. Help Section */}
      <div className="section-group">
        <h3 className="section-title">Help</h3>
        <HelpRow
          onOpenGuide={() => window.open("https://help.pixelfic.com/calfic", "_blank")}
          onContactUs={() => window.open("mailto:support@pixelfic.com", "_blank")}
          onOpenChangelog={() => window.open("https://pixelfic.com/changelog", "_blank")}
          hasNewUpdate={true}
        />
      </div>

      {/* 3. More from Pixelfic */}
      <div className="section-group">
        <h3 className="section-title">More from Pixelfic</h3>
        <div className="framefic-card-list">
          <PluginCard
            name="Crestbar"
            description="Dynamic promotional header banners with live timers."
            logoIcon={<Flame size={22} />}
            marketplaceUrl="https://www.framer.com/marketplace/plugins/crestbar"
          />
          <PluginCard
            name="BEAF"
            description="Advanced before and after image comparison sliders."
            logoIcon={<Layers size={22} />}
            marketplaceUrl="https://www.framer.com/marketplace/plugins/beaf"
          />
        </div>
      </div>
    </div>
  );
};
```

---

## 8. Official Plugin Shell Architecture (`<PluginShell />`)
Sourced from **Figma Node `13085:8133`** (Crestbar pattern):
Every Pixelfic Framer plugin uses the exact same header (48px), tab bar (36px), content scroll area, and footer (40px).

```tsx
import React, { useState } from "react";
import { framer } from "framer-plugin";
import { ChevronDown, ChevronUp, X, UserRound, ArrowUpRight } from "lucide-react";

interface PluginShellProps {
  name: string;
  logo: React.ReactNode;
  tabs: string[];
  activeTab: string;
  onTabChange: (tab: string) => void;
  onAccountClick?: () => void;
  version?: string;
  companyName?: string;
  companyUrl?: string;
  children: React.ReactNode;
}

export const PluginShell: React.FC<PluginShellProps> = ({
  name,
  logo,
  tabs,
  activeTab,
  onTabChange,
  onAccountClick,
  version = "v1.0.0",
  companyName = "@Pixelfic",
  companyUrl = "https://pixelfic.com",
  children,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleToggleCollapse = async () => {
    if (isCollapsed) {
      await framer.showUI({ position: "top right", width: 360, height: 640 });
      setIsCollapsed(false);
    } else {
      await framer.showUI({ position: "top right", width: 360, height: 48 });
      setIsCollapsed(true);
    }
  };

  const handleClose = () => {
    framer.closePlugin();
  };

  return (
    <div className="framefic-shell">
      {/* 1. Header (48px) */}
      <header className="framefic-header">
        <div className="framefic-header-brand">
          <div className="framefic-header-logo">{logo}</div>
          <h1 className="framefic-header-title">{name}</h1>
        </div>

        <div className="framefic-header-actions">
          <button
            type="button"
            className="icon-button ghost"
            onClick={handleToggleCollapse}
            aria-label={isCollapsed ? "Expand plugin" : "Collapse plugin"}
            title={isCollapsed ? "Expand" : "Collapse"}
          >
            {isCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>
          <button
            type="button"
            className="icon-button ghost"
            onClick={handleClose}
            aria-label="Close plugin"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>
      </header>

      {/* When collapsed, hide tab bar, content, and footer */}
      {!isCollapsed && (
        <>
          {/* 2. Tab Bar (36px) */}
          <nav className="framefic-tab-bar" role="tablist" aria-label="Plugin navigation">
            <div className="framefic-tabs-list">
              {tabs.map((tab) => {
                const isActive = activeTab === tab;
                return (
                  <button
                    key={tab}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    className={`framefic-tab ${isActive ? "active" : ""}`}
                    onClick={() => onTabChange(tab)}
                  >
                    {tab}
                  </button>
                );
              })}
            </div>

            <div className="framefic-tab-spacer" />

            {onAccountClick && (
              <button
                type="button"
                className="icon-button ghost"
                onClick={onAccountClick}
                aria-label="Account and subscription"
                title="Account"
              >
                <UserRound size={16} />
              </button>
            )}
          </nav>

          {/* 3. Content Scroll Area */}
          <main className="framefic-content-area">{children}</main>

          {/* 4. Pinned Footer (40px) */}
          <footer className="framefic-footer">
            <a
              href={companyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="framefic-footer-link"
              aria-label={`${companyName} website (opens in browser)`}
            >
              <span>{companyName}</span>
              <ArrowUpRight size={12} />
            </a>

            <div className="framefic-tab-spacer" />

            <span
              className="framefic-footer-version"
              onClick={() => window.open(`${companyUrl}/changelog`, "_blank")}
              title="View Changelog"
            >
              {version}
            </span>
          </footer>
        </>
      )}
    </div>
  );
};
export const FrameficShell = PluginShell;
```

---

## 9. Form Controls & Field Rows (Figma Node `13085:8044`)
Form controls matching Framer's native properties panel: 30px height, 8px radius, `var(--framer-color-bg-tertiary)` background, 1px focus ring + 3px focus halo. In layouts, controls sit on the right of a field row with the label on the left.

### 9.1. Field Row Container (`<FieldRow />`)
Standard horizontal layout row (`justify-content: space-between`, `gap: 12px`, `min-height: 30px`). Rows are stacked with `space/8` (8px). Includes error message support with `aria-describedby`.

```tsx
import React from "react";

interface FieldRowProps {
  label?: string;
  htmlFor?: string;
  error?: string;
  fill?: boolean;
  children: React.ReactNode;
}

export const FieldRow: React.FC<FieldRowProps> = ({
  label,
  htmlFor,
  error,
  fill = false,
  children,
}) => {
  const errorId = htmlFor ? `${htmlFor}-error` : undefined;

  return (
    <div className="field-row-wrap">
      <div className="field-row">
        {label && (
          <label htmlFor={htmlFor} className="field-row-label">
            {label}
          </label>
        )}
        <div className={`field-row-control ${fill ? "fill" : ""}`}>
          {children}
        </div>
      </div>
      {error && (
        <span id={errorId} className="field-error-message" role="alert">
          {error}
        </span>
      )}
    </div>
  );
};
```

---

### 9.2. Text Field (`<TextField />`)
Height 30px, 8px radius, optional leading icon, 1px focus ring + 3px halo, error state.

```tsx
import React from "react";

interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  leadingIcon?: React.ReactNode;
  invalid?: boolean;
  fill?: boolean;
  errorId?: string;
}

export const TextField: React.FC<TextFieldProps> = ({
  leadingIcon,
  invalid = false,
  fill = false,
  errorId,
  className = "",
  disabled,
  ...props
}) => {
  const inputClass = `framefic-input ${invalid ? "is-error" : ""} ${className}`.trim();

  if (leadingIcon) {
    return (
      <div className={`framefic-input-wrap has-leading-icon ${fill ? "fill" : ""}`}>
        <span className="framefic-input-icon">{leadingIcon}</span>
        <input
          type="text"
          className={inputClass}
          disabled={disabled}
          aria-invalid={invalid}
          aria-describedby={errorId}
          {...props}
        />
      </div>
    );
  }

  return (
    <div className={`framefic-input-wrap ${fill ? "fill" : ""}`}>
      <input
        type="text"
        className={inputClass}
        disabled={disabled}
        aria-invalid={invalid}
        aria-describedby={errorId}
        {...props}
      />
    </div>
  );
};
```

---

### 9.3. Select Field (`<SelectField />`)
Height 30px, 8px radius, native chevron SVG icon, light/dark contrast fix on `<option>`.

```tsx
import React from "react";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectFieldProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "children"> {
  options: Array<SelectOption | string>;
  invalid?: boolean;
  fill?: boolean;
}

export const SelectField: React.FC<SelectFieldProps> = ({
  options,
  invalid = false,
  fill = false,
  className = "",
  disabled,
  ...props
}) => {
  const selectClass = `framefic-select ${invalid ? "is-error" : ""} ${fill ? "fill" : ""} ${className}`.trim();

  return (
    <select
      className={selectClass}
      disabled={disabled}
      aria-invalid={invalid}
      {...props}
    >
      {options.map((opt) => {
        const val = typeof opt === "string" ? opt : opt.value;
        const text = typeof opt === "string" ? opt : opt.label;
        return (
          <option key={val} value={val}>
            {text}
          </option>
        );
      })}
    </select>
  );
};
```

---

### 9.4. Checkbox (`<Checkbox />`)
16x16px square, 4px radius, checkmark / indeterminate dash glyph, 8px gap.

```tsx
import React, { useEffect, useRef } from "react";

interface CheckboxProps {
  id?: string;
  label?: string;
  checked?: boolean;
  indeterminate?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  name?: string;
}

export const Checkbox: React.FC<CheckboxProps> = ({
  id,
  label,
  checked = false,
  indeterminate = false,
  onChange,
  disabled = false,
  name,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  return (
    <label className={`framefic-checkbox ${disabled ? "is-disabled" : ""}`}>
      <input
        ref={inputRef}
        id={id}
        name={name}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
      />
      <span className="framefic-checkbox-box" aria-hidden="true">
        {indeterminate ? (
          <span className="framefic-checkbox-dash" />
        ) : (
          <svg className="framefic-checkbox-icon" viewBox="0 0 12 12">
            <polyline points="2.5 6 5 8.5 9.5 3.5" />
          </svg>
        )}
      </span>
      {label && <span>{label}</span>}
    </label>
  );
};
```

---

### 9.5. Toggle Switch (`<Toggle />`)
28x16px pill, 12x12px knob circle, 1px tint focus ring, `role="switch"` semantics.

```tsx
import React from "react";

interface ToggleProps {
  id?: string;
  label?: string;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  ariaLabel?: string;
}

export const Toggle: React.FC<ToggleProps> = ({
  id,
  label,
  checked = false,
  onChange,
  disabled = false,
  ariaLabel,
}) => {
  return (
    <label className={`framefic-toggle ${disabled ? "is-disabled" : ""}`} title={label || ariaLabel}>
      <input
        id={id}
        type="checkbox"
        role="switch"
        aria-checked={checked}
        aria-label={label || ariaLabel}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
      />
      <span className="framefic-toggle-track" aria-hidden="true">
        <span className="framefic-toggle-knob" />
      </span>
    </label>
  );
};
```

---

### 9.6. Segmented Control (`<SegmentedControl />`)
Height 30px container, 8px radius, 24px active segment with subtle shadow & top inner highlight.

```tsx
import React from "react";

export interface SegmentOption {
  value: string;
  label: string;
}

interface SegmentedControlProps {
  value: string;
  onChange: (val: string) => void;
  options: Array<SegmentOption | string>;
  disabled?: boolean;
  ariaLabel?: string;
}

export const SegmentedControl: React.FC<SegmentedControlProps> = ({
  value,
  onChange,
  options,
  disabled = false,
  ariaLabel = "Segmented control",
}) => {
  return (
    <div
      className="framefic-segmented"
      role="radiogroup"
      aria-label={ariaLabel}
    >
      {options.map((opt) => {
        const val = typeof opt === "string" ? opt : opt.value;
        const text = typeof opt === "string" ? opt : opt.label;
        const isActive = value === val;

        return (
          <button
            key={val}
            type="button"
            role="radio"
            aria-checked={isActive}
            className={`framefic-segment ${isActive ? "is-active" : ""}`}
            onClick={() => !disabled && onChange(val)}
            disabled={disabled}
          >
            {text}
          </button>
        );
      })}
    </div>
  );
};
```

---

### 9.7. Complete Form Field Rows Example
Usage matching Framer's native properties panel:

```tsx
import React, { useState } from "react";
import { FieldRow } from "./FieldRow";
import { TextField } from "./TextField";
import { SelectField } from "./SelectField";
import { Checkbox } from "./Checkbox";
import { Toggle } from "./Toggle";
import { SegmentedControl } from "./SegmentedControl";

export const ExamplePropertiesPanel: React.FC = () => {
  const [label, setLabel] = useState("Website quote");
  const [price, setPrice] = useState("0.00");
  const [per, setPer] = useState("page");
  const [showBreakdown, setShowBreakdown] = useState(true);
  const [minimalEvents, setMinimalEvents] = useState(false);
  const [themeMode, setThemeMode] = useState("light");

  return (
    <div className="field-rows">
      <FieldRow label="Label" htmlFor="prop-label">
        <TextField
          id="prop-label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
      </FieldRow>

      <FieldRow label="Price" htmlFor="prop-price">
        <TextField
          id="prop-price"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
      </FieldRow>

      <FieldRow label="Per" htmlFor="prop-per">
        <SelectField
          id="prop-per"
          value={per}
          onChange={(e) => setPer(e.target.value)}
          options={["page", "month", "project", "hour"]}
        />
      </FieldRow>

      <FieldRow label="Visitors" htmlFor="prop-visitors">
        <Checkbox
          id="prop-visitors"
          label="Show breakdown"
          checked={showBreakdown}
          onChange={setShowBreakdown}
        />
      </FieldRow>

      <FieldRow label="Minimal events" htmlFor="prop-events">
        <Toggle
          id="prop-events"
          checked={minimalEvents}
          onChange={setMinimalEvents}
        />
      </FieldRow>

      <FieldRow label="Theme" fill>
        <SegmentedControl
          value={themeMode}
          onChange={setThemeMode}
          options={[
            { value: "light", label: "Light" },
            { value: "dark", label: "Dark" },
            { value: "match", label: "Match site" },
          ]}
        />
      </FieldRow>
    </div>
  );
};
```

---

## 10. Feedback System: Toast, Banner & Empty State
Sourced from **Figma Node `13085:8408`** (Section · Feedback), **Node `13085:8413`** (Panel · Light), **Node `13085:8422`** (Panel · Dark), **Node `13035:133`** (Banner Component Set), **Node `13035:134`** (Empty State), and **Node `13035:75`** (Toast Component Set).

### 10.1. Decision Matrix ("Which One?")
* **Action finished** $\rightarrow$ **Toast** (Brief confirmation, ≤ 45 characters, auto-dismiss ≥ 5s, optional Undo).
* **Screen has a persistent state user must know** $\rightarrow$ **Banner** (Info / Success / Warning / Danger).
* **Area has no content yet** $\rightarrow$ **Empty state** (Container with exactly one clear next-step action).
* **Field input wrong** $\rightarrow$ **Inline field error message** (under the input, linked via `aria-describedby`), **NOT a Banner**.

### 10.2. Designer Rules & "Don'ts"
* ✕ **Never use Toast for errors that require user decisions or action.** (Use Banner or modal dialog instead).
* ✕ **Never show more than 2 banners on a screen at once.**
* ✕ **Never leave blank areas without an Empty state.**
* ✕ **Never use colour as the only signal** — always combine icon + explanatory copy.

### 10.3. Accessibility & Contrast Standards
* **Toast**: Uses `role="status"` (`aria-live="polite"`), or `role="alert"` (`aria-live="assertive"`) for error toasts. Duration ≥ 5s, pauses automatically on hover or keyboard focus.
* **Banner**: Danger uses `role="alert"`. Info, Success, and Warning use `role="status"`.
* **Contrast**: All status text and icon pairings achieve WCAG AA contrast (≥ 4.5:1) in both Light and Dark themes.

---

### 10.4. Banner Component (`<Banner />`)
Min-height 64px, 14px radius, 12px padding, 10px item spacing. Supports optional inline action button.

```tsx
import React from "react";
import { Info, CheckCircle2, AlertTriangle, AlertCircle } from "lucide-react";

export type BannerType = "info" | "success" | "warning" | "danger";

interface BannerProps {
  type?: BannerType;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
  className?: string;
}

const defaultIcons: Record<BannerType, React.ReactNode> = {
  info: <Info size={16} stroke="currentColor" />,
  success: <CheckCircle2 size={16} stroke="currentColor" />,
  warning: <AlertTriangle size={16} stroke="currentColor" />,
  danger: <AlertCircle size={16} stroke="currentColor" />,
};

export const Banner: React.FC<BannerProps> = ({
  type = "info",
  title,
  message,
  actionLabel,
  onAction,
  icon,
  className = "",
}) => {
  const isAlert = type === "danger";

  return (
    <div
      className={`plugin-banner banner-${type} ${className}`.trim()}
      role={isAlert ? "alert" : "status"}
      aria-live={isAlert ? "assertive" : "polite"}
    >
      <div className="banner-icon" aria-hidden="true">
        {icon || defaultIcons[type]}
      </div>

      <div className="banner-body">
        <h4 className="banner-title">{title}</h4>
        <p className="banner-message">{message}</p>

        {actionLabel && onAction && (
          <div className="banner-action-wrap">
            <button
              type="button"
              className="banner-action-btn"
              onClick={onAction}
            >
              {actionLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
```

---

### 10.5. Empty State Component (`<EmptyState />`)
Min-height 200px, 16px radius, hairline divider border, 40×40 icon tile, 14px title, 12px description, single next step action.

```tsx
import React from "react";
import { Calculator } from "lucide-react";

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon = <Calculator size={20} stroke="currentColor" />,
  action,
  className = "",
}) => {
  return (
    <div className={`empty-state ${className}`.trim()}>
      <div className="empty-state-icon-tile" aria-hidden="true">
        {icon}
      </div>

      <h3 className="empty-state-title">{title}</h3>
      <p className="empty-state-desc">{description}</p>

      {action && <div className="empty-state-action">{action}</div>}
    </div>
  );
};
```

---

### 10.6. Toast Component (`<Toast />`) & Manager (`useToast()`)
Height 40px, 14px radius, frosted glass (`bg/raised` 82% + 16px backdrop blur), light popover shadow, ≤ 45 characters, optional Undo action.

```tsx
import React, { useState, useEffect, useRef, createContext, useContext } from "react";
import { CheckCircle2, AlertCircle, Info } from "lucide-react";

export type ToastType = "neutral" | "success" | "error" | "info";

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  duration?: number; // ms, default 5000
}

interface ToastProps extends ToastItem {
  onDismiss: (id: string) => void;
}

export const Toast: React.FC<ToastProps> = ({
  id,
  type,
  message,
  actionLabel,
  onAction,
  duration = 5000,
  onDismiss,
}) => {
  const isError = type === "error";
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const remainingRef = useRef<number>(duration);
  const startTimeRef = useRef<number>(Date.now());

  const startTimer = () => {
    startTimeRef.current = Date.now();
    timerRef.current = setTimeout(() => {
      onDismiss(id);
    }, remainingRef.current);
  };

  const pauseTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
      const elapsed = Date.now() - startTimeRef.current;
      remainingRef.current = Math.max(0, remainingRef.current - elapsed);
    }
  };

  useEffect(() => {
    startTimer();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const getIcon = () => {
    switch (type) {
      case "success":
        return <CheckCircle2 size={16} stroke="currentColor" />;
      case "error":
        return <AlertCircle size={16} stroke="currentColor" />;
      case "info":
      case "neutral":
      default:
        return <Info size={16} stroke="currentColor" />;
    }
  };

  return (
    <div
      className={`plugin-toast toast-${type}`}
      role={isError ? "alert" : "status"}
      aria-live={isError ? "assertive" : "polite"}
      onMouseEnter={pauseTimer}
      onMouseLeave={startTimer}
      onFocus={pauseTimer}
      onBlur={startTimer}
    >
      <div className="toast-icon" aria-hidden="true">
        {getIcon()}
      </div>

      <span className="toast-message" title={message}>
        {message}
      </span>

      {actionLabel && onAction && (
        <button
          type="button"
          className="toast-action"
          onClick={() => {
            onAction();
            onDismiss(id);
          }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};

/* --------------------------------------------------------------------------
   Toast Context & Hook (Lightweight, Drop-in Toast Provider)
   -------------------------------------------------------------------------- */
interface ToastContextValue {
  show: (toast: Omit<ToastItem, "id">) => string;
  success: (message: string, options?: { actionLabel?: string; onAction?: () => void; duration?: number }) => string;
  error: (message: string, options?: { actionLabel?: string; onAction?: () => void; duration?: number }) => string;
  info: (message: string, options?: { actionLabel?: string; onAction?: () => void; duration?: number }) => string;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const show = (toast: Omit<ToastItem, "id">) => {
    const id = "toast_" + Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { ...toast, id }]);
    return id;
  };

  const success = (message: string, options?: { actionLabel?: string; onAction?: () => void; duration?: number }) => {
    return show({ type: "success", message, ...options });
  };

  const error = (message: string, options?: { actionLabel?: string; onAction?: () => void; duration?: number }) => {
    return show({ type: "error", message, ...options });
  };

  const info = (message: string, options?: { actionLabel?: string; onAction?: () => void; duration?: number }) => {
    return show({ type: "info", message, ...options });
  };

  return (
    <ToastContext.Provider value={{ show, success, error, info, dismiss }}>
      {children}
      {toasts.length > 0 && (
        <div className="toast-viewport" aria-label="Notifications">
          {toasts.map((t) => (
            <Toast key={t.id} {...t} onDismiss={dismiss} />
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextValue => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
};
```




