"use client";

import { useState } from "react";
import {
  Sparkles,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";

interface Insight {
  propertyId: string | null;
  category: string;
  severity: "positive" | "info" | "warning" | "critical";
  title: string;
  body: string;
}

const SEVERITY_STYLES: Record<string, { badge: string; label: string }> = {
  critical: {
    badge: "bg-destructive text-destructive-foreground",
    label: "Critical",
  },
  warning: {
    badge:
      "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
    label: "Warning",
  },
  info: {
    badge: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    label: "Info",
  },
  positive: {
    badge:
      "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    label: "Positive",
  },
};

const SEVERITY_ORDER = ["critical", "warning", "info", "positive"];

interface ScorecardInsightsProps {
  properties: Array<{ id: string; address: string }>;
}

export function ScorecardInsights({ properties }: ScorecardInsightsProps) {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.portfolio.getInsights.useQuery(undefined, {
    staleTime: 60_000,
  });

  const generateMutation = trpc.portfolio.generateInsights.useMutation({
    onSuccess: () => {
      utils.portfolio.getInsights.invalidate();
      toast.success("Insights refreshed");
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const [expandedProperties, setExpandedProperties] = useState<Set<string>>(
    new Set()
  );

  const handleToggleProperty = (propertyId: string) => {
    setExpandedProperties((prev) => {
      const next = new Set(prev);
      if (next.has(propertyId)) next.delete(propertyId);
      else next.add(propertyId);
      return next;
    });
  };

  const isGenerating = generateMutation.isPending;
  const insights: Insight[] = data?.insights ?? [];

  // Group by property
  const portfolioInsights = insights.filter((i) => !i.propertyId);
  const propertyInsightsMap = new Map<string, Insight[]>();
  for (const insight of insights) {
    if (insight.propertyId) {
      const existing = propertyInsightsMap.get(insight.propertyId) ?? [];
      existing.push(insight);
      propertyInsightsMap.set(insight.propertyId, existing);
    }
  }

  const sortBySeverity = (a: Insight, b: Insight) =>
    SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity);

  const [now] = useState(() => Date.now());
  const canRefresh =
    !data?.generatedAt ||
    new Date(data.generatedAt).getTime() < now - 60 * 60 * 1000;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            AI Insights
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => generateMutation.mutate()}
            disabled={isGenerating || !canRefresh}
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                {data?.stale ? "Generate" : "Refresh"}
              </>
            )}
          </Button>
        </div>
        {data?.generatedAt && (
          <p className="text-xs text-muted-foreground">
            Last updated{" "}
            {new Date(data.generatedAt).toLocaleString("en-AU", {
              day: "numeric",
              month: "short",
              hour: "numeric",
              minute: "2-digit",
            })}
            {!canRefresh && " \u2014 refresh available in 1 hour"}
          </p>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-12 bg-muted animate-pulse rounded" />
            ))}
          </div>
        ) : data?.stale || insights.length === 0 ? (
          <div className="py-8 text-center">
            <Sparkles className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              {data?.stale
                ? "Click Generate to analyze your portfolio with AI"
                : "No insights generated yet"}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Portfolio-level insights */}
            {portfolioInsights.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Portfolio
                </h4>
                {portfolioInsights.sort(sortBySeverity).map((insight, i) => (
                  <InsightRow key={`portfolio-${i}`} insight={insight} />
                ))}
              </div>
            )}

            {/* Per-property insights */}
            {properties
              .filter((p) => propertyInsightsMap.has(p.id))
              .map((property) => {
                const propInsights =
                  propertyInsightsMap.get(property.id) ?? [];
                const isExpanded = expandedProperties.has(property.id);

                return (
                  <div key={property.id} className="space-y-2">
                    <button
                      type="button"
                      onClick={() => handleToggleProperty(property.id)}
                      className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide hover:text-foreground transition-colors cursor-pointer w-full"
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                      {property.address}
                      <Badge
                        variant="secondary"
                        className="ml-auto text-[10px]"
                      >
                        {propInsights.length}
                      </Badge>
                    </button>
                    {isExpanded &&
                      propInsights
                        .sort(sortBySeverity)
                        .map((insight, i) => (
                          <InsightRow
                            key={`${property.id}-${i}`}
                            insight={insight}
                          />
                        ))}
                  </div>
                );
              })}
          </div>
        )}

        <p className="text-[10px] text-muted-foreground mt-4 leading-tight">
          AI-generated insights — verify with your financial advisor.
        </p>
      </CardContent>
    </Card>
  );
}

function InsightRow({ insight }: { insight: Insight }) {
  const style = SEVERITY_STYLES[insight.severity];
  return (
    <div className="flex items-start gap-2.5 py-1.5">
      <Badge className={cn("text-[10px] flex-shrink-0 mt-0.5", style?.badge)}>
        {style?.label ?? insight.severity}
      </Badge>
      <div className="min-w-0">
        <p className="text-sm font-medium">{insight.title}</p>
        <p className="text-xs text-muted-foreground">{insight.body}</p>
      </div>
    </div>
  );
}
