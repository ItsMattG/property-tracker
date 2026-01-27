"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent } from "@/components/ui/card";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  AlertCircle,
  ArrowUp,
  ArrowRight,
  ArrowDown,
} from "lucide-react";
import { format, parseISO, isPast, isToday } from "date-fns";
import { TaskSlideOver } from "@/components/tasks/TaskSlideOver";
import { cn } from "@/lib/utils";

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

export default function PropertyTasksPage() {
  const params = useParams();
  const propertyId = params?.id as string;

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [slideOverOpen, setSlideOverOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | undefined>();

  const { data: tasksList, isLoading } = trpc.task.list.useQuery({
    propertyId,
    status: statusFilter !== "all" ? (statusFilter as "todo" | "in_progress" | "done") : undefined,
    sortBy: "createdAt",
    sortDir: "desc",
    limit: 100,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Tasks</h2>
        <Button
          onClick={() => {
            setEditingTaskId(undefined);
            setSlideOverOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-1" />
          New Task
        </Button>
      </div>

      <div className="flex gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="todo">To Do</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="done">Done</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Loading...
          </CardContent>
        </Card>
      ) : !tasksList?.length ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No tasks for this property.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assignee</TableHead>
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
                    <TableCell className={p.className}>
                      {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                    </TableCell>
                    <TableCell>
                      {task.dueDate ? (
                        <span className={cn(isOverdue && "text-red-600")}>
                          {format(parseISO(task.dueDate), "dd MMM yyyy")}
                        </span>
                      ) : (
                        "\u2014"
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={s.variant}>{s.label}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {task.assigneeEmail || "\u2014"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      <TaskSlideOver
        open={slideOverOpen}
        onOpenChange={setSlideOverOpen}
        taskId={editingTaskId}
        defaultPropertyId={propertyId}
      />
    </div>
  );
}
