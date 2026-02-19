"use client";

import { useState, useMemo } from "react";
import { Bell, Check, List, CalendarDays, Plus, Trash2, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { DataSkeleton } from "@/components/ui/data-skeleton";
import { trpc } from "@/lib/trpc/client";
import { getErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Constants & helpers
// ---------------------------------------------------------------------------

type ViewMode = "list" | "calendar";

const REMINDER_TYPE_LABELS: Record<string, string> = {
  lease_expiry: "Lease Expiry",
  insurance_renewal: "Insurance Renewal",
  fixed_rate_expiry: "Fixed Rate Expiry",
  council_rates: "Council Rates",
  body_corporate: "Body Corporate",
  smoke_alarm: "Smoke Alarm Compliance",
  pool_safety: "Pool Safety Certificate",
  tax_return: "Tax Return",
  custom: "Custom",
};

function getDaysUntil(dueDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate + "T00:00:00");
  return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function CountdownBadge({ dueDate }: { dueDate: string }) {
  const days = getDaysUntil(dueDate);

  if (days < 0) {
    return (
      <Badge variant="destructive">
        {Math.abs(days)}d overdue
      </Badge>
    );
  }

  if (days === 0) {
    return <Badge variant="destructive">Due today</Badge>;
  }

  if (days <= 7) {
    return <Badge variant="warning">{days}d left</Badge>;
  }

  return <Badge variant="secondary">{days}d left</Badge>;
}

// ---------------------------------------------------------------------------
// Grouping helpers
// ---------------------------------------------------------------------------

interface ReminderItem {
  id: string;
  propertyId: string;
  reminderType: string;
  title: string;
  dueDate: string;
  reminderDaysBefore: number[] | null;
  notes: string | null;
  completedAt: Date | string | null;
  createdAt: Date | string;
}

interface GroupedReminders {
  overdue: ReminderItem[];
  thisWeek: ReminderItem[];
  thisMonth: ReminderItem[];
  later: ReminderItem[];
  completed: ReminderItem[];
}

function groupReminders(reminders: ReminderItem[]): GroupedReminders {
  const groups: GroupedReminders = {
    overdue: [],
    thisWeek: [],
    thisMonth: [],
    later: [],
    completed: [],
  };

  for (const r of reminders) {
    if (r.completedAt) {
      groups.completed.push(r);
      continue;
    }

    const days = getDaysUntil(r.dueDate);

    if (days < 0) {
      groups.overdue.push(r);
    } else if (days <= 7) {
      groups.thisWeek.push(r);
    } else if (days <= 30) {
      groups.thisMonth.push(r);
    } else {
      groups.later.push(r);
    }
  }

  // Sort each group by due date ascending
  const sortByDue = (a: ReminderItem, b: ReminderItem) =>
    a.dueDate.localeCompare(b.dueDate);
  groups.overdue.sort(sortByDue);
  groups.thisWeek.sort(sortByDue);
  groups.thisMonth.sort(sortByDue);
  groups.later.sort(sortByDue);
  // Completed: most recently completed first
  groups.completed.sort((a, b) => {
    const aDate = a.completedAt ? new Date(a.completedAt).getTime() : 0;
    const bDate = b.completedAt ? new Date(b.completedAt).getTime() : 0;
    return bDate - aDate;
  });

  return groups;
}

const GROUP_CONFIG: {
  key: keyof GroupedReminders;
  label: string;
  emptyLabel: string;
}[] = [
  { key: "overdue", label: "Overdue", emptyLabel: "No overdue reminders" },
  { key: "thisWeek", label: "This Week", emptyLabel: "Nothing due this week" },
  { key: "thisMonth", label: "This Month", emptyLabel: "Nothing due this month" },
  { key: "later", label: "Later", emptyLabel: "No upcoming reminders" },
  { key: "completed", label: "Completed", emptyLabel: "No completed reminders" },
];

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function RemindersPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Data
  const { data: reminders, isLoading } = trpc.reminder.list.useQuery({});
  const { data: properties } = trpc.property.list.useQuery();
  const utils = trpc.useUtils();

  // Property lookup map
  const propertyMap = useMemo(() => {
    const map = new Map<string, string>();
    if (properties) {
      for (const p of properties) {
        map.set(p.id, `${p.address}, ${p.suburb}`);
      }
    }
    return map;
  }, [properties]);

  // Mutations
  const completeMutation = trpc.reminder.complete.useMutation({
    onSuccess: () => {
      toast.success("Reminder marked as complete");
      utils.reminder.list.invalidate();
      utils.reminder.getUpcoming.invalidate();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const deleteMutation = trpc.reminder.delete.useMutation({
    onSuccess: () => {
      toast.success("Reminder deleted");
      setDeleteId(null);
      utils.reminder.list.invalidate();
      utils.reminder.getUpcoming.invalidate();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const handleComplete = (id: string) => {
    completeMutation.mutate({ id });
  };

  const handleDelete = () => {
    if (deleteId) {
      deleteMutation.mutate({ id: deleteId });
    }
  };

  // Grouped data
  const grouped = useMemo(
    () => groupReminders((reminders as ReminderItem[]) ?? []),
    [reminders]
  );

  const totalActive = reminders
    ? reminders.filter((r) => !r.completedAt).length
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reminders</h1>
          <p className="text-muted-foreground">
            {totalActive} active reminder{totalActive !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle pills */}
          <div className="flex rounded-md border">
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("list")}
              aria-label="List view"
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "calendar" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("calendar")}
              aria-label="Calendar view"
            >
              <CalendarDays className="h-4 w-4" />
            </Button>
          </div>
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Add Reminder
          </Button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <DataSkeleton variant="list" count={5} />
      ) : !reminders?.length ? (
        <EmptyState
          icon={Bell}
          title="No reminders yet"
          description="Set up reminders for lease expiries, insurance renewals, and other important property dates."
          action={{
            label: "Add Reminder",
            onClick: () => setShowAddDialog(true),
          }}
        />
      ) : viewMode === "list" ? (
        <div className="space-y-6">
          {GROUP_CONFIG.map(({ key, label }) => {
            const items = grouped[key];
            if (items.length === 0) return null;

            return (
              <div key={key} className="space-y-2">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    {label}
                  </h2>
                  <Badge variant="secondary" className="text-xs">
                    {items.length}
                  </Badge>
                </div>
                <div className="space-y-2">
                  {items.map((reminder) => (
                    <Card key={reminder.id} className={cn(
                      "transition-opacity",
                      reminder.completedAt && "opacity-60"
                    )}>
                      <CardContent className="flex items-center justify-between py-3 px-4">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          {/* Complete button */}
                          {!reminder.completedAt && (
                            <button
                              onClick={() => handleComplete(reminder.id)}
                              disabled={completeMutation.isPending}
                              className="flex-shrink-0 h-5 w-5 rounded-full border-2 border-muted-foreground/30 hover:border-primary hover:bg-primary/10 transition-colors"
                              aria-label="Mark as complete"
                            />
                          )}
                          {reminder.completedAt && (
                            <div className="flex-shrink-0 h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center">
                              <Check className="h-3 w-3 text-primary" />
                            </div>
                          )}

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className={cn(
                                "font-medium text-sm truncate",
                                reminder.completedAt && "line-through text-muted-foreground"
                              )}>
                                {reminder.title}
                              </span>
                              <Badge variant="outline" className="text-xs flex-shrink-0">
                                {REMINDER_TYPE_LABELS[reminder.reminderType] ?? reminder.reminderType}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground truncate">
                              {propertyMap.get(reminder.propertyId) ?? "Unknown property"}
                              {" \u00B7 "}
                              Due {formatDate(reminder.dueDate)}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                          {!reminder.completedAt && (
                            <CountdownBadge dueDate={reminder.dueDate} />
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon-sm" aria-label="Actions">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {!reminder.completedAt && (
                                <DropdownMenuItem onClick={() => handleComplete(reminder.id)}>
                                  <Check className="h-4 w-4 mr-2" />
                                  Mark Complete
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => setDeleteId(reminder.id)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Calendar view placeholder — Task 6 */
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Calendar view coming soon...
          </CardContent>
        </Card>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete reminder?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The reminder will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
