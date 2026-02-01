import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { ChatProvider } from "@/components/chat/ChatProvider";
import { ChatButton } from "@/components/chat/ChatButton";
import { LazyChatPanel } from "@/components/chat/LazyChatPanel";
import { SidebarProvider } from "@/components/layout/SidebarProvider";
import { GoogleMapsProvider } from "@/components/providers/GoogleMapsProvider";

// All dashboard pages require auth - skip static generation
export const dynamic = "force-dynamic";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <GoogleMapsProvider>
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
        <ChatButton />
        <LazyChatPanel />
      </ChatProvider>
    </GoogleMapsProvider>
  );
}
