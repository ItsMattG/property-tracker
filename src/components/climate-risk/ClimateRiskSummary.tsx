"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, AlertTriangle } from "lucide-react";
import { featureFlags } from "@/config/feature-flags";
import type { ClimateRisk } from "@/types/climate-risk";

interface PropertyWithRisk {
  id: string;
  address: string;
  climateRisk: ClimateRisk | null;
}

interface ClimateRiskSummaryProps {
  properties: PropertyWithRisk[];
}

export function ClimateRiskSummary({ properties }: ClimateRiskSummaryProps) {
  if (!featureFlags.climateRisk) return null;

  const propertiesWithRisk = properties.filter((p) => p.climateRisk);

  const elevatedRiskCount = propertiesWithRisk.filter(
    (p) => p.climateRisk && ["medium", "high", "extreme"].includes(p.climateRisk.overallRisk)
  ).length;

  const highFloodCount = propertiesWithRisk.filter(
    (p) => p.climateRisk && ["high", "extreme"].includes(p.climateRisk.floodRisk)
  ).length;

  const highBushfireCount = propertiesWithRisk.filter(
    (p) => p.climateRisk && ["high", "extreme"].includes(p.climateRisk.bushfireRisk)
  ).length;

  // Don't show widget if no properties have elevated risk
  if (elevatedRiskCount === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
            <Shield className="w-4 h-4 text-orange-500" />
          </div>
          <CardTitle className="text-base">Climate Exposure</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="h-4 w-4 text-orange-500" />
          <span className="text-sm">
            <strong>{elevatedRiskCount}</strong> of {properties.length} properties in elevated risk zones
          </span>
        </div>

        <div className="text-xs text-muted-foreground space-y-1">
          {highFloodCount > 0 && (
            <p>{highFloodCount} with high/extreme flood risk</p>
          )}
          {highBushfireCount > 0 && (
            <p>{highBushfireCount} with high/extreme bushfire risk</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
