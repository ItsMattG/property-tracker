"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, MapPin, Calendar, DollarSign, MoreVertical, FileText, TrendingUp, TrendingDown } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import type { Property } from "@/server/db/schema";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import { featureFlags } from "@/config/feature-flags";
import { PerformanceBadge } from "./PerformanceBadge";

// When serialized through tRPC, Date fields become strings
type SerializedProperty = Omit<Property, "createdAt" | "updatedAt"> & {
  createdAt: Date | string;
  updatedAt: Date | string;
};

interface PropertyMetrics {
  currentValue: number;
  totalLoans: number;
  equity: number;
  lvr: number | null;
  cashFlow: number;
  hasValue: boolean;
  grossYield: number | null;
  capitalGrowthPercent: number;
  annualIncome: number;
}

interface PropertyCardProps {
  property: SerializedProperty;
  metrics?: PropertyMetrics;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}

export function PropertyCard({ property, metrics, onEdit, onDelete }: PropertyCardProps) {
  const router = useRouter();
  const utils = trpc.useUtils();

  const handlePrefetch = () => {
    utils.property.get.prefetch({ id: property.id });
  };

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
    <Link
      href={`/properties/${property.id}`}
      onMouseEnter={handlePrefetch}
      className="block"
    >
      <Card className="hover:border-primary transition-colors" data-testid="property-card">
      <CardHeader className="flex flex-row items-start justify-between pb-2">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-base">{property.address}</CardTitle>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="w-3 h-3" />
              {property.suburb}, {property.state} {property.postcode}
            </div>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.preventDefault()}>
            <Button variant="ghost" size="sm" aria-label="Property actions">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={(e) => { e.preventDefault(); if (onEdit) { onEdit(property.id); } else { router.push(`/properties/${property.id}/edit`); } }}>
              Edit
            </DropdownMenuItem>
            {featureFlags.documents && (
              <DropdownMenuItem onClick={(e) => { e.preventDefault(); router.push(`/properties/${property.id}/documents`); }}>
                <FileText className="w-4 h-4 mr-2" />
                Documents
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              className="text-destructive"
              onClick={(e) => { e.preventDefault(); onDelete?.(property.id); }}
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent>
        {metrics ? (
          <>
            {/* 2x2 financial metrics grid */}
            <div className="grid grid-cols-2 gap-3 mt-1">
              <div>
                <p className="text-xs text-muted-foreground">Value</p>
                <p className="text-base font-semibold">
                  {metrics.hasValue ? formatCurrency(metrics.currentValue) : formatCurrency(Number(property.purchasePrice))}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Loan</p>
                <p className="text-base font-semibold">
                  {metrics.totalLoans > 0 ? formatCurrency(metrics.totalLoans) : "-"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Equity</p>
                <p className="text-base font-semibold">
                  {metrics.hasValue ? formatCurrency(metrics.equity) : "-"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">LVR</p>
                <p className={cn("text-base font-semibold", getLVRColor(metrics.lvr))}>
                  {formatPercent(metrics.lvr)}
                </p>
              </div>
            </div>

            {/* Cash flow footer */}
            <div className="mt-3 pt-3 border-t flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Monthly Cash Flow</span>
              <div className="flex items-center gap-1">
                {metrics.cashFlow >= 0 ? (
                  <TrendingUp className="w-3.5 h-3.5 text-green-600" />
                ) : (
                  <TrendingDown className="w-3.5 h-3.5 text-red-600" />
                )}
                <span
                  className={cn(
                    "text-sm font-semibold",
                    metrics.cashFlow >= 0 ? "text-green-600" : "text-red-600"
                  )}
                >
                  {formatCurrency(metrics.cashFlow)}
                </span>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Fallback: basic info while metrics load */}
            <div className="grid grid-cols-2 gap-4 mt-2">
              <div className="flex items-center gap-2 text-sm">
                <DollarSign className="w-4 h-4 text-muted-foreground" />
                <span>{formatCurrency(Number(property.purchasePrice))}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span>{format(new Date(property.contractDate ?? property.purchaseDate), "MMM yyyy")}</span>
              </div>
            </div>
          </>
        )}
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Badge variant="secondary">{property.entityName}</Badge>
            {metrics && (
              <PerformanceBadge
                metrics={{
                  grossYield: metrics.grossYield,
                  cashFlow: metrics.cashFlow,
                  capitalGrowthPercent: metrics.capitalGrowthPercent,
                  lvr: metrics.lvr,
                  hasValue: metrics.hasValue,
                  annualIncome: metrics.annualIncome,
                }}
              />
            )}
          </div>
          {metrics?.grossYield !== null && metrics?.grossYield !== undefined && (
            <span className="text-xs text-muted-foreground">
              {formatPercent(metrics.grossYield)} yield
            </span>
          )}
        </div>
      </CardContent>
    </Card>
    </Link>
  );
}
