import { getServerTRPC } from "@/lib/trpc/server";
import { DashboardClient } from "@/components/dashboard/DashboardClient";
import { AdvisorDashboard } from "@/components/dashboard/AdvisorDashboard";

export default async function DashboardPage() {
  let initialStats = null;
  let advisorPortfolios: { ownerId: string; ownerName: string; role: string }[] = [];
  let isAdvisorOnly = false;

  try {
    const trpc = await getServerTRPC();
    const [stats, portfolios] = await Promise.all([
      trpc.stats.dashboard().catch(() => null),
      trpc.team.getAccessiblePortfolios().catch(() => []),
    ]);
    initialStats = stats;
    advisorPortfolios = portfolios.filter(
      (p) => p.role === "accountant" || p.role === "advisor"
    );
    // Show advisor dashboard if user has NO own properties and IS an advisor
    isAdvisorOnly = !stats && advisorPortfolios.length > 0;
  } catch {
    // User might not be authenticated yet, client will handle
  }

  if (isAdvisorOnly) {
    return <AdvisorDashboard portfolios={advisorPortfolios} />;
  }

  return <DashboardClient initialStats={initialStats} />;
}
