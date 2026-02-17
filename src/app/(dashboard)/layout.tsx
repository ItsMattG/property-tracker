import { Header } from "@/components/layout/Header";
import { ChatProvider } from "@/components/chat/ChatProvider";
import { ChatButton } from "@/components/chat/ChatButton";
import { LazyChatPanel } from "@/components/chat/LazyChatPanel";
import { SidebarProvider } from "@/components/layout/SidebarProvider";
import { ClientSidebar } from "@/components/layout/ClientSidebar";
import { featureFlags } from "@/config/feature-flags";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { FinancialYearProvider } from "@/providers/FinancialYearProvider";
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
          __html: `(function(){try{var t=localStorage.getItem("bricktrack-theme");var d=t==="system"?window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"forest":t;if(d==="dark"){document.documentElement.setAttribute("data-theme","dark");document.documentElement.classList.add("dark")}else{document.documentElement.removeAttribute("data-theme");document.documentElement.classList.remove("dark")}}catch(e){}})()`,
        }}
      />
      <FinancialYearProvider>
      <ChatProvider>
        <SidebarProvider>
          <div className="flex min-h-screen">
            <div className="hidden md:block">
              <ClientSidebar />
            </div>
            <div className="flex-1 flex flex-col min-w-0">
              <Header />
              <main className="flex-1 p-6 bg-secondary">{children}</main>
            </div>
          </div>
        </SidebarProvider>
        {featureFlags.aiAssistant && <ChatButton />}
        {featureFlags.aiAssistant && <LazyChatPanel />}
      </ChatProvider>
      </FinancialYearProvider>
    </ThemeProvider>
  );
}
