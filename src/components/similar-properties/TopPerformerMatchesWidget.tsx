"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, ArrowRight, Target } from "lucide-react";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { featureFlags } from "@/config/feature-flags";

export function TopPerformerMatchesWidget() {
  // Get user's properties to find top performer
  const { data: properties, isLoading: propertiesLoading } = trpc.property.list.useQuery(
    undefined,
    { enabled: featureFlags.similarProperties }
  );

  // Find the first property (simplified - could use actual performance score)
  const topPerformer = properties?.[0];

  const { data: similarProperties, isLoading: similarLoading } =
    trpc.similarProperties.findSimilar.useQuery(
      { propertyId: topPerformer?.id || "", limit: 3 },
      { enabled: featureFlags.similarProperties && !!topPerformer?.id }
    );

  if (!featureFlags.similarProperties) return null;

  if (propertiesLoading || similarLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Target className="w-5 h-5" />
            Top Performer Matches
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24" />
        </CardContent>
      </Card>
    );
  }

  if (!topPerformer || !similarProperties || similarProperties.length === 0) {
    return null; // Don't show widget if no data
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Target className="w-5 h-5" />
          Properties like your top performer
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {topPerformer.address}
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {similarProperties.map((property) => (
            <div
              key={property.id}
              className="flex items-center justify-between p-2 rounded-lg hover:bg-muted transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="text-sm">
                  <span className="font-medium">
                    {property.suburb}, {property.state}
                  </span>
                  {property.yield && (
                    <span className="text-muted-foreground ml-2">
                      {property.yield.toFixed(1)}% yield
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-green-600" />
                <span className="text-sm font-semibold text-green-600">
                  {property.similarityScore}%
                </span>
              </div>
            </div>
          ))}
        </div>
        <Link href="/discover">
          <Button variant="ghost" size="sm" className="w-full mt-4">
            Explore More <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
