"use client";

import { UserButton } from "@clerk/nextjs";
import { QuickAddButton } from "./QuickAddButton";

export function Header() {
  return (
    <header className="h-16 border-b border-border bg-card px-6 flex items-center justify-between">
      <div>
        <h1 className="text-lg font-semibold">Dashboard</h1>
      </div>
      <div className="flex items-center gap-4">
        <QuickAddButton />
        <UserButton afterSignOutUrl="/" />
      </div>
    </header>
  );
}
