import { getServerTRPC } from "@/lib/trpc/server";
import { DashboardClient } from "@/components/dashboard/DashboardClient";
import { AdvisorDashboard } from "@/components/dashboard/AdvisorDashboard";

export default async function DashboardPage() {
  let initialData = null;
  let advisorPortfolios: { ownerId: string; ownerName: string; role: string }[] = [];
  let isAdvisorOnly = false;

  try {
    const trpc = await getServerTRPC();
    const [dashboardData, portfolios] = await Promise.all([
      trpc.dashboard.getInitialData().catch(() => null),
      trpc.team.getAccessiblePortfolios().catch(() => []),
    ]);
    initialData = dashboardData;
    advisorPortfolios = portfolios.filter(
      (p) => p.role === "accountant" || p.role === "advisor"
    );
    // Show advisor dashboard if user has NO own properties and IS an advisor
    isAdvisorOnly = !dashboardData?.stats && advisorPortfolios.length > 0;
  } catch {
    // User might not be authenticated yet, client will handle
  }

  if (isAdvisorOnly) {
    return <AdvisorDashboard portfolios={advisorPortfolios} />;
  }

  // Next.js serializes Date objects to strings at the RSC→client boundary,
  // so the runtime value matches the client-side inferred type
  return <DashboardClient initialData={initialData as Parameters<typeof DashboardClient>[0]["initialData"]} />;
}
