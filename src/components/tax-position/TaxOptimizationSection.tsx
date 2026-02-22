"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Lightbulb, X, Check, DollarSign } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";

interface TaxOptimizationSectionProps {
  financialYear: number;
}

export function TaxOptimizationSection({ financialYear }: TaxOptimizationSectionProps) {
  const utils = trpc.useUtils();
  const { data: suggestions } = trpc.taxOptimization.getSuggestions.useQuery({
    financialYear,
    status: "active",
  });

  const dismiss = trpc.taxOptimization.dismissSuggestion.useMutation({
    onSuccess: () => {
      utils.taxOptimization.getSuggestions.invalidate();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const markActioned = trpc.taxOptimization.markActioned.useMutation({
    onSuccess: () => {
      utils.taxOptimization.getSuggestions.invalidate();
      toast.success("Marked as done");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  if (!suggestions || suggestions.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-amber-500" />
          Tax Optimization Tips
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {suggestions.map((s) => (
          <div
            key={s.id}
            className="flex items-start justify-between gap-4 rounded-lg border p-3"
          >
            <div className="space-y-1 min-w-0">
              <p className="text-sm font-medium">{s.title}</p>
              {s.description && (
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {s.description}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {s.estimatedSavings && Number(s.estimatedSavings) > 0 && (
                <Badge variant="secondary" className="gap-1">
                  <DollarSign className="h-3 w-3" />
                  {formatCurrency(Number(s.estimatedSavings))}
                </Badge>
              )}
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => markActioned.mutate({ suggestionId: s.id })}
                title="Mark as done"
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => dismiss.mutate({ suggestionId: s.id })}
                title="Dismiss"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
