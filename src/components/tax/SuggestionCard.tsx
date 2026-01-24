"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DollarSign,
  Wrench,
  FileText,
  AlertTriangle,
  X,
  Check,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface SuggestionCardProps {
  suggestion: {
    id: string;
    type: string;
    title: string;
    description: string;
    estimatedSavings: string | null;
    actionUrl: string | null;
    property?: { address: string } | null;
  };
  onDismiss: (id: string) => void;
  onAction: (id: string) => void;
  isLoading?: boolean;
}

const typeIcons: Record<string, typeof DollarSign> = {
  prepay_interest: DollarSign,
  schedule_repairs: Wrench,
  claim_depreciation: FileText,
  missed_deduction: AlertTriangle,
};

const typeColors: Record<string, string> = {
  prepay_interest: "text-green-600 bg-green-50",
  schedule_repairs: "text-blue-600 bg-blue-50",
  claim_depreciation: "text-purple-600 bg-purple-50",
  missed_deduction: "text-amber-600 bg-amber-50",
};

export function SuggestionCard({
  suggestion,
  onDismiss,
  onAction,
  isLoading,
}: SuggestionCardProps) {
  const Icon = typeIcons[suggestion.type] || AlertTriangle;
  const colorClass = typeColors[suggestion.type] || "text-gray-600 bg-gray-50";
  const savings = suggestion.estimatedSavings
    ? parseFloat(suggestion.estimatedSavings)
    : null;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex gap-4">
          <div className={cn("p-2 rounded-lg h-fit", colorClass)}>
            <Icon className="w-5 h-5" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="font-medium">{suggestion.title}</h4>
                {suggestion.property && (
                  <p className="text-xs text-muted-foreground">
                    {suggestion.property.address}
                  </p>
                )}
              </div>
              {savings && savings > 0 && (
                <Badge variant="secondary" className="whitespace-nowrap">
                  Save ~${savings.toLocaleString()}
                </Badge>
              )}
            </div>

            <p className="text-sm text-muted-foreground mt-1">
              {suggestion.description}
            </p>

            <div className="flex items-center gap-2 mt-3">
              {suggestion.actionUrl && (
                <Button size="sm" asChild>
                  <Link href={suggestion.actionUrl}>
                    <ExternalLink className="w-4 h-4 mr-1" />
                    Take Action
                  </Link>
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => onAction(suggestion.id)}
                disabled={isLoading}
              >
                <Check className="w-4 h-4 mr-1" />
                Done
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onDismiss(suggestion.id)}
                disabled={isLoading}
              >
                <X className="w-4 h-4 mr-1" />
                Dismiss
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
