import { getServerTRPC } from "@/lib/trpc/server";
import { DashboardClient } from "@/components/dashboard/DashboardClient";

export default async function DashboardPage() {
  let initialStats = null;

  try {
    const trpc = await getServerTRPC();
    initialStats = await trpc.stats.dashboard();
  } catch {
    // User might not be authenticated yet, client will handle
  }

  return <DashboardClient initialStats={initialStats} />;
}
