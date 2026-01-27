"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, MapPin, AlertCircle, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface PropertyMetrics {
  propertyId: string;
  address: string;
  suburb: string;
  state: string;
  entityName: string;
  currentValue: number;
  totalLoans: number;
  equity: number;
  lvr: number | null;
  cashFlow: number;
  hasValue: boolean;
}

interface PortfolioCardProps {
  property: PropertyMetrics;
  onUpdateValue: (propertyId: string) => void;
}

export function PortfolioCard({ property, onUpdateValue }: PortfolioCardProps) {
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      maximumFractionDigits: 0,
    }).format(value);

  const formatPercent = (value: number | null) =>
    value !== null ? `${value.toFixed(1)}%` : "-";

  const getLVRColor = (lvr: number | null) => {
    if (lvr === null) return "text-muted-foreground";
    if (lvr < 60) return "text-green-600";
    if (lvr < 80) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <Link href={`/properties/${property.propertyId}`} className="flex items-center gap-2 hover:underline">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">{property.address}</CardTitle>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <MapPin className="w-3 h-3" />
                {property.suburb}, {property.state}
              </div>
            </div>
          </Link>
          <Badge variant="secondary">{property.entityName}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {!property.hasValue && (
          <div className="flex items-center gap-2 p-2 mb-3 rounded-md bg-yellow-50 text-yellow-800 text-sm dark:bg-yellow-900/20 dark:text-yellow-200">
            <AlertCircle className="w-4 h-4" />
            <span>No value set</span>
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 text-yellow-800 underline dark:text-yellow-200"
              onClick={() => onUpdateValue(property.propertyId)}
            >
              Add value
            </Button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4" data-tour="avm-estimates">
          <div>
            <p className="text-xs text-muted-foreground">Current Value</p>
            <p className="text-lg font-semibold">
              {property.hasValue ? formatCurrency(property.currentValue) : "-"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Loan Balance</p>
            <p className="text-lg font-semibold">{formatCurrency(property.totalLoans)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Equity</p>
            <p className="text-lg font-semibold">
              {property.hasValue ? formatCurrency(property.equity) : "-"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">LVR</p>
            <p className={cn("text-lg font-semibold", getLVRColor(property.lvr))}>
              {formatPercent(property.lvr)}
            </p>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Cash Flow</span>
            <div className="flex items-center gap-1">
              {property.cashFlow >= 0 ? (
                <TrendingUp className="w-4 h-4 text-green-600" />
              ) : (
                <TrendingDown className="w-4 h-4 text-red-600" />
              )}
              <span
                className={cn(
                  "font-semibold",
                  property.cashFlow >= 0 ? "text-green-600" : "text-red-600"
                )}
              >
                {formatCurrency(property.cashFlow)}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
