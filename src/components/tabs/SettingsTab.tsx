import React from "react";
import { FieldRow, FieldRows, Segmented } from "../ui";
import type { ThemePreference } from "../../hooks/useFramerTheme";

export interface SettingsTabProps {
  themePreference: ThemePreference;
  onChangeThemePreference: (preference: ThemePreference) => void;
}

const THEME_OPTIONS = [
  { value: "auto", label: "Auto" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
] as const satisfies ReadonlyArray<{ value: ThemePreference; label: string }>;

/**
 * Mostly a placeholder. The gateway key vault, telemetry toggle, and locale
 * picker land here later, along with this tab's one primary CTA, "Save settings".
 *
 * The theme switcher is here now because it is the only way to exercise the
 * theme hook from PRD task 0.6, and it applies instantly so it needs no Save.
 */
export const SettingsTab: React.FC<SettingsTabProps> = ({
  themePreference,
  onChangeThemePreference,
}) => (
  <div className="tab-panel-body">
    <FieldRows>
      <FieldRow label="Panel theme" fill>
        <Segmented
          label="Panel theme"
          options={THEME_OPTIONS}
          value={themePreference}
          onChange={onChangeThemePreference}
        />
      </FieldRow>
    </FieldRows>
  </div>
);
