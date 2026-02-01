"use client";

import { createContext, useContext, useEffect } from "react";
import { useSidebarState } from "@/lib/hooks/useSidebarState";

type SidebarContextType = {
  isCollapsed: boolean;
  toggle: () => void;
  isHydrated: boolean;
};

const SidebarContext = createContext<SidebarContextType | null>(null);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const sidebarState = useSidebarState();

  // Keyboard shortcut: Cmd+\ or Ctrl+\
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "\\") {
        e.preventDefault();
        sidebarState.toggle();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [sidebarState]);

  return (
    <SidebarContext.Provider value={sidebarState}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within SidebarProvider");
  }
  return context;
}
