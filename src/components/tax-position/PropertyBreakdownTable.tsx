"use client";

import { useState } from "react";

import Link from "next/link";
import { ChevronRight, AlertTriangle, Building2 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { formatCurrency, cn } from "@/lib/utils";

interface CategoryBreakdown {
  category: string;
  label: string;
  atoReference: string;
  amount: number;
  transactionCount: number;
}

interface PropertyBreakdown {
  propertyId: string;
  address: string;
  suburb: string;
  income: number;
  expenses: number;
  netResult: number;
  categories: CategoryBreakdown[];
}

interface PropertyBreakdownTableProps {
  properties: PropertyBreakdown[];
  unallocated: {
    income: number;
    expenses: number;
    netResult: number;
    categories: CategoryBreakdown[];
  };
  totals: {
    income: number;
    expenses: number;
    netResult: number;
  };
  financialYear: number;
}

function PropertyRow({ property }: { property: PropertyBreakdown }) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button className="w-full grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-4 py-3 px-4 hover:bg-muted/50 transition-colors text-left">
          <div className="flex items-center gap-2 min-w-0">
            <ChevronRight
              className={cn(
                "h-4 w-4 shrink-0 transition-transform",
                open && "rotate-90"
              )}
            />
            <div className="truncate">
              <p className="text-sm font-medium truncate">{property.address}</p>
              <p className="text-xs text-muted-foreground">{property.suburb}</p>
            </div>
          </div>
          <span className="text-sm text-right tabular-nums text-green-600">
            {formatCurrency(property.income)}
          </span>
          <span className="text-sm text-right tabular-nums text-red-600">
            {formatCurrency(property.expenses)}
          </span>
          <span
            className={cn(
              "text-sm font-medium text-right tabular-nums",
              property.netResult >= 0 ? "text-green-600" : "text-red-600"
            )}
          >
            {formatCurrency(property.netResult)}
          </span>
          <span className="text-xs text-muted-foreground w-16 text-right">
            {property.categories.reduce((sum, c) => sum + c.transactionCount, 0)} txns
          </span>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="pl-10 pr-4 pb-3 space-y-1">
          {property.categories.map((cat) => (
            <Link
              key={cat.category}
              href={`/transactions?propertyId=${property.propertyId}&category=${cat.category}`}
              className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 py-1.5 px-2 rounded hover:bg-muted/50 transition-colors"
            >
              {cat.atoReference ? (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono">
                  {cat.atoReference}
                </Badge>
              ) : (
                <span className="w-8" />
              )}
              <span className="text-sm text-muted-foreground">{cat.label}</span>
              <span className="text-sm tabular-nums">{formatCurrency(cat.amount)}</span>
              <span className="text-xs text-muted-foreground">{cat.transactionCount}</span>
            </Link>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function PropertyBreakdownTable({
  properties,
  unallocated,
  totals,
}: PropertyBreakdownTableProps) {
  const hasData = properties.length > 0 || unallocated.categories.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Per-Property Breakdown</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {!hasData ? (
          <div className="py-8 text-center text-muted-foreground text-sm">
            <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
            No rental transactions recorded for this financial year
          </div>
        ) : (
          <div>
            {/* Column headers */}
            <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-4 py-2 text-xs text-muted-foreground border-b">
              <span className="pl-6">Property</span>
              <span className="text-right">Income</span>
              <span className="text-right">Expenses</span>
              <span className="text-right">Net</span>
              <span className="w-16 text-right">Count</span>
            </div>

            {/* Property rows */}
            <div className="divide-y">
              {properties.map((prop) => (
                <PropertyRow key={prop.propertyId} property={prop} />
              ))}

              {/* Unallocated row */}
              {unallocated.categories.length > 0 && (
                <div className="bg-amber-50/50 dark:bg-amber-950/20">
                  <div className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-4 py-3 px-4">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                          Unallocated
                        </p>
                        <Link
                          href="/transactions?propertyId=none"
                          className="text-xs text-amber-600 dark:text-amber-500 hover:underline"
                        >
                          Assign to a property
                        </Link>
                      </div>
                    </div>
                    <span className="text-sm text-right tabular-nums">
                      {formatCurrency(unallocated.income)}
                    </span>
                    <span className="text-sm text-right tabular-nums">
                      {formatCurrency(unallocated.expenses)}
                    </span>
                    <span className="text-sm font-medium text-right tabular-nums">
                      {formatCurrency(unallocated.netResult)}
                    </span>
                    <span className="text-xs text-muted-foreground w-16 text-right">
                      {unallocated.categories.reduce((sum, c) => sum + c.transactionCount, 0)} txns
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Totals row */}
            <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-4 py-3 border-t bg-muted/30 font-medium text-sm">
              <span className="pl-6">Total</span>
              <span className="text-right tabular-nums text-green-600">
                {formatCurrency(totals.income)}
              </span>
              <span className="text-right tabular-nums text-red-600">
                {formatCurrency(totals.expenses)}
              </span>
              <span
                className={cn(
                  "text-right tabular-nums",
                  totals.netResult >= 0 ? "text-green-600" : "text-red-600"
                )}
              >
                {formatCurrency(totals.netResult)}
              </span>
              <span className="w-16" />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
