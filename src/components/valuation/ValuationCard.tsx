"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Plus, History, TrendingUp } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { AddValuationModal } from "./AddValuationModal";
import { ValuationHistoryModal } from "./ValuationHistoryModal";

interface ValuationCardProps {
  propertyId: string;
}

const formatCurrency = (value: string | number) => {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(num);
};

const getSourceLabel = (source: string): string => {
  const labels: Record<string, string> = {
    manual: "Manual",
    mock: "Estimated",
    corelogic: "CoreLogic",
    proptrack: "PropTrack",
  };
  return labels[source] || source;
};

const getSourceVariant = (source: string): "default" | "secondary" | "outline" => {
  switch (source) {
    case "corelogic":
    case "proptrack":
      return "default";
    case "manual":
      return "secondary";
    default:
      return "outline";
  }
};

const getDaysAgoText = (days: number): string => {
  if (days === 0) return "Today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
};

export function ValuationCard({ propertyId }: ValuationCardProps) {
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);

  const utils = trpc.useUtils();

  const { data, isLoading, error } = trpc.propertyValue.getCurrent.useQuery({
    propertyId,
  });

  const refreshMutation = trpc.propertyValue.refresh.useMutation({
    onSuccess: () => {
      utils.propertyValue.getCurrent.invalidate({ propertyId });
      utils.propertyValue.list.invalidate({ propertyId });
    },
  });

  const handleRefresh = () => {
    refreshMutation.mutate({ propertyId });
  };

  // Loading state
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-primary" />
            </div>
            <CardTitle className="text-lg">Current Valuation</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/2" />
            <div className="h-4 bg-muted rounded w-3/4" />
            <div className="flex gap-2">
              <div className="h-9 bg-muted rounded flex-1" />
              <div className="h-9 bg-muted rounded flex-1" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-destructive" />
            </div>
            <CardTitle className="text-lg">Current Valuation</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">Failed to load valuation data.</p>
        </CardContent>
      </Card>
    );
  }

  // Empty state - no valuation exists
  if (!data) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-primary" />
            </div>
            <CardTitle className="text-lg">Current Valuation</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            No valuation on record. Get an automated estimate or add your own.
          </p>
          <div className="flex gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshMutation.isPending}
            >
              {refreshMutation.isPending ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <TrendingUp className="w-4 h-4" />
              )}
              Get Estimate
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAddModalOpen(true)}
            >
              <Plus className="w-4 h-4" />
              Add Manual
            </Button>
          </div>
        </CardContent>

        <AddValuationModal
          propertyId={propertyId}
          open={addModalOpen}
          onOpenChange={setAddModalOpen}
          onSuccess={() => {
            utils.propertyValue.getCurrent.invalidate({ propertyId });
            utils.propertyValue.list.invalidate({ propertyId });
          }}
        />
      </Card>
    );
  }

  const { valuation, daysSinceUpdate } = data;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Current Valuation</CardTitle>
              <p className="text-xs text-muted-foreground">
                Updated {getDaysAgoText(daysSinceUpdate)}
              </p>
            </div>
          </div>
          <Badge variant={getSourceVariant(valuation.source)}>
            {getSourceLabel(valuation.source)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {/* Main value */}
        <div className="mb-4">
          <p className="text-3xl font-bold">
            {formatCurrency(valuation.estimatedValue)}
          </p>
          {valuation.confidenceLow && valuation.confidenceHigh && (
            <p className="text-sm text-muted-foreground">
              Range: {formatCurrency(valuation.confidenceLow)} -{" "}
              {formatCurrency(valuation.confidenceHigh)}
            </p>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshMutation.isPending}
          >
            {refreshMutation.isPending ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAddModalOpen(true)}
          >
            <Plus className="w-4 h-4" />
            Add Manual
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setHistoryModalOpen(true)}
          >
            <History className="w-4 h-4" />
            History
          </Button>
        </div>
      </CardContent>

      <AddValuationModal
        propertyId={propertyId}
        open={addModalOpen}
        onOpenChange={setAddModalOpen}
        onSuccess={() => {
          utils.propertyValue.getCurrent.invalidate({ propertyId });
          utils.propertyValue.list.invalidate({ propertyId });
        }}
      />
      <ValuationHistoryModal
        propertyId={propertyId}
        open={historyModalOpen}
        onOpenChange={setHistoryModalOpen}
      />
    </Card>
  );
}
