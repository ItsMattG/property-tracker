"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  List,
  LayoutGrid,
  AlertCircle,
  ArrowUp,
  ArrowRight,
  ArrowDown,
  Circle,
} from "lucide-react";
import { format, parseISO, isPast, isToday } from "date-fns";
import { TaskSlideOver } from "@/components/tasks/TaskSlideOver";
import { cn } from "@/lib/utils";

type ViewMode = "list" | "kanban";
type TaskStatus = "todo" | "in_progress" | "done";
type TaskPriority = "urgent" | "high" | "normal" | "low";

const PRIORITY_CONFIG: Record<
  TaskPriority,
  { label: string; icon: typeof AlertCircle; className: string }
> = {
  urgent: { label: "Urgent", icon: AlertCircle, className: "text-red-600" },
  high: { label: "High", icon: ArrowUp, className: "text-orange-500" },
  normal: { label: "Normal", icon: ArrowRight, className: "text-blue-500" },
  low: { label: "Low", icon: ArrowDown, className: "text-gray-400" },
};

const STATUS_CONFIG: Record<TaskStatus, { label: string; variant: "default" | "secondary" | "outline" }> = {
  todo: { label: "To Do", variant: "outline" },
  in_progress: { label: "In Progress", variant: "default" },
  done: { label: "Done", variant: "secondary" },
};

export default function TasksPage() {
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("tasks-view") as ViewMode) || "list";
    }
    return "list";
  });
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [propertyFilter, setPropertyFilter] = useState<string>("all");
  const [slideOverOpen, setSlideOverOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | undefined>();

  const { data: tasksList, isLoading } = trpc.task.list.useQuery({
    status: statusFilter !== "all" ? (statusFilter as TaskStatus) : undefined,
    priority:
      priorityFilter !== "all" ? (priorityFilter as TaskPriority) : undefined,
    propertyId: propertyFilter !== "all" ? propertyFilter : undefined,
    sortBy: "createdAt",
    sortDir: "desc",
    limit: 100,
  });

  const { data: counts } = trpc.task.counts.useQuery();
  const { data: propertiesList } = trpc.property.list.useQuery();
  const utils = trpc.useUtils();
  const updateStatus = trpc.task.updateStatus.useMutation({
    onSuccess: () => {
      utils.task.list.invalidate();
      utils.task.counts.invalidate();
    },
  });

  const toggleView = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem("tasks-view", mode);
  };

  const openCreate = () => {
    setEditingTaskId(undefined);
    setSlideOverOpen(true);
  };

  const openEdit = (taskId: string) => {
    setEditingTaskId(taskId);
    setSlideOverOpen(true);
  };

  const isDueDateWarning = (dueDate: string | null, status: string) => {
    if (!dueDate || status === "done") return null;
    const d = parseISO(dueDate);
    if (isPast(d) && !isToday(d)) return "overdue";
    if (isToday(d)) return "today";
    return null;
  };

  const totalOpen = (counts?.todo || 0) + (counts?.in_progress || 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Tasks</h1>
          <p className="text-muted-foreground">
            {totalOpen} open task{totalOpen !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex border rounded-md">
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="sm"
              onClick={() => toggleView("list")}
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "kanban" ? "default" : "ghost"}
              size="sm"
              onClick={() => toggleView("kanban")}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" />
            New Task
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="todo">To Do</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="done">Done</SelectItem>
          </SelectContent>
        </Select>

        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-full sm:w-[140px]">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            <SelectItem value="urgent">Urgent</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="normal">Normal</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>

        <Select value={propertyFilter} onValueChange={setPropertyFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Property" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Properties</SelectItem>
            {propertiesList?.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.address}, {p.suburb}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Content */}
      {isLoading ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Loading tasks...
          </CardContent>
        </Card>
      ) : !tasksList?.length ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Circle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium">No tasks yet</h3>
            <p className="text-muted-foreground mt-1">
              Create your first task to start tracking property to-dos.
            </p>
            <Button className="mt-4" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1" />
              New Task
            </Button>
          </CardContent>
        </Card>
      ) : viewMode === "list" ? (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Property</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assignee</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasksList.map((task) => {
                const priorityCfg = PRIORITY_CONFIG[task.priority as TaskPriority];
                const PriorityIcon = priorityCfg.icon;
                const statusCfg = STATUS_CONFIG[task.status as TaskStatus];
                const dueDateWarning = isDueDateWarning(task.dueDate, task.status);

                return (
                  <TableRow
                    key={task.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => openEdit(task.id)}
                  >
                    <TableCell>
                      <PriorityIcon
                        className={cn("h-4 w-4", priorityCfg.className)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      {task.title}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {task.propertyName || "\u2014"}
                    </TableCell>
                    <TableCell>
                      <span className={priorityCfg.className}>
                        {priorityCfg.label}
                      </span>
                    </TableCell>
                    <TableCell>
                      {task.dueDate ? (
                        <span
                          className={cn(
                            dueDateWarning === "overdue" && "text-red-600 font-medium",
                            dueDateWarning === "today" && "text-orange-500 font-medium"
                          )}
                        >
                          {format(parseISO(task.dueDate), "dd MMM yyyy")}
                          {dueDateWarning === "overdue" && " (overdue)"}
                          {dueDateWarning === "today" && " (today)"}
                        </span>
                      ) : (
                        "\u2014"
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusCfg.variant}>
                        {statusCfg.label}
                      </Badge>
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
      ) : (
        /* Kanban View */
        <div className="grid grid-cols-3 gap-4">
          {(["todo", "in_progress", "done"] as const).map((status) => {
            const statusCfg = STATUS_CONFIG[status];
            const columnTasks = tasksList.filter((t) => t.status === status);
            const countLabel = counts?.[status] || 0;

            return (
              <div key={status} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm">
                    {statusCfg.label}
                  </h3>
                  <Badge variant="secondary">{countLabel}</Badge>
                </div>
                <div className="space-y-2 min-h-[200px]">
                  {columnTasks.map((task) => {
                    const priorityCfg =
                      PRIORITY_CONFIG[task.priority as TaskPriority];
                    const dueDateWarning = isDueDateWarning(
                      task.dueDate,
                      task.status
                    );

                    return (
                      <Card
                        key={task.id}
                        className="cursor-pointer hover:shadow-md transition-shadow"
                        onClick={() => openEdit(task.id)}
                      >
                        <CardContent className="p-3 space-y-2">
                          <div className="flex items-start gap-2">
                            <div
                              className={cn(
                                "w-1 h-full min-h-[20px] rounded-full flex-shrink-0",
                                task.priority === "urgent" && "bg-red-500",
                                task.priority === "high" && "bg-orange-400",
                                task.priority === "normal" && "bg-blue-400",
                                task.priority === "low" && "bg-gray-300"
                              )}
                            />
                            <p className="text-sm font-medium leading-tight">
                              {task.title}
                            </p>
                          </div>
                          {task.propertyName && (
                            <p className="text-xs text-muted-foreground pl-3">
                              {task.propertyName}
                            </p>
                          )}
                          <div className="flex items-center justify-between pl-3">
                            {task.dueDate ? (
                              <span
                                className={cn(
                                  "text-xs",
                                  dueDateWarning === "overdue" &&
                                    "text-red-600 font-medium",
                                  dueDateWarning === "today" &&
                                    "text-orange-500",
                                  !dueDateWarning && "text-muted-foreground"
                                )}
                              >
                                {format(parseISO(task.dueDate), "dd MMM")}
                              </span>
                            ) : (
                              <span />
                            )}
                            {task.assigneeEmail && (
                              <span className="text-xs text-muted-foreground">
                                {task.assigneeEmail.split("@")[0]}
                              </span>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <TaskSlideOver
        open={slideOverOpen}
        onOpenChange={setSlideOverOpen}
        taskId={editingTaskId}
      />
    </div>
  );
}
