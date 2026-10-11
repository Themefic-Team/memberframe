import { useCallback, useEffect, useState } from "react";

/**
 * PRD task 0.6. Theme sync for the plugin panel.
 *
 * Framer owns `body[data-framer-theme]`: the SDK writes it and rewrites it when
 * the workspace theme changes. The plugin owns `data-user-theme`, which lets a
 * creator pin the panel to light or dark from the Settings tab regardless of the
 * workspace. Both are honored, per `.agents/rules/framer-sdd-standards.md`.
 *
 * The override attribute is written to BOTH <html> and <body>. That is not
 * redundant. The copied token CSS expresses the light layer as
 *
 *   body[data-framer-theme="light"]:not([data-user-theme="dark"])   (0,2,1)
 *
 * and the forced-dark layer as
 *
 *   html[data-user-theme="dark"] body                               (0,1,2)
 *
 * The light selector has the higher specificity, so with the attribute on
 * <html> alone, "workspace light plus user picks dark" would resolve to light.
 * Writing it to <body> too makes the `:not()` fail, which is what the selector
 * was reaching for. See the note in docs/development-docs/00-plugin-shell.md.
 */

export type ThemeMode = "light" | "dark";
export type ThemePreference = ThemeMode | "auto";

const PREFERENCE_STORAGE_KEY = "memberframe.theme-preference";
const FRAMER_THEME_ATTRIBUTE = "data-framer-theme";
const USER_THEME_ATTRIBUTE = "data-user-theme";

function isThemePreference(value: string | null): value is ThemePreference {
  return value === "light" || value === "dark" || value === "auto";
}

function readStoredPreference(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(PREFERENCE_STORAGE_KEY);
    return isThemePreference(stored) ? stored : "auto";
  } catch {
    // Storage can be unavailable in a restricted iframe. Fall back to auto.
    return "auto";
  }
}

function readFramerTheme(): ThemeMode {
  return document.body.getAttribute(FRAMER_THEME_ATTRIBUTE) === "light" ? "light" : "dark";
}

function writeOverrideAttribute(preference: ThemePreference): void {
  const targets = [document.documentElement, document.body];

  for (const target of targets) {
    if (preference === "auto") {
      target.removeAttribute(USER_THEME_ATTRIBUTE);
    } else {
      target.setAttribute(USER_THEME_ATTRIBUTE, preference);
    }
  }
}

export interface FramerTheme {
  /** What the Framer workspace currently reports. */
  framerTheme: ThemeMode;
  /** The creator's override. "auto" follows the workspace. */
  preference: ThemePreference;
  /** The theme actually on screen, after the override is applied. */
  theme: ThemeMode;
  setPreference: (preference: ThemePreference) => void;
}

export function useFramerTheme(): FramerTheme {
  const [framerTheme, setFramerTheme] = useState<ThemeMode>(readFramerTheme);
  const [preference, setPreferenceState] = useState<ThemePreference>(readStoredPreference);

  // Framer rewrites the attribute on <body> when the workspace theme changes.
  // There is no public SDK theme event, so observe the attribute directly.
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setFramerTheme(readFramerTheme());
    });

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: [FRAMER_THEME_ATTRIBUTE],
    });

    // Framer may have written the attribute between first render and this effect.
    setFramerTheme(readFramerTheme());

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    writeOverrideAttribute(preference);
  }, [preference]);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);

    try {
      if (next === "auto") {
        window.localStorage.removeItem(PREFERENCE_STORAGE_KEY);
      } else {
        window.localStorage.setItem(PREFERENCE_STORAGE_KEY, next);
      }
    } catch {
      // A failed write only costs the preference on next open. Do not break the UI.
    }
  }, []);

  return {
    framerTheme,
    preference,
    theme: preference === "auto" ? framerTheme : preference,
    setPreference,
  };
}
