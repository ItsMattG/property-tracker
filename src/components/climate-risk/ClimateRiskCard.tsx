"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClimateRiskBadge } from "./ClimateRiskBadge";
import { CloudRain, Flame, Shield, RefreshCw } from "lucide-react";
import type { ClimateRisk } from "@/types/climate-risk";
import { trpc } from "@/lib/trpc/client";
import { useState } from "react";

interface ClimateRiskCardProps {
  propertyId: string;
  climateRisk: ClimateRisk | null;
}

export function ClimateRiskCard({ propertyId, climateRisk }: ClimateRiskCardProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const utils = trpc.useUtils();

  const refreshMutation = trpc.property.refreshClimateRisk.useMutation({
    onSuccess: () => {
      utils.property.get.invalidate({ id: propertyId });
    },
    onSettled: () => {
      setIsRefreshing(false);
    },
  });

  const handleRefresh = () => {
    setIsRefreshing(true);
    refreshMutation.mutate({ id: propertyId });
  };

  if (!climateRisk) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Shield className="w-5 h-5 text-blue-500" />
              </div>
              <CardTitle>Climate Risk</CardTitle>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
              Assess Risk
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Climate risk has not been assessed for this property.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-blue-500" />
            </div>
            <CardTitle>Climate Risk</CardTitle>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-3">
            <CloudRain className="h-5 w-5 text-blue-500" />
            <div>
              <p className="text-sm text-muted-foreground">Flood Risk</p>
              <ClimateRiskBadge level={climateRisk.floodRisk} showLow />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Flame className="h-5 w-5 text-orange-500" />
            <div>
              <p className="text-sm text-muted-foreground">Bushfire Risk</p>
              <ClimateRiskBadge level={climateRisk.bushfireRisk} showLow />
            </div>
          </div>
        </div>

        <div className="pt-2 border-t">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Overall Risk</span>
            <ClimateRiskBadge level={climateRisk.overallRisk} showLow />
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Based on postcode-level government flood and bushfire mapping data.
          Last updated: {new Date(climateRisk.fetchedAt).toLocaleDateString("en-AU")}
        </p>
      </CardContent>
    </Card>
  );
}
