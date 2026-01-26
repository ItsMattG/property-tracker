"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Trophy, Settings2 } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Collapsible,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { formatMilestone } from "@/lib/equity-milestones";

interface MilestonesCardProps {
  propertyId: string;
}

export function MilestonesCard({ propertyId }: MilestonesCardProps) {
  const [showSettings, setShowSettings] = useState(false);
  const utils = trpc.useUtils();

  const { data: milestones } = trpc.property.getMilestones.useQuery({ propertyId });
  const { data: globalPrefs } = trpc.milestonePreferences.getGlobal.useQuery();
  const { data: override } = trpc.milestonePreferences.getPropertyOverride.useQuery({ propertyId });

  const updateOverrideMutation = trpc.milestonePreferences.updatePropertyOverride.useMutation({
    onSuccess: () => {
      utils.milestonePreferences.getPropertyOverride.invalidate({ propertyId });
    },
  });

  const deleteOverrideMutation = trpc.milestonePreferences.deletePropertyOverride.useMutation({
    onSuccess: () => {
      utils.milestonePreferences.getPropertyOverride.invalidate({ propertyId });
    },
  });

  const hasOverride = override !== null && override !== undefined;
  const isEnabled = hasOverride && override.enabled !== null ? override.enabled : (globalPrefs?.enabled ?? true);

  const currentLvrThresholds = hasOverride && override.lvrThresholds
    ? (override.lvrThresholds as number[])
    : (globalPrefs?.lvrThresholds as number[] ?? [80, 60, 40, 20]);

  const currentEquityThresholds = hasOverride && override.equityThresholds
    ? (override.equityThresholds as number[])
    : (globalPrefs?.equityThresholds as number[] ?? [100000, 250000, 500000, 1000000]);

  const toggleOverride = (useGlobal: boolean) => {
    if (useGlobal) {
      deleteOverrideMutation.mutate({ propertyId });
    } else {
      updateOverrideMutation.mutate({
        propertyId,
        lvrThresholds: null,
        equityThresholds: null,
        enabled: null,
      });
    }
  };

  const toggleEnabled = () => {
    updateOverrideMutation.mutate({
      propertyId,
      enabled: !isEnabled,
    });
  };

  const toggleLvrThreshold = (threshold: number) => {
    const newThresholds = currentLvrThresholds.includes(threshold)
      ? currentLvrThresholds.filter((t) => t !== threshold)
      : [...currentLvrThresholds, threshold].sort((a, b) => b - a);
    updateOverrideMutation.mutate({
      propertyId,
      lvrThresholds: newThresholds,
    });
  };

  const toggleEquityThreshold = (threshold: number) => {
    const newThresholds = currentEquityThresholds.includes(threshold)
      ? currentEquityThresholds.filter((t) => t !== threshold)
      : [...currentEquityThresholds, threshold].sort((a, b) => a - b);
    updateOverrideMutation.mutate({
      propertyId,
      equityThresholds: newThresholds,
    });
  };

  const formatEquity = (value: number) => {
    return value >= 1000000 ? `$${value / 1000000}M` : `$${value / 1000}k`;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-500" />
          Milestones
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowSettings(!showSettings)}
        >
          <Settings2 className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Achieved milestones */}
        {milestones && milestones.length > 0 ? (
          <ul className="space-y-2">
            {milestones.map((milestone) => (
              <li key={milestone.id} className="flex justify-between items-center text-sm">
                <span className="font-medium">
                  {formatMilestone(milestone.milestoneType, Number(milestone.milestoneValue))}
                </span>
                <span className="text-muted-foreground">
                  {format(new Date(milestone.achievedAt), "dd MMM yyyy")}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No milestones achieved yet</p>
        )}

        {/* Settings collapsible */}
        <Collapsible open={showSettings} onOpenChange={setShowSettings}>
          <CollapsibleContent className="space-y-4 pt-4 border-t">
            <div className="flex items-center justify-between">
              <Label htmlFor="use-global">Use global settings</Label>
              <Switch
                id="use-global"
                checked={!hasOverride}
                onCheckedChange={(checked) => toggleOverride(checked)}
              />
            </div>

            {hasOverride && (
              <>
                <div className="flex items-center justify-between">
                  <Label htmlFor="enabled">Enable for this property</Label>
                  <Switch
                    id="enabled"
                    checked={isEnabled}
                    onCheckedChange={toggleEnabled}
                  />
                </div>

                {isEnabled && (
                  <>
                    <div>
                      <Label className="text-xs text-muted-foreground mb-2 block">
                        LVR Thresholds
                      </Label>
                      <div className="flex flex-wrap gap-1">
                        {[80, 60, 40, 20].map((t) => (
                          <Badge
                            key={t}
                            variant={currentLvrThresholds.includes(t) ? "default" : "outline"}
                            className="cursor-pointer text-xs"
                            onClick={() => toggleLvrThreshold(t)}
                          >
                            {t}%
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div>
                      <Label className="text-xs text-muted-foreground mb-2 block">
                        Equity Thresholds
                      </Label>
                      <div className="flex flex-wrap gap-1">
                        {[100000, 250000, 500000, 1000000].map((t) => (
                          <Badge
                            key={t}
                            variant={currentEquityThresholds.includes(t) ? "default" : "outline"}
                            className="cursor-pointer text-xs"
                            onClick={() => toggleEquityThreshold(t)}
                          >
                            {formatEquity(t)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
