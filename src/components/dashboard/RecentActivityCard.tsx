"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc/client";
import Link from "next/link";
import { Receipt, Home, Landmark, Activity } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const typeIcons = {
  transaction: Receipt,
  property: Home,
  loan: Landmark,
};

const typeColors = {
  transaction: "text-blue-500",
  property: "text-green-500",
  loan: "text-orange-500",
};

export function RecentActivityCard() {
  const { data: activities, isLoading } = trpc.activity.getRecent.useQuery(undefined, {
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Recent Activity</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-muted animate-pulse" />
                <div className="flex-1 space-y-1">
                  <div className="h-4 bg-muted animate-pulse rounded w-3/4" />
                  <div className="h-3 bg-muted animate-pulse rounded w-1/4" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!activities || activities.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Recent Activity</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-1">
          {activities.map((activity, i) => {
            const Icon = typeIcons[activity.type];
            const color = typeColors[activity.type];

            return (
              <Link
                key={`${activity.type}-${i}`}
                href={activity.href}
                prefetch={false}
                className="flex items-center gap-3 py-2 hover:bg-muted/50 -mx-2 px-2 rounded-md transition-colors group"
              >
                <div className={`w-7 h-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0`}>
                  <Icon className={`h-3.5 w-3.5 ${color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{activity.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
