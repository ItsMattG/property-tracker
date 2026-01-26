"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, RefreshCw } from "lucide-react";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { SimilarPropertyCard } from "./SimilarPropertyCard";

interface SimilarPropertiesSectionProps {
  propertyId: string;
}

export function SimilarPropertiesSection({ propertyId }: SimilarPropertiesSectionProps) {
  const { data: similarProperties, isLoading, refetch } = trpc.similarProperties.findSimilar.useQuery(
    { propertyId, limit: 3 },
    { enabled: !!propertyId }
  );

  const generateVectorMutation = trpc.similarProperties.generateVector.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Similar Properties</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!similarProperties || similarProperties.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Similar Properties</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <p className="text-muted-foreground mb-4">
              No similar properties found yet.
            </p>
            <Button
              variant="outline"
              onClick={() => generateVectorMutation.mutate({ propertyId })}
              disabled={generateVectorMutation.isPending}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${generateVectorMutation.isPending ? "animate-spin" : ""}`} />
              Generate Recommendations
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Similar Properties</CardTitle>
        <Link href="/discover">
          <Button variant="ghost" size="sm">
            See All <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {similarProperties.map((property) => (
            <SimilarPropertyCard
              key={property.id}
              property={property}
              onClick={() => {
                if (property.propertyId) {
                  window.location.href = `/properties/${property.propertyId}`;
                } else if (property.sourceUrl) {
                  window.open(property.sourceUrl, "_blank");
                }
              }}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
