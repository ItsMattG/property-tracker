"use client";

import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { CalendarIcon, Trash2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface TaskSlideOverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId?: string;
  defaultPropertyId?: string;
  defaultEntityId?: string;
}

const PRIORITY_OPTIONS = [
  { value: "urgent", label: "Urgent", color: "text-red-600" },
  { value: "high", label: "High", color: "text-orange-500" },
  { value: "normal", label: "Normal", color: "text-blue-500" },
  { value: "low", label: "Low", color: "text-gray-400" },
];

const STATUS_OPTIONS = [
  { value: "todo", label: "To Do" },
  { value: "in_progress", label: "In Progress" },
  { value: "done", label: "Done" },
];

const REMINDER_OPTIONS = [
  { value: "none", label: "No reminder" },
  { value: "0", label: "On due date" },
  { value: "1", label: "1 day before" },
  { value: "2", label: "2 days before" },
  { value: "3", label: "3 days before" },
  { value: "7", label: "1 week before" },
];

export function TaskSlideOver({
  open,
  onOpenChange,
  taskId,
  defaultPropertyId,
  defaultEntityId,
}: TaskSlideOverProps) {
  const utils = trpc.useUtils();
  const isEditing = !!taskId;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("todo");
  const [priority, setPriority] = useState("normal");
  const [propertyId, setPropertyId] = useState<string | undefined>(
    defaultPropertyId
  );
  const [entityId, setEntityId] = useState<string | undefined>(
    defaultEntityId
  );
  const [assigneeId, setAssigneeId] = useState<string | undefined>();
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [reminderOffset, setReminderOffset] = useState("none");

  const { data: existingTask } = trpc.task.getById.useQuery(
    { id: taskId! },
    { enabled: !!taskId }
  );

  const { data: propertiesList } = trpc.property.list.useQuery();
  const { data: entitiesList } = trpc.entity.list.useQuery();

  // Load existing task data
  useEffect(() => {
    if (existingTask) {
      setTitle(existingTask.title);
      setDescription(existingTask.description || "");
      setStatus(existingTask.status);
      setPriority(existingTask.priority);
      setPropertyId(existingTask.propertyId || undefined);
      setEntityId(existingTask.entityId || undefined);
      setAssigneeId(existingTask.assigneeId || undefined);
      setDueDate(existingTask.dueDate ? parseISO(existingTask.dueDate) : undefined);
      setReminderOffset(
        existingTask.reminderOffset !== null
          ? String(existingTask.reminderOffset)
          : "none"
      );
    }
  }, [existingTask]);

  // Reset form when opening for new task
  useEffect(() => {
    if (open && !taskId) {
      setTitle("");
      setDescription("");
      setStatus("todo");
      setPriority("normal");
      setPropertyId(defaultPropertyId);
      setEntityId(defaultEntityId);
      setAssigneeId(undefined);
      setDueDate(undefined);
      setReminderOffset("none");
    }
  }, [open, taskId, defaultPropertyId, defaultEntityId]);

  const invalidate = () => {
    utils.task.list.invalidate();
    utils.task.counts.invalidate();
    if (taskId) utils.task.getById.invalidate({ id: taskId });
  };

  const createMutation = trpc.task.create.useMutation({
    onSuccess: () => {
      toast.success("Task created");
      invalidate();
      onOpenChange(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.task.update.useMutation({
    onSuccess: () => {
      toast.success("Task updated");
      invalidate();
      onOpenChange(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.task.delete.useMutation({
    onSuccess: () => {
      toast.success("Task deleted");
      invalidate();
      onOpenChange(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSubmit = () => {
    const data = {
      title,
      description: description || undefined,
      status: status as "todo" | "in_progress" | "done",
      priority: priority as "urgent" | "high" | "normal" | "low",
      propertyId: propertyId || undefined,
      entityId: entityId || undefined,
      assigneeId: assigneeId || undefined,
      dueDate: dueDate ? format(dueDate, "yyyy-MM-dd") : undefined,
      reminderOffset:
        reminderOffset !== "none" ? Number(reminderOffset) : undefined,
    };

    if (isEditing) {
      updateMutation.mutate({ id: taskId, ...data });
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEditing ? "Edit Task" : "New Task"}</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 py-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              placeholder="e.g., Fix leaky tap at 123 Main St"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Optional details..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          {/* Status & Priority row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <span className={opt.color}>{opt.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Property */}
          <div className="space-y-2">
            <Label>Property</Label>
            <Select
              value={propertyId || "none"}
              onValueChange={(v) => setPropertyId(v === "none" ? undefined : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {propertiesList?.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.address}, {p.suburb}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Entity */}
          <div className="space-y-2">
            <Label>Entity</Label>
            <Select
              value={entityId || "none"}
              onValueChange={(v) => setEntityId(v === "none" ? undefined : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {entitiesList?.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Due Date */}
          <div className="space-y-2">
            <Label>Due Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !dueDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dueDate ? format(dueDate, "PPP") : "No due date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dueDate}
                  onSelect={setDueDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            {dueDate && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDueDate(undefined);
                  setReminderOffset("none");
                }}
              >
                Clear date
              </Button>
            )}
          </div>

          {/* Reminder — only show when due date set */}
          {dueDate && (
            <div className="space-y-2">
              <Label>Reminder</Label>
              <Select value={reminderOffset} onValueChange={setReminderOffset}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REMINDER_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <SheetFooter className="flex justify-between">
          {isEditing && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete task?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => deleteMutation.mutate({ id: taskId })}
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={!title || isPending}>
              {isPending ? "Saving..." : isEditing ? "Save" : "Create"}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
