"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";
import { CategorySelect } from "@/components/transactions/CategorySelect";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { getCategoryLabel } from "@/lib/categories";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

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
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>();

  const confidence = parseFloat(transaction.suggestionConfidence || "0");
  const amount = parseFloat(transaction.amount);

  const handleReject = () => {
    if (selectedCategory) {
      onReject(transaction.id, selectedCategory);
    }
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm text-muted-foreground">
                {format(new Date(transaction.date), "dd MMM yyyy")}
              </span>
              {transaction.property && (
                <span className="text-xs text-muted-foreground truncate">
                  • {transaction.property.address}
                </span>
              )}
            </div>
            <p className="font-medium truncate">{transaction.description}</p>
            <p
              className={cn(
                "text-lg font-semibold",
                amount >= 0 ? "text-green-600" : "text-red-600"
              )}
            >
              ${Math.abs(amount).toFixed(2)}
            </p>
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              <ConfidenceBadge confidence={confidence} showValue />
              <span className="text-sm font-medium">
                {getCategoryLabel(transaction.suggestedCategory || "uncategorized")}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onAccept(transaction.id)}
                disabled={isLoading}
              >
                <Check className="w-4 h-4 mr-1" />
                Accept
              </Button>

              <div className="flex items-center gap-1">
                <CategorySelect
                  value={selectedCategory}
                  onValueChange={setSelectedCategory}
                  disabled={isLoading}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleReject}
                  disabled={isLoading || !selectedCategory}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
