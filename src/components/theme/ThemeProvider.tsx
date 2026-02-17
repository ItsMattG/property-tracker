"use client";

import { useEffect } from "react";

export type Theme = "forest" | "dark" | "system";

export const STORAGE_KEY = "bricktrack-theme";

/**
 * Resolves the effective visual theme from user preference + OS setting.
 * "system" defers to the OS prefers-color-scheme media query.
 */
export function resolveEffectiveTheme(theme: Theme): "forest" | "dark" {
  if (theme === "system") {
    if (typeof window === "undefined") return "forest";
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "forest";
  }
  return theme;
}

/**
 * Applies the resolved theme to the DOM (data-theme attribute + dark class).
 * The `dark` class enables Tailwind `dark:` utility variants.
 */
function applyThemeToDOM(effective: "forest" | "dark") {
  const el = document.documentElement;
  if (effective === "dark") {
    el.setAttribute("data-theme", "dark");
    el.classList.add("dark");
  } else {
    el.removeAttribute("data-theme");
    el.classList.remove("dark");
  }
}

/**
 * Applies a theme choice: saves to localStorage and updates the DOM.
 * For "system", resolves the effective theme from OS preference.
 */
export function applyTheme(theme: Theme) {
  localStorage.setItem(STORAGE_KEY, theme);
  applyThemeToDOM(resolveEffectiveTheme(theme));
}

export function ThemeProvider({
  theme,
  children,
}: {
  theme?: string | null;
  children: React.ReactNode;
}) {
  useEffect(() => {
    // Prefer localStorage (always current) over server session (may be cached)
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    const resolved = stored || (theme as Theme) || "forest";
    localStorage.setItem(STORAGE_KEY, resolved);
    applyThemeToDOM(resolveEffectiveTheme(resolved));

    // Listen for OS color scheme changes when theme is "system"
    if (resolved === "system") {
      const mql = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = (e: MediaQueryListEvent) => {
        applyThemeToDOM(e.matches ? "dark" : "forest");
      };
      mql.addEventListener("change", handler);
      return () => mql.removeEventListener("change", handler);
    }
  }, [theme]);

  return <>{children}</>;
}
