"use client";

import { useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { applyTheme, STORAGE_KEY, type Theme } from "./ThemeProvider";

const CYCLE_ORDER: Theme[] = ["forest", "dark", "system"];

const THEME_CONFIG: Record<Theme, { icon: typeof Sun; label: string; ariaLabel: string }> = {
  forest: { icon: Sun, label: "Light mode", ariaLabel: "Switch to dark mode" },
  dark: { icon: Moon, label: "Dark mode", ariaLabel: "Switch to system mode" },
  system: { icon: Monitor, label: "System mode", ariaLabel: "Switch to light mode" },
};

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
      if (stored && CYCLE_ORDER.includes(stored)) return stored;
    }
    return "forest";
  });

  const handleCycle = () => {
    const currentIndex = CYCLE_ORDER.indexOf(theme);
    const nextTheme = CYCLE_ORDER[(currentIndex + 1) % CYCLE_ORDER.length];
    applyTheme(nextTheme);
    setTheme(nextTheme);
  };

  const config = THEME_CONFIG[theme];
  const Icon = config.icon;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleCycle}
          aria-label={config.ariaLabel}
          className="h-8 w-8"
        >
          <Icon className="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{config.label}</TooltipContent>
    </Tooltip>
  );
}
