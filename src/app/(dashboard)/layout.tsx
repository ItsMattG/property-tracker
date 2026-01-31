import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { ChatProvider } from "@/components/chat/ChatProvider";
import { ChatButton } from "@/components/chat/ChatButton";
import nextDynamic from "next/dynamic";

const ChatPanel = nextDynamic(
  () => import("@/components/chat/ChatPanel").then((m) => ({ default: m.ChatPanel })),
  { ssr: false }
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
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <Header />
          <main className="flex-1 p-6 bg-secondary">{children}</main>
        </div>
      </div>
      <ChatButton />
      <ChatPanel />
    </ChatProvider>
  );
}
