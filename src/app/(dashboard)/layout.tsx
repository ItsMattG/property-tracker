import nextDynamic from "next/dynamic";
import { Header } from "@/components/layout/Header";
import { ChatProvider } from "@/components/chat/ChatProvider";
import { ChatButton } from "@/components/chat/ChatButton";
import { LazyChatPanel } from "@/components/chat/LazyChatPanel";
import { SidebarProvider } from "@/components/layout/SidebarProvider";
import { featureFlags } from "@/config/feature-flags";
import { Skeleton } from "@/components/ui/skeleton";

// Dynamically import Sidebar with no SSR to prevent hydration errors
// caused by localStorage reads (collapsed state, section open/close)
const Sidebar = nextDynamic(
  () => import("@/components/layout/Sidebar").then((m) => m.Sidebar),
  {
    ssr: false,
    loading: () => <div className="w-56 xl:w-64 border-r border-border bg-card h-screen shrink-0"><Skeleton className="h-full w-full" /></div>,
  }
);

// All dashboard pages require auth - skip static generation
export const dynamic = "force-dynamic";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ChatProvider>
      <SidebarProvider>
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="flex-1 flex flex-col">
            <Header />
            <main className="flex-1 p-6 bg-secondary">{children}</main>
          </div>
        </div>
      </SidebarProvider>
      {featureFlags.aiAssistant && <ChatButton />}
      {featureFlags.aiAssistant && <LazyChatPanel />}
    </ChatProvider>
  );
}
