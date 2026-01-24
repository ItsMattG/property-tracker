"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc/client";
import { formatCurrency } from "@/lib/utils";

interface CostBaseCardProps {
  propertyId: string;
}

export function CostBaseCard({ propertyId }: CostBaseCardProps) {
  const { data, isLoading } = trpc.cgt.getCostBase.useQuery({ propertyId });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cost Base</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <Link href={`/reports/cgt?propertyId=${propertyId}`}>
      <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
        <CardHeader>
          <CardTitle className="text-base">Cost Base</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Purchase Price</span>
            <span>{formatCurrency(data.purchasePrice)}</span>
          </div>

          {data.acquisitionCosts.map((cost, index) => (
            <div key={index} className="flex justify-between text-sm">
              <span className="text-muted-foreground capitalize">
                {cost.category.replace(/_/g, " ")}
              </span>
              <span>{formatCurrency(cost.amount)}</span>
            </div>
          ))}

          <div className="border-t pt-3 flex justify-between font-medium">
            <span>Total Cost Base</span>
            <span>{formatCurrency(data.totalCostBase)}</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
