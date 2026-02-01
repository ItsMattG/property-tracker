"use client";

import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "sidebar-collapsed";

export function useSidebarState() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  // Read from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "true") {
      setIsCollapsed(true);
    }
    setIsHydrated(true);
  }, []);

  // Persist to localStorage on change
  useEffect(() => {
    if (isHydrated) {
      localStorage.setItem(STORAGE_KEY, String(isCollapsed));
    }
  }, [isCollapsed, isHydrated]);

  const toggle = useCallback(() => {
    setIsCollapsed((prev) => !prev);
  }, []);

  return { isCollapsed, toggle, isHydrated };
}
