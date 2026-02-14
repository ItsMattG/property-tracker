"use client";

import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";

export function RentalYieldCard() {
  const router = useRouter();
  const { data, isLoading } = trpc.rentalYield.getPortfolioSummary.useQuery();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Rental Yield</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-16 bg-muted animate-pulse rounded" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.properties.length === 0) {
    return null;
  }

  const hasRentData = data.properties.some((p) => p.annualRent > 0);
  if (!hasRentData) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Rental Yield</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-sm text-muted-foreground">Avg Gross Yield</p>
            <p className="text-2xl font-bold flex items-center gap-1">
              {data.averageGrossYield.toFixed(1)}%
              <TrendingUp className="w-4 h-4 text-green-500" />
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Avg Net Yield</p>
            <p className="text-2xl font-bold flex items-center gap-1">
              {data.averageNetYield.toFixed(1)}%
              {data.averageNetYield >= 0 ? (
                <TrendingUp className="w-4 h-4 text-green-500" />
              ) : (
                <TrendingDown className="w-4 h-4 text-red-500" />
              )}
            </p>
          </div>
        </div>

        {data.properties.filter((p) => p.annualRent > 0).length > 1 && (
          <div className="space-y-2">
            {data.properties
              .filter((p) => p.annualRent > 0)
              .map((p) => (
                <div
                  key={p.propertyId}
                  className="flex items-center justify-between text-sm border-t pt-2 cursor-pointer hover:bg-muted/50 -mx-2 px-2 py-1.5 rounded-md transition-colors"
                  onClick={() => router.push(`/properties/${p.propertyId}`)}
                >
                  <span className="text-muted-foreground truncate max-w-[60%]">
                    {p.address}, {p.suburb}
                  </span>
                  <span className="font-medium">
                    {p.grossYield.toFixed(1)}% / {p.netYield.toFixed(1)}%
                  </span>
                </div>
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
