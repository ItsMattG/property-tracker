"use client";

import { useEffect } from "react";

export type Theme = "forest" | "dark";

const STORAGE_KEY = "bricktrack-theme";

export function ThemeProvider({
  theme,
  children,
}: {
  theme?: string | null;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const resolved = (theme as Theme) || "forest";
    if (resolved === "forest") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", resolved);
    }
    localStorage.setItem(STORAGE_KEY, resolved);

    return () => {
      document.documentElement.removeAttribute("data-theme");
    };
  }, [theme]);

  return <>{children}</>;
}

export function applyTheme(theme: Theme) {
  if (theme === "forest") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", theme);
  }
  localStorage.setItem(STORAGE_KEY, theme);
}
