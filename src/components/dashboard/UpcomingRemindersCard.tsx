"use client";

import Link from "next/link";
import { Bell, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc/client";

function getDaysUntil(dueDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function UpcomingRemindersCard() {
  const { data: reminders, isLoading } = trpc.reminder.getUpcoming.useQuery(
    { days: 90 },
    { staleTime: 60_000 }
  );

  // Show max 5 items
  const items = reminders?.slice(0, 5) ?? [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="w-4 h-4" />
            Upcoming Reminders
          </CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/reminders">
              View All
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="py-4 text-center text-sm text-muted-foreground">
            Loading...
          </div>
        ) : items.length === 0 ? (
          <div className="py-4 text-center">
            <p className="text-sm text-muted-foreground">
              No upcoming reminders
            </p>
            <Button variant="link" size="sm" asChild>
              <Link href="/reminders">Add a reminder</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((r) => {
              const days = getDaysUntil(r.dueDate);
              return (
                <div
                  key={r.id}
                  className="flex items-center justify-between text-sm"
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">{r.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(r.dueDate).toLocaleDateString("en-AU", {
                        day: "numeric",
                        month: "short",
                      })}
                    </p>
                  </div>
                  {days < 0 ? (
                    <Badge variant="destructive" className="text-xs flex-shrink-0">
                      Overdue
                    </Badge>
                  ) : days <= 7 ? (
                    <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 text-xs flex-shrink-0">
                      {days}d
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      {days}d
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
