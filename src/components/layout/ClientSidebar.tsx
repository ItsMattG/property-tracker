"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

const Sidebar = dynamic(
  () => import("@/components/layout/Sidebar").then((m) => m.Sidebar),
  {
    ssr: false,
    loading: () => (
      <div className="w-56 xl:w-64 border-r border-border bg-card h-screen shrink-0">
        <Skeleton className="h-full w-full" />
      </div>
    ),
  }
);

export function ClientSidebar() {
  return <Sidebar />;
}
