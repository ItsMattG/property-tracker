"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { SuggestionCard } from "./SuggestionCard";
import { getCategoryLabel } from "@/lib/categories";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: string;
  suggestedCategory: string | null;
  suggestionConfidence: string | null;
  property?: { address: string } | null;
}

interface BatchSuggestionCardProps {
  merchantKey: string;
  transactions: Transaction[];
  suggestedCategory: string | null;
  avgConfidence: number;
  onBatchAccept: (ids: string[]) => void;
  onAccept: (id: string) => void;
  onReject: (id: string, newCategory: string) => void;
  isLoading?: boolean;
}

export function BatchSuggestionCard({
  merchantKey,
  transactions,
  suggestedCategory,
  avgConfidence,
  onBatchAccept,
  onAccept,
  onReject,
  isLoading,
}: BatchSuggestionCardProps) {
  const [expanded, setExpanded] = useState(false);

  const totalAmount = transactions.reduce(
    (sum, t) => sum + parseFloat(t.amount),
    0
  );

  if (transactions.length === 1) {
    return (
      <SuggestionCard
        transaction={transactions[0]}
        onAccept={onAccept}
        onReject={onReject}
        isLoading={isLoading}
      />
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base capitalize">{merchantKey}</CardTitle>
            <span className="text-sm text-muted-foreground">
              ({transactions.length} transactions)
            </span>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpanded(!expanded)}
                aria-label={expanded ? "Collapse transactions" : "Expand transactions"}
              >
                {expanded ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {expanded ? "Collapse" : "Expand to review individually"}
            </TooltipContent>
          </Tooltip>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <ConfidenceBadge confidence={avgConfidence} showValue />
              <span className="text-sm font-medium">
                {getCategoryLabel(suggestedCategory || "uncategorized")}
              </span>
            </div>
            <span
              className={cn(
                "font-semibold",
                totalAmount >= 0 ? "text-green-600" : "text-red-600"
              )}
            >
              ${Math.abs(totalAmount).toLocaleString("en-AU", { minimumFractionDigits: 2 })} total
            </span>
          </div>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={() => {
                  const confirmed = window.confirm(
                    `Apply "${getCategoryLabel(suggestedCategory || "uncategorized")}" to all ${transactions.length} transactions?`
                  );
                  if (confirmed) {
                    onBatchAccept(transactions.map((t) => t.id));
                  }
                }}
                disabled={isLoading}
              >
                <Check className="w-4 h-4 mr-2" />
                Apply to all {transactions.length}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Accept &ldquo;{getCategoryLabel(suggestedCategory || "uncategorized")}&rdquo; for all {transactions.length} transactions
            </TooltipContent>
          </Tooltip>
        </div>

        {expanded && (
          <div className="space-y-2 mt-4 border-t pt-4">
            {transactions.map((txn) => (
              <SuggestionCard
                key={txn.id}
                transaction={txn}
                onAccept={onAccept}
                onReject={onReject}
                isLoading={isLoading}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
