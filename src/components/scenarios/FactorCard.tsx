"use client";

import {
  TrendingUp,
  TrendingDown,
  Home,
  Ban,
  DollarSign,
  ShoppingCart,
  Pencil,
  X,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { formatFactorDescription } from "@/lib/scenarios";
import type { FactorType } from "@/lib/scenarios";

interface PropertyRef {
  id: string;
  address: string;
}

interface FactorCardProps {
  factorType: FactorType;
  config: Record<string, unknown>;
  startMonth: number;
  durationMonths?: number;
  properties: PropertyRef[];
  onEdit?: () => void;
  onRemove?: () => void;
}

const FACTOR_ICONS: Record<FactorType, React.ElementType> = {
  interest_rate: TrendingUp,
  vacancy: Ban,
  rent_change: Home,
  expense_change: TrendingDown,
  sell_property: DollarSign,
  buy_property: ShoppingCart,
};

export function FactorCard({
  factorType,
  config,
  startMonth,
  durationMonths,
  properties,
  onEdit,
  onRemove,
}: FactorCardProps) {
  const Icon = FACTOR_ICONS[factorType];
  const description = formatFactorDescription(factorType, config, properties);

  const monthRange = durationMonths
    ? `Months ${startMonth}\u2013${startMonth + durationMonths}`
    : `From month ${startMonth}`;

  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-3 px-4">
        <div className="bg-primary/10 shrink-0 rounded-lg p-2">
          <Icon className="text-primary h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{description}</p>
          <p className="text-muted-foreground text-xs">{monthRange}</p>
        </div>
        <Badge variant="outline" className="shrink-0">
          {factorType.replace(/_/g, " ")}
        </Badge>
        {(onEdit || onRemove) && (
          <div className="flex shrink-0 items-center gap-1">
            {onEdit && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={onEdit}
                aria-label="Edit factor"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
            {onRemove && (
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive h-7 w-7"
                onClick={onRemove}
                aria-label="Remove factor"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
