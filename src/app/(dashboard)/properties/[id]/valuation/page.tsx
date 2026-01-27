"use client";

import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc/client";
import { ValuationOverviewCard } from "@/components/property/valuation-overview-card";
import { CapitalGrowthStats } from "@/components/property/capital-growth-stats";
import { ValuationChart } from "@/components/property/valuation-chart";

export default function PropertyValuationPage() {
  const params = useParams();
  const router = useRouter();
  const propertyId = params?.id as string;

  const { data: property, isLoading } = trpc.property.get.useQuery(
    { id: propertyId },
    { enabled: !!propertyId }
  );

  const { data: stats, isLoading: statsLoading } = trpc.propertyValue.getCapitalGrowthStats.useQuery(
    { propertyId },
    { enabled: !!propertyId }
  );

  const { data: history, isLoading: historyLoading } = trpc.propertyValue.getValuationHistory.useQuery(
    { propertyId },
    { enabled: !!propertyId }
  );

  const utils = trpc.useUtils();

  const backfillMutation = trpc.propertyValue.triggerBackfill.useMutation({
    onSuccess: () => {
      utils.propertyValue.getValuationHistory.invalidate({ propertyId });
      utils.propertyValue.getCapitalGrowthStats.invalidate({ propertyId });
      utils.propertyValue.getCurrent.invalidate({ propertyId });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!property) {
    return (
      <div className="text-center py-12">
        <h2 className="text-lg font-semibold">Property not found</h2>
        <p className="text-muted-foreground mt-1">
          The property you&apos;re looking for doesn&apos;t exist or you don&apos;t have access.
        </p>
        <Button variant="outline" className="mt-4" onClick={() => router.push("/properties")}>
          Back to Properties
        </Button>
      </div>
    );
  }

  const showBackfill = !historyLoading && (!history || history.length <= 2);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Valuation</h1>
            <p className="text-muted-foreground">
              {property.address}, {property.suburb}
            </p>
          </div>
        </div>
        {showBackfill && (
          <Button
            variant="outline"
            onClick={() => backfillMutation.mutate({ propertyId })}
            disabled={backfillMutation.isPending}
          >
            {backfillMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <TrendingUp className="h-4 w-4 mr-2" />
            )}
            Generate History
          </Button>
        )}
      </div>

      {/* Current Value + Growth Stats */}
      <ValuationOverviewCard stats={stats} isLoading={statsLoading} />

      {/* Capital Growth Stats Row */}
      <CapitalGrowthStats stats={stats} isLoading={statsLoading} />

      {/* Historical Chart */}
      <ValuationChart
        history={history ?? []}
        purchasePrice={Number(property.purchasePrice)}
        isLoading={historyLoading}
      />
    </div>
  );
}
