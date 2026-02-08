import { Header } from "@/components/layout/Header";
import { ChatProvider } from "@/components/chat/ChatProvider";
import { ChatButton } from "@/components/chat/ChatButton";
import { LazyChatPanel } from "@/components/chat/LazyChatPanel";
import { SidebarProvider } from "@/components/layout/SidebarProvider";
import { ClientSidebar } from "@/components/layout/ClientSidebar";
import { featureFlags } from "@/config/feature-flags";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { getAuthSession } from "@/lib/auth";

// All dashboard pages require auth - skip static generation
export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAuthSession();
  const theme = (session?.user as Record<string, unknown>)?.theme as string | null ?? null;

  return (
    <ThemeProvider theme={theme}>
      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){try{var t=localStorage.getItem("bricktrack-theme");if(t&&t!=="forest")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`,
        }}
      />
      <ChatProvider>
        <SidebarProvider>
          <div className="flex min-h-screen">
            <ClientSidebar />
            <div className="flex-1 flex flex-col">
              <Header />
              <main className="flex-1 p-6 bg-secondary">{children}</main>
            </div>
          </div>
        </SidebarProvider>
        {featureFlags.aiAssistant && <ChatButton />}
        {featureFlags.aiAssistant && <LazyChatPanel />}
      </ChatProvider>
    </ThemeProvider>
  );
}
