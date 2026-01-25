"use client";

import { format } from "date-fns";
import { Trophy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMilestone } from "@/lib/equity-milestones";

interface Milestone {
  id: string;
  milestoneType: "lvr" | "equity_amount";
  milestoneValue: string;
  achievedAt: Date | string;
}

interface MilestonesSectionProps {
  milestones: Milestone[];
}

export function MilestonesSection({ milestones }: MilestonesSectionProps) {
  if (milestones.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-500" />
          Milestones Achieved
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {milestones.map((milestone) => (
            <li key={milestone.id} className="flex justify-between items-center">
              <span className="font-medium">
                {formatMilestone(milestone.milestoneType, Number(milestone.milestoneValue))}
              </span>
              <span className="text-sm text-muted-foreground">
                {format(new Date(milestone.achievedAt), "dd MMM yyyy")}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
