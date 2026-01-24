"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PortfolioToolbar } from "@/components/portfolio/PortfolioToolbar";
import { PortfolioCard } from "@/components/portfolio/PortfolioCard";
import { AddPropertyValueDialog } from "@/components/portfolio/AddPropertyValueDialog";
import { ComparisonTable } from "@/components/portfolio/ComparisonTable";
import { AggregatedView } from "@/components/portfolio/AggregatedView";
import { trpc } from "@/lib/trpc/client";
import { Plus, Building2 } from "lucide-react";

type ViewMode = "cards" | "table" | "aggregate";
type Period = "monthly" | "quarterly" | "annual";
type SortBy = "cashFlow" | "equity" | "lvr" | "alphabetical";

export default function PortfolioPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const viewMode = (searchParams.get("view") as ViewMode) || "cards";
  const period = (searchParams.get("period") as Period) || "monthly";
  const sortBy = (searchParams.get("sortBy") as SortBy) || "alphabetical";
  const stateFilter = searchParams.get("state") || undefined;
  const statusFilter = searchParams.get("status") || undefined;

  const [valueDialogOpen, setValueDialogOpen] = useState(false);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);

  const updateParams = (updates: Record<string, string | undefined>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (value === undefined) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });
    router.push(`/portfolio?${params.toString()}`);
  };

  const { data: metrics, isLoading, refetch } = trpc.portfolio.getPropertyMetrics.useQuery({
    period,
    sortBy,
    sortOrder: "desc",
    state: stateFilter,
    status: statusFilter as "active" | "sold" | undefined,
  });

  const { data: summary } = trpc.portfolio.getSummary.useQuery({
    period,
    state: stateFilter,
    status: statusFilter as "active" | "sold" | undefined,
  });

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

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Portfolio</h2>
          <p className="text-muted-foreground">Overview of your investment properties</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-64 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
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
          {metrics && metrics.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {metrics.map((property) => (
                <PortfolioCard
                  key={property.propertyId}
                  property={property}
                  onUpdateValue={handleUpdateValue}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Building2 className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold">No properties yet</h3>
              <p className="text-muted-foreground max-w-sm mt-2">
                Add your first investment property to start tracking your portfolio.
              </p>
              <Button asChild className="mt-4">
                <Link href="/properties/new">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Your First Property
                </Link>
              </Button>
            </div>
          )}
        </>
      )}

      {viewMode === "table" && metrics && (
        <ComparisonTable
          properties={metrics}
          onExport={handleExportCSV}
        />
      )}

      {viewMode === "aggregate" && summary && metrics && (
        <AggregatedView
          summary={summary}
          properties={metrics}
          period={period}
        />
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
