"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  AlertCircle,
  ArrowUp,
  ArrowRight,
  ArrowDown,
  CheckSquare,
} from "lucide-react";
import { format, parseISO, isPast, isToday } from "date-fns";
import { TaskSlideOver } from "@/components/tasks/TaskSlideOver";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface PropertyTasksSectionProps {
  propertyId: string;
}

const PRIORITY_ICONS = {
  urgent: { icon: AlertCircle, className: "text-red-600" },
  high: { icon: ArrowUp, className: "text-orange-500" },
  normal: { icon: ArrowRight, className: "text-blue-500" },
  low: { icon: ArrowDown, className: "text-gray-400" },
};

const STATUS_BADGE = {
  todo: { label: "To Do", variant: "outline" as const },
  in_progress: { label: "In Progress", variant: "default" as const },
  done: { label: "Done", variant: "secondary" as const },
};

export function PropertyTasksSection({ propertyId }: PropertyTasksSectionProps) {
  const [slideOverOpen, setSlideOverOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | undefined>();

  const { data: tasksList, isLoading } = trpc.task.list.useQuery({
    propertyId,
    sortBy: "createdAt",
    sortDir: "desc",
    limit: 5,
  });

  const openTasks = tasksList?.filter((t) => t.status !== "done") || [];

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CheckSquare className="h-5 w-5" />
            Tasks
            {openTasks.length > 0 && (
              <Badge variant="secondary">{openTasks.length} open</Badge>
            )}
          </CardTitle>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setEditingTaskId(undefined);
                setSlideOverOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
            <Link href={`/properties/${propertyId}/tasks`}>
              <Button size="sm" variant="ghost">
                View All
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Loading...</p>
          ) : !tasksList?.length ? (
            <p className="text-muted-foreground text-sm">
              No tasks for this property.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasksList.map((task) => {
                  const p = PRIORITY_ICONS[task.priority as keyof typeof PRIORITY_ICONS];
                  const Icon = p.icon;
                  const s = STATUS_BADGE[task.status as keyof typeof STATUS_BADGE];
                  const isOverdue =
                    task.dueDate &&
                    task.status !== "done" &&
                    isPast(parseISO(task.dueDate)) &&
                    !isToday(parseISO(task.dueDate));

                  return (
                    <TableRow
                      key={task.id}
                      className="cursor-pointer"
                      onClick={() => {
                        setEditingTaskId(task.id);
                        setSlideOverOpen(true);
                      }}
                    >
                      <TableCell>
                        <Icon className={cn("h-4 w-4", p.className)} />
                      </TableCell>
                      <TableCell className="font-medium">{task.title}</TableCell>
                      <TableCell>
                        {task.dueDate ? (
                          <span className={cn(isOverdue && "text-red-600")}>
                            {format(parseISO(task.dueDate), "dd MMM")}
                          </span>
                        ) : (
                          "\u2014"
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={s.variant}>{s.label}</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <TaskSlideOver
        open={slideOverOpen}
        onOpenChange={setSlideOverOpen}
        taskId={editingTaskId}
        defaultPropertyId={propertyId}
      />
    </>
  );
}
