"use client";

import { trpc } from "@/lib/trpc/client";
import { SuggestionCard } from "./SuggestionCard";
import { Button } from "@/components/ui/button";
import { RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";

export function SuggestionList() {
  const utils = trpc.useUtils();

  const { data: suggestions, isLoading } =
    trpc.taxOptimization.getSuggestions.useQuery({});

  const dismissMutation = trpc.taxOptimization.dismissSuggestion.useMutation({
    onSuccess: () => {
      toast.success("Suggestion dismissed");
      utils.taxOptimization.getSuggestions.invalidate();
      utils.taxOptimization.getSuggestionCount.invalidate();
    },
  });

  const actionMutation = trpc.taxOptimization.markActioned.useMutation({
    onSuccess: () => {
      toast.success("Marked as done");
      utils.taxOptimization.getSuggestions.invalidate();
      utils.taxOptimization.getSuggestionCount.invalidate();
    },
  });

  const refreshMutation = trpc.taxOptimization.refreshSuggestions.useMutation({
    onSuccess: (result) => {
      toast.success(`Found ${result.count} suggestions`);
      utils.taxOptimization.getSuggestions.invalidate();
      utils.taxOptimization.getSuggestionCount.invalidate();
    },
  });

  const isProcessing =
    dismissMutation.isPending || actionMutation.isPending;

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading suggestions...</div>;
  }

  if (!suggestions || suggestions.length === 0) {
    return (
      <div className="text-center py-8">
        <Sparkles className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium">No suggestions</h3>
        <p className="text-muted-foreground mb-4">
          You're all caught up on tax optimization opportunities.
        </p>
        <Button
          variant="outline"
          onClick={() => refreshMutation.mutate()}
          disabled={refreshMutation.isPending}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshMutation.isPending ? "animate-spin" : ""}`} />
          Check for Suggestions
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">
          {suggestions.length} Optimization{suggestions.length !== 1 ? "s" : ""} Found
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => refreshMutation.mutate()}
          disabled={refreshMutation.isPending}
        >
          <RefreshCw className={`w-4 h-4 mr-1 ${refreshMutation.isPending ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {suggestions.map((suggestion) => (
        <SuggestionCard
          key={suggestion.id}
          suggestion={suggestion}
          onDismiss={(id) => dismissMutation.mutate({ suggestionId: id })}
          onAction={(id) => actionMutation.mutate({ suggestionId: id })}
          isLoading={isProcessing}
        />
      ))}
    </div>
  );
}
