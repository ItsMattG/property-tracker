"use client";

import { useState } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";
import { ExtractionReviewCard } from "./ExtractionReviewCard";
import { formatCurrency } from "@/lib/utils";

function ConfidenceBadge({ confidence }: { confidence: number }) {
  if (confidence >= 0.85) {
    return (
      <Badge
        variant="default"
        className="bg-emerald-500/10 text-emerald-700 border-emerald-500/20"
      >
        High confidence
      </Badge>
    );
  }
  if (confidence >= 0.5) {
    return <Badge variant="secondary">Review needed</Badge>;
  }
  return (
    <Badge
      variant="destructive"
      className="bg-amber-500/10 text-amber-700 border-amber-500/20"
    >
      <AlertTriangle className="h-3 w-3 mr-1" />
      Low confidence
    </Badge>
  );
}

export function PendingReviews() {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const utils = trpc.useUtils();
  const { data: reviews, isLoading } =
    trpc.documentExtraction.listPendingReviews.useQuery();

  const confirmMutation = trpc.documentExtraction.confirmTransaction.useMutation(
    {
      onSuccess: () => {
        utils.documentExtraction.listPendingReviews.invalidate();
        utils.transaction.list.invalidate();
      },
      onError: (error) => toast.error(getErrorMessage(error)),
    }
  );

  const discardMutation = trpc.documentExtraction.discardExtraction.useMutation(
    {
      onSuccess: () => {
        utils.documentExtraction.listPendingReviews.invalidate();
      },
      onError: (error) => toast.error(getErrorMessage(error)),
    }
  );

  if (isLoading || !reviews) return null;
  if (reviews.length === 0) return null;

  const highConfidence = reviews.filter(
    (r) => r.confidence && parseFloat(r.confidence) >= 0.85
  );

  const handleConfirmAll = async () => {
    let confirmed = 0;
    for (const review of highConfidence) {
      try {
        await confirmMutation.mutateAsync({ extractionId: review.id });
        confirmed++;
      } catch {
        // Continue confirming the rest
      }
    }
    toast.success(
      `Confirmed ${confirmed} transaction${confirmed !== 1 ? "s" : ""}`
    );
    utils.documentExtraction.getRemainingScans.invalidate();
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">
            Pending Reviews ({reviews.length})
          </CardTitle>
          {highConfidence.length > 0 && (
            <Button
              size="sm"
              onClick={handleConfirmAll}
              disabled={confirmMutation.isPending}
            >
              <CheckCircle2 className="h-4 w-4 mr-1" />
              Confirm All High Confidence ({highConfidence.length})
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {reviews.map((review) => {
          const confidence = review.confidence
            ? parseFloat(review.confidence)
            : 0;
          const data = review.extractedData;
          const duplicateOf = data?.duplicateOf as string | undefined;
          const isExpanded = expandedId === review.id;

          return (
            <div key={review.id} className="border rounded-lg">
              <button
                type="button"
                className="w-full flex items-center gap-3 p-3 text-left hover:bg-muted/50 transition-colors"
                onClick={() =>
                  setExpandedId(isExpanded ? null : review.id)
                }
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">
                      {data?.vendor ||
                        review.document?.fileName ||
                        "Unknown"}
                    </span>
                    {data?.amount && (
                      <span className="text-sm font-mono">
                        {formatCurrency(Math.abs(data.amount))}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <ConfidenceBadge confidence={confidence} />
                    {data?.category && (
                      <Badge variant="outline" className="text-xs">
                        {data.category.replace(/_/g, " ")}
                      </Badge>
                    )}
                    {duplicateOf && (
                      <Badge
                        variant="outline"
                        className="bg-amber-50 text-amber-700 border-amber-300"
                      >
                        Possible duplicate
                      </Badge>
                    )}
                  </div>
                </div>
                {data?.date && (
                  <span className="text-xs text-muted-foreground shrink-0">
                    {data.date}
                  </span>
                )}
              </button>

              {isExpanded && (
                <div className="px-3 pb-3">
                  <ExtractionReviewCard
                    extraction={review}
                    onConfirm={(updates) =>
                      confirmMutation.mutate({
                        extractionId: review.id,
                        ...updates,
                      })
                    }
                    onDiscard={() =>
                      discardMutation.mutate({ extractionId: review.id })
                    }
                  />
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
