import { useEffect, useState, useCallback } from "react";
import { FramerThemeMode } from "../types";

/**
 * useFramerTheme
 * Synchronizes the plugin UI with Framer's workspace theme (Light/Dark).
 * Automatically sets data-framer-theme and data-user-theme attributes on document.body.
 */
export function useFramerTheme(): {
  theme: FramerThemeMode;
  setTheme: (theme: FramerThemeMode) => void;
  toggleTheme: () => void;
} {
  const [theme, setThemeState] = useState<FramerThemeMode>(() => {
    // Check initial body attribute or local storage preference
    const existingTheme = document.body.getAttribute("data-framer-theme") as FramerThemeMode | null;
    if (existingTheme === "light" || existingTheme === "dark") {
      return existingTheme;
    }
    const saved = localStorage.getItem("memberframe_theme_override") as FramerThemeMode | null;
    if (saved === "light" || saved === "dark") {
      return saved;
    }
    return "dark"; // Default Framer plugin theme
  });

  const applyThemeToDOM = useCallback((newTheme: FramerThemeMode) => {
    document.body.setAttribute("data-framer-theme", newTheme);
    document.documentElement.setAttribute("data-user-theme", newTheme);
    setThemeState(newTheme);
  }, []);

  const setTheme = useCallback((newTheme: FramerThemeMode) => {
    localStorage.setItem("memberframe_theme_override", newTheme);
    applyThemeToDOM(newTheme);
  }, [applyThemeToDOM]);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  useEffect(() => {
    // Initial DOM attribute sync
    applyThemeToDOM(theme);

    // Listen for OS or parent theme changes if no explicit user override
    const mediaQuery = window.matchMedia("(prefers-color-scheme: light)");
    const handler = (e: MediaQueryListEvent) => {
      const userOverride = localStorage.getItem("memberframe_theme_override");
      if (!userOverride) {
        applyThemeToDOM(e.matches ? "light" : "dark");
      }
    };

    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, [theme, applyThemeToDOM]);

  return { theme, setTheme, toggleTheme };
}
