"use client";

import { useState } from "react";
import { DollarSign, TrendingUp, AlertTriangle, Pencil, Info, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc/client";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";

interface RentReviewCardProps {
  propertyId: string;
}

const STATUS_CONFIG = {
  below_market_critical: {
    label: "Below Market",
    variant: "destructive" as const,
    className: "bg-red-50 border-red-200 text-red-800",
  },
  below_market_warning: {
    label: "Below Market",
    variant: "warning" as const,
    className: "bg-yellow-50 border-yellow-200 text-yellow-800",
  },
  at_market: {
    label: "At Market",
    variant: "default" as const,
    className: "bg-green-50 border-green-200 text-green-800",
  },
  above_market: {
    label: "Above Market",
    variant: "secondary" as const,
    className: "bg-blue-50 border-blue-200 text-blue-800",
  },
  no_review: {
    label: "Not Reviewed",
    variant: "outline" as const,
    className: "",
  },
} as const;

export function RentReviewCard({ propertyId }: RentReviewCardProps) {
  const [marketRentInput, setMarketRentInput] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.rentReview.getForProperty.useQuery(
    { propertyId },
    { enabled: !!propertyId }
  );

  const setMarketRent = trpc.rentReview.setMarketRent.useMutation({
    onSuccess: () => {
      toast.success("Market rent updated");
      utils.rentReview.getForProperty.invalidate({ propertyId });
      utils.rentReview.getPortfolioSummary.invalidate();
      setMarketRentInput("");
      setIsEditing(false);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = parseFloat(marketRentInput);
    if (isNaN(value) || value <= 0) {
      toast.error("Please enter a valid weekly rent amount");
      return;
    }
    setMarketRent.mutate({ propertyId, marketRentWeekly: value });
  };

  const handleEditClick = () => {
    if (data?.marketRentWeekly) {
      setMarketRentInput(data.marketRentWeekly.toString());
    }
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setMarketRentInput("");
    setIsEditing(false);
  };

  // Loading state
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-emerald-500" />
            </div>
            <Skeleton className="h-6 w-32" />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const statusConfig = STATUS_CONFIG[data.status];

  // No review exists yet — show input form
  if (data.status === "no_review" || isEditing) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-emerald-500" />
            </div>
            <CardTitle>{isEditing ? "Update Market Rent" : "Rent Review"}</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="market-rent"
                className="block text-sm font-medium mb-1"
              >
                Market Rent ($/week)
              </label>
              <div className="flex gap-2">
                <Input
                  id="market-rent"
                  type="number"
                  step="1"
                  min="1"
                  placeholder="e.g. 550"
                  value={marketRentInput}
                  onChange={(e) => setMarketRentInput(e.target.value)}
                  className="max-w-[180px]"
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={setMarketRent.isPending || !marketRentInput}
                >
                  {setMarketRent.isPending ? "Saving..." : "Save"}
                </Button>
                {isEditing && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleCancelEdit}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Info className="w-3 h-3" />
              Enter the current market rent for comparable properties in this area.
            </p>
          </form>
        </CardContent>
      </Card>
    );
  }

  // Review exists — show metrics
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-emerald-500" />
            </div>
            <CardTitle>Rent Review</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={statusConfig.variant}>
              {statusConfig.label}
            </Badge>
            <Button variant="ghost" size="icon-sm" onClick={handleEditClick}>
              <Pencil className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Rent metrics */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Actual Rent</p>
            <p className="text-lg font-semibold">
              {data.currentRentWeekly !== null
                ? `${formatCurrency(data.currentRentWeekly)}/wk`
                : "No data"}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Market Rent</p>
            <p className="text-lg font-semibold">
              {data.marketRentWeekly !== null
                ? `${formatCurrency(data.marketRentWeekly)}/wk`
                : "Not set"}
            </p>
          </div>
        </div>

        {/* Gap indicator */}
        {data.gapPercent !== null && (
          <div
            className={cn(
              "flex items-center gap-2 p-3 rounded-lg border",
              statusConfig.className
            )}
          >
            {data.gapPercent > 10 ? (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            ) : (
              <TrendingUp className="w-4 h-4 shrink-0" />
            )}
            <span className="text-sm font-medium">
              {data.gapPercent > 0
                ? `${data.gapPercent.toFixed(1)}% below market`
                : data.gapPercent < 0
                  ? `${Math.abs(data.gapPercent).toFixed(1)}% above market`
                  : "At market rate"}
            </span>
          </div>
        )}

        {/* Annual uplift callout */}
        {data.annualUplift !== null && data.annualUplift > 0 && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
            <p className="text-sm font-medium text-emerald-800">
              Potential annual uplift: {formatCurrency(data.annualUplift)}
            </p>
            <p className="text-xs text-emerald-600 mt-0.5">
              If rent is increased to market rate
            </p>
          </div>
        )}

        {/* Notice period rules */}
        {data.noticeRules && (
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <Clock className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              <p>
                {data.noticeRules.noticeDays} days notice required
                {" \u00B7 "}max once every {data.noticeRules.maxFrequency}
              </p>
              <p className="text-xs">{data.noticeRules.fixedTermRule}</p>
            </div>
          </div>
        )}

        {/* Review metadata */}
        {data.review && (
          <div className="pt-2 border-t text-xs text-muted-foreground space-y-1">
            <p>
              Last reviewed: {formatDate(data.review.lastReviewedAt)}
            </p>
            {data.review.nextReviewDate && (
              <p>
                Next review: {formatDate(data.review.nextReviewDate)}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
