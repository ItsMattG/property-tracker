"use client";

import { useState } from "react";
import { UserButton } from "@clerk/nextjs";
import { QuickAddButton } from "./QuickAddButton";
import { AlertBadge } from "@/components/alerts/AlertBadge";
import { WhatsNewButton } from "@/components/changelog/WhatsNewButton";
import { WhatsNewDrawer } from "@/components/changelog/WhatsNewDrawer";
import { HelpButton } from "@/components/onboarding/HelpButton";

export function Header() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      <header className="h-16 border-b border-border bg-card px-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Dashboard</h1>
        </div>
        <div className="flex items-center gap-4" data-tour="quick-actions">
          <HelpButton />
          <AlertBadge />
          <WhatsNewButton onClick={() => setDrawerOpen(true)} />
          <QuickAddButton />
          <UserButton afterSignOutUrl="/" />
        </div>
      </header>
      <WhatsNewDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}
