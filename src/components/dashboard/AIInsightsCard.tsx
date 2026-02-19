"use client";

import Link from "next/link";
import { Sparkles, ArrowRight, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";

const SEVERITY_DOT: Record<string, string> = {
  critical: "bg-destructive",
  warning: "bg-amber-500",
  info: "bg-blue-500",
  positive: "bg-green-500",
};

function timeAgo(date: Date | string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(date).getTime()) / 1000
  );
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function AIInsightsCard() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.portfolio.getInsights.useQuery(undefined, {
    staleTime: 60_000,
  });

  const generateMutation = trpc.portfolio.generateInsights.useMutation({
    onSuccess: () => {
      utils.portfolio.getInsights.invalidate();
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const isGenerating = generateMutation.isPending;

  // Top 3 insights by severity priority
  const severityOrder = ["critical", "warning", "info", "positive"];
  const topInsights = data?.insights
    ? [...data.insights]
        .sort(
          (a, b) =>
            severityOrder.indexOf(a.severity) -
            severityOrder.indexOf(b.severity)
        )
        .slice(0, 3)
    : [];

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            AI Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[120px] bg-muted animate-pulse rounded" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            AI Insights
          </CardTitle>
          {data?.insights && (
            <Button variant="ghost" size="sm" asChild>
              <Link href="/analytics/scorecard">
                View All
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Link>
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {data?.stale || !data?.insights ? (
          <div className="py-4 text-center">
            <p className="text-sm text-muted-foreground mb-3">
              Generate AI-powered insights for your portfolio
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => generateMutation.mutate()}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                  Generate Insights
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {topInsights.map((insight, i) => (
              <div key={i} className="flex gap-2.5 text-sm">
                <div
                  className={cn(
                    "w-2 h-2 rounded-full mt-1.5 flex-shrink-0",
                    SEVERITY_DOT[insight.severity]
                  )}
                />
                <div className="min-w-0">
                  <p className="font-medium">{insight.title}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {insight.body}
                  </p>
                </div>
              </div>
            ))}
            {data.generatedAt && (
              <p className="text-[10px] text-muted-foreground pt-1">
                Last updated {timeAgo(data.generatedAt)}
              </p>
            )}
          </div>
        )}
        <p className="text-[10px] text-muted-foreground mt-3 leading-tight">
          AI-generated insights — verify with your financial advisor.
        </p>
      </CardContent>
    </Card>
  );
}
