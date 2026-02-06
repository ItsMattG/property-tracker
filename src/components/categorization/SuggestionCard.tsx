"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, ArrowRight, RotateCcw } from "lucide-react";
import { CategorySelect } from "@/components/transactions/CategorySelect";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { getCategoryLabel } from "@/lib/categories";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SuggestionCardProps {
  transaction: {
    id: string;
    date: string;
    description: string;
    amount: string;
    suggestedCategory: string | null;
    suggestionConfidence: string | null;
    property?: { address: string } | null;
  };
  onAccept: (id: string) => void;
  onReject: (id: string, newCategory: string) => void;
  isLoading?: boolean;
}

export function SuggestionCard({
  transaction,
  onAccept,
  onReject,
  isLoading,
}: SuggestionCardProps) {
  const [overrideCategory, setOverrideCategory] = useState<string | undefined>();

  const confidence = parseFloat(transaction.suggestionConfidence || "0");
  const amount = parseFloat(transaction.amount);
  const hasOverride = !!overrideCategory;

  const handleConfirm = () => {
    if (overrideCategory) {
      onReject(transaction.id, overrideCategory);
    } else {
      onAccept(transaction.id);
    }
  };

  return (
    <Card className={cn(
      "transition-all duration-150",
      hasOverride && "ring-1 ring-primary/30"
    )}>
      <CardContent className="p-4">
        {/* Top row: transaction info */}
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-sm text-muted-foreground">
                {format(new Date(transaction.date), "dd MMM yyyy")}
              </span>
              {transaction.property && (
                <span className="text-xs text-muted-foreground truncate">
                  &middot; {transaction.property.address}
                </span>
              )}
            </div>
            <p className="font-medium truncate">{transaction.description}</p>
          </div>
          <p
            className={cn(
              "text-lg font-semibold tabular-nums shrink-0",
              amount >= 0 ? "text-green-600" : "text-red-600"
            )}
          >
            ${Math.abs(amount).toLocaleString("en-AU", { minimumFractionDigits: 2 })}
          </p>
        </div>

        {/* Bottom row: AI suggestion + actions */}
        <div className="flex items-center justify-between gap-3 pt-3 border-t border-border/50">
          {/* Left: AI suggestion or override indicator */}
          <div className="flex items-center gap-2 min-w-0">
            {hasOverride ? (
              <>
                <span className="text-xs text-muted-foreground line-through">
                  {getCategoryLabel(transaction.suggestedCategory || "uncategorized")}
                </span>
                <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
                <CategorySelect
                  value={overrideCategory}
                  onValueChange={setOverrideCategory}
                  disabled={isLoading}
                  compact
                />
              </>
            ) : (
              <>
                <ConfidenceBadge confidence={confidence} showValue />
                <span className="text-sm font-medium truncate">
                  {getCategoryLabel(transaction.suggestedCategory || "uncategorized")}
                </span>
              </>
            )}
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-2 shrink-0">
            {hasOverride ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setOverrideCategory(undefined)}
                    disabled={isLoading}
                    className="text-muted-foreground h-8 px-2"
                    aria-label="Undo — revert to AI suggestion"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Undo — revert to AI suggestion</TooltipContent>
              </Tooltip>
            ) : (
              <CategorySelect
                value={overrideCategory}
                onValueChange={setOverrideCategory}
                disabled={isLoading}
                placeholder="Change"
                compact
              />
            )}

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  onClick={handleConfirm}
                  disabled={isLoading}
                  variant={hasOverride ? "default" : "outline"}
                  className="h-8"
                >
                  <Check className="w-3.5 h-3.5 mr-1.5" />
                  {hasOverride ? "Save override" : "Accept suggestion"}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {hasOverride
                  ? `Categorize as "${getCategoryLabel(overrideCategory)}"`
                  : `Accept AI suggestion: "${getCategoryLabel(transaction.suggestedCategory || "uncategorized")}"`}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
