"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, MapPin, TrendingUp, ExternalLink } from "lucide-react";
import type { SimilarProperty } from "@/types/similar-properties";

interface SimilarPropertyCardProps {
  property: SimilarProperty;
  onClick?: () => void;
}

export function SimilarPropertyCard({ property, onClick }: SimilarPropertyCardProps) {
  const getBadgeVariant = (type: SimilarProperty["type"]) => {
    switch (type) {
      case "portfolio":
        return "default";
      case "external":
        return "secondary";
      case "community":
        return "outline";
    }
  };

  const getTypeLabel = (type: SimilarProperty["type"]) => {
    switch (type) {
      case "portfolio":
        return "Your Portfolio";
      case "external":
        return "External Listing";
      case "community":
        return "Community";
    }
  };

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Building2 className="w-4 h-4 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-1 text-sm font-medium">
                <MapPin className="w-3 h-3" />
                {property.suburb}, {property.state}
              </div>
              <div className="text-xs text-muted-foreground capitalize">
                {property.propertyType}
              </div>
            </div>
          </div>
          <Badge variant={getBadgeVariant(property.type)} className="text-xs">
            {getTypeLabel(property.type)}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-3 text-sm">
          <div>
            <span className="text-muted-foreground">Price:</span>
            <span className="ml-1 font-medium">{property.priceBracket}</span>
          </div>
          {property.yield && (
            <div>
              <span className="text-muted-foreground">Yield:</span>
              <span className="ml-1 font-medium">{property.yield.toFixed(1)}%</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mt-3 pt-3 border-t">
          <div className="flex items-center gap-1 text-sm">
            <TrendingUp className="w-3 h-3 text-green-600" />
            <span className="font-semibold text-green-600">
              {property.similarityScore}% match
            </span>
          </div>
          {property.sourceUrl && (
            <ExternalLink className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
