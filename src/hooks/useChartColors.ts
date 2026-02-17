"use client";

import { useEffect, useState } from "react";

interface ChartColors {
  chart1: string;
  chart2: string;
  chart3: string;
  chart4: string;
  chart5: string;
  success: string;
  danger: string;
  info: string;
  gridStroke: string;
  tooltipBg: string;
  tooltipBorder: string;
  textMuted: string;
}

function readColors(): ChartColors {
  const style = getComputedStyle(document.documentElement);
  const get = (name: string) => style.getPropertyValue(name).trim();
  return {
    chart1: get("--chart-1") || "#16A34A",
    chart2: get("--chart-2") || "#2563EB",
    chart3: get("--chart-3") || "#D97706",
    chart4: get("--chart-4") || "#7C3AED",
    chart5: get("--chart-5") || "#EC4899",
    success: get("--color-success") || "#10b981",
    danger: get("--color-danger") || "#ef4444",
    info: get("--color-info") || "#3b82f6",
    gridStroke: get("--border-light") || "#e5e7eb",
    tooltipBg: get("--bg-card") || "#ffffff",
    tooltipBorder: get("--border-light") || "#e5e7eb",
    textMuted: get("--text-muted") || "#636b75",
  };
}

const DEFAULT_COLORS: ChartColors = {
  chart1: "#16A34A",
  chart2: "#2563EB",
  chart3: "#D97706",
  chart4: "#7C3AED",
  chart5: "#EC4899",
  success: "#10b981",
  danger: "#ef4444",
  info: "#3b82f6",
  gridStroke: "#e5e7eb",
  tooltipBg: "#ffffff",
  tooltipBorder: "#e5e7eb",
  textMuted: "#636b75",
};

/**
 * Reads chart colors from CSS custom properties and reacts to theme changes.
 * Replaces hardcoded hex colors in Recharts components.
 */
export function useChartColors(): ChartColors {
  const [colors, setColors] = useState<ChartColors>(DEFAULT_COLORS);

  useEffect(() => {
    // Read initial colors after CSS variables are resolved
    setColors(readColors());

    // Re-read when theme changes (class or data-theme attribute mutation on <html>)
    const observer = new MutationObserver(() => {
      // Small delay to let CSS variables update
      requestAnimationFrame(() => setColors(readColors()));
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme"],
    });
    return () => observer.disconnect();
  }, []);

  return colors;
}
