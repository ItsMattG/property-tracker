"use client";

import { Trophy } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface AchievementProgressProps {
  achieved: number;
  total: number;
}

export function AchievementProgress({ achieved, total }: AchievementProgressProps) {
  if (total === 0) return null;

  const percent = Math.round((achieved / total) * 100);

  return (
    <Card>
      <CardContent className="flex items-center gap-4 py-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <Trophy className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Achievements</span>
            <span className="text-muted-foreground">
              {achieved}/{total}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
