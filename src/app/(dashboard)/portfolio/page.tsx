"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PortfolioToolbar } from "@/components/portfolio/PortfolioToolbar";
import { PortfolioEquityCard } from "@/components/portfolio/PortfolioEquityCard";
import { PortfolioCard } from "@/components/portfolio/PortfolioCard";
import { AddPropertyValueDialog } from "@/components/portfolio/AddPropertyValueDialog";
import { ComparisonTable } from "@/components/portfolio/ComparisonTable";
import { AggregatedView } from "@/components/portfolio/AggregatedView";
import { trpc } from "@/lib/trpc/client";
import { Plus, Building2 } from "lucide-react";
import { useTour } from "@/hooks/useTour";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { getErrorMessage } from "@/lib/errors";
import { PropertyListSkeleton } from "@/components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

type ViewMode = "cards" | "table" | "aggregate";
type Period = "monthly" | "quarterly" | "annual";
type SortBy = "cashFlow" | "equity" | "lvr" | "alphabetical";

function PortfolioContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  useTour({ tourId: "portfolio" });

  const viewMode = (searchParams?.get("view") as ViewMode) || "cards";
  const period = (searchParams?.get("period") as Period) || "monthly";
  const sortBy = (searchParams?.get("sortBy") as SortBy) || "alphabetical";
  const stateFilter = searchParams?.get("state") || undefined;
  const statusFilter = searchParams?.get("status") || undefined;

  const [valueDialogOpen, setValueDialogOpen] = useState(false);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);

  const updateParams = (updates: Record<string, string | undefined>) => {
    const params = new URLSearchParams(searchParams?.toString() || "");
    Object.entries(updates).forEach(([key, value]) => {
      if (value === undefined) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });
    router.push(`/portfolio?${params.toString()}`);
  };

  const { data: metrics, isLoading, isError, error, refetch } = trpc.portfolio.getPropertyMetrics.useQuery(
    {
      period,
      sortBy,
      sortOrder: "desc",
      state: stateFilter,
      status: statusFilter as "active" | "sold" | undefined,
    },
    {
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false,
    }
  );

  const { data: summary } = trpc.portfolio.getSummary.useQuery(
    {
      period,
      state: stateFilter,
      status: statusFilter as "active" | "sold" | undefined,
    },
    {
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false,
    }
  );

  const handleUpdateValue = (propertyId: string) => {
    setSelectedPropertyId(propertyId);
    setValueDialogOpen(true);
  };

  const handleExportCSV = () => {
    if (!metrics) return;

    const headers = ["Property", "Purchase Price", "Current Value", "Equity", "LVR", "Cash Flow"];
    const rows = metrics.map((p) => [
      `${p.suburb}, ${p.state}`,
      p.purchasePrice,
      p.currentValue,
      p.equity,
      p.lvr?.toFixed(1) ?? "",
      p.cashFlow,
    ]);
    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "portfolio-comparison.csv";
    a.click();
  };

  if (isError) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Portfolio</h2>
          <p className="text-muted-foreground">Overview of your investment properties</p>
        </div>
        <ErrorState message={getErrorMessage(error)} onRetry={() => refetch()} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Portfolio</h2>
          <p className="text-muted-foreground">Overview of your investment properties</p>
        </div>
        <Button asChild>
          <Link href="/properties/new">
            <Plus className="w-4 h-4 mr-2" />
            Add Property
          </Link>
        </Button>
      </div>

      {/* Equity summary card - show skeleton while loading */}
      <div data-tour="portfolio-summary">
        {isLoading ? (
          <div className="border rounded-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-6 w-24" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-8 w-28" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-8 w-28" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-8 w-28" />
              </div>
            </div>
          </div>
        ) : summary ? (
          <PortfolioEquityCard
            totalValue={summary.totalValue}
            totalLoans={summary.totalDebt}
            propertyCount={metrics?.length ?? 0}
          />
        ) : null}
      </div>

      <PortfolioToolbar
        viewMode={viewMode}
        onViewModeChange={(mode) => updateParams({ view: mode })}
        period={period}
        onPeriodChange={(p) => updateParams({ period: p })}
        sortBy={sortBy}
        onSortByChange={(s) => updateParams({ sortBy: s })}
        stateFilter={stateFilter}
        onStateFilterChange={(s) => updateParams({ state: s })}
        statusFilter={statusFilter}
        onStatusFilterChange={(s) => updateParams({ status: s })}
      />

      {viewMode === "cards" && (
        <>
          {isLoading ? (
            <PropertyListSkeleton count={3} />
          ) : metrics && metrics.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" data-tour="property-cards">
              {metrics.map((property) => (
                <PortfolioCard
                  key={property.propertyId}
                  property={property}
                  onUpdateValue={handleUpdateValue}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Building2}
              title="No properties yet"
              description="Add your first investment property to start tracking your portfolio."
              action={{
                label: "Add Your First Property",
                onClick: () => window.location.href = "/properties/new",
              }}
            />
          )}
        </>
      )}

      {viewMode === "table" && (
        isLoading ? (
          <PropertyListSkeleton count={3} />
        ) : metrics ? (
          <ComparisonTable
            properties={metrics}
            onExport={handleExportCSV}
          />
        ) : null
      )}

      {viewMode === "aggregate" && (
        isLoading ? (
          <PropertyListSkeleton count={3} />
        ) : summary && metrics ? (
          <AggregatedView
            summary={summary}
            properties={metrics}
            period={period}
          />
        ) : null
      )}

      <AddPropertyValueDialog
        open={valueDialogOpen}
        onOpenChange={setValueDialogOpen}
        propertyId={selectedPropertyId}
        onSuccess={() => {
          refetch();
          setValueDialogOpen(false);
        }}
      />
    </div>
  );
}

function PortfolioLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Portfolio</h2>
          <p className="text-muted-foreground">Overview of your investment properties</p>
        </div>
        <Button asChild>
          <Link href="/properties/new">
            <Plus className="w-4 h-4 mr-2" />
            Add Property
          </Link>
        </Button>
      </div>
      {/* Equity summary skeleton */}
      <div className="border rounded-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-6 w-24" />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-8 w-28" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-8 w-28" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-8 w-28" />
          </div>
        </div>
      </div>
      {/* Toolbar placeholder */}
      <div className="flex gap-2">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-32" />
      </div>
      {/* Property cards skeleton */}
      <PropertyListSkeleton count={3} />
    </div>
  );
}

export default function PortfolioPage() {
  return (
    <Suspense fallback={<PortfolioLoading />}>
      <PortfolioContent />
    </Suspense>
  );
}
