"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BatchSuggestionCard } from "@/components/categorization/BatchSuggestionCard";
import { ExtractionReviewCard } from "@/components/documents/ExtractionReviewCard";
import { Sparkles, RefreshCw, FileText } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type ConfidenceFilter = "all" | "high" | "low";

export default function ReviewPage() {
  const [confidenceFilter, setConfidenceFilter] = useState<ConfidenceFilter>("all");

  const utils = trpc.useUtils();

  const { data, isLoading, refetch } = trpc.categorization.getPendingReview.useQuery({
    confidenceFilter,
    limit: 50,
  });

  const acceptMutation = trpc.categorization.acceptSuggestion.useMutation({
    onSuccess: () => {
      toast.success("Suggestion accepted");
      utils.categorization.getPendingReview.invalidate();
      utils.categorization.getPendingCount.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const rejectMutation = trpc.categorization.rejectSuggestion.useMutation({
    onSuccess: () => {
      toast.success("Category updated");
      utils.categorization.getPendingReview.invalidate();
      utils.categorization.getPendingCount.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const batchAcceptMutation = trpc.categorization.batchAccept.useMutation({
    onSuccess: (result) => {
      toast.success(`${result.accepted} transactions categorized`);
      utils.categorization.getPendingReview.invalidate();
      utils.categorization.getPendingCount.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const triggerMutation = trpc.categorization.triggerCategorization.useMutation({
    onSuccess: (result) => {
      toast.success(`Categorized ${result.categorized} of ${result.processed} transactions`);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Document extraction queries and mutations
  const { data: pendingExtractions, refetch: refetchExtractions } =
    trpc.documentExtraction.listPendingReviews.useQuery();

  const confirmExtractionMutation =
    trpc.documentExtraction.confirmTransaction.useMutation({
      onSuccess: () => {
        toast.success("Transaction confirmed");
        refetchExtractions();
      },
      onError: (error) => {
        toast.error(error.message);
      },
    });

  const discardExtractionMutation =
    trpc.documentExtraction.discardExtraction.useMutation({
      onSuccess: () => {
        toast.success("Extraction discarded");
        refetchExtractions();
      },
      onError: (error) => {
        toast.error(error.message);
      },
    });

  const isProcessing =
    acceptMutation.isPending ||
    rejectMutation.isPending ||
    batchAcceptMutation.isPending ||
    confirmExtractionMutation.isPending ||
    discardExtractionMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" />
            Review Suggestions
          </h1>
          <p className="text-muted-foreground">
            {data?.total ?? 0} transactions pending review
          </p>
        </div>

        <Button
          variant="outline"
          onClick={() => triggerMutation.mutate({ limit: 20 })}
          disabled={triggerMutation.isPending}
        >
          <RefreshCw
            className={cn(
              "w-4 h-4 mr-2",
              triggerMutation.isPending && "animate-spin"
            )}
          />
          Scan Uncategorized
        </Button>
      </div>

      <Tabs
        value={confidenceFilter}
        onValueChange={(v: string) => setConfidenceFilter(v as ConfidenceFilter)}
      >
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="high">High Confidence</TabsTrigger>
          <TabsTrigger value="low">Low Confidence</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Document Extractions Review */}
      {pendingExtractions && pendingExtractions.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Document Extractions ({pendingExtractions.length})
          </h2>
          {pendingExtractions.map((extraction) => (
            <ExtractionReviewCard
              key={extraction.id}
              extraction={extraction}
              onConfirm={(updates) =>
                confirmExtractionMutation.mutate({
                  extractionId: extraction.id,
                  ...updates,
                })
              }
              onDiscard={() =>
                discardExtractionMutation.mutate({ extractionId: extraction.id })
              }
            />
          ))}
        </div>
      )}

      {/* Categorization Suggestions */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">
          Loading suggestions...
        </div>
      ) : data?.groupedByMerchant.length === 0 &&
        (!pendingExtractions || pendingExtractions.length === 0) ? (
        <div className="text-center py-12">
          <Sparkles className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">All caught up!</h3>
          <p className="text-muted-foreground">
            No transactions pending review.
          </p>
        </div>
      ) : data?.groupedByMerchant.length === 0 ? null : (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            Category Suggestions ({data?.total ?? 0})
          </h2>
          {data?.groupedByMerchant.map((group) => (
            <BatchSuggestionCard
              key={group.merchantKey}
              merchantKey={group.merchantKey}
              transactions={group.transactions}
              suggestedCategory={group.suggestedCategory}
              avgConfidence={group.avgConfidence}
              onBatchAccept={(ids) => batchAcceptMutation.mutate({ transactionIds: ids })}
              onAccept={(id) => acceptMutation.mutate({ transactionId: id })}
              onReject={(id, cat) =>
                rejectMutation.mutate({ transactionId: id, newCategory: cat })
              }
              isLoading={isProcessing}
            />
          ))}
        </div>
      )}
    </div>
  );
}
