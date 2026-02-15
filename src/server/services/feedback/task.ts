import { differenceInCalendarDays, parseISO } from "date-fns";

export type TaskStatus = "todo" | "in_progress" | "done";
export type TaskPriority = "urgent" | "high" | "normal" | "low";

export function isOverdue(
  dueDate: string | null,
  status: TaskStatus,
  today: Date = new Date()
): boolean {
  if (!dueDate || status === "done") return false;
  return differenceInCalendarDays(parseISO(dueDate), today) < 0;
}

export function getDaysUntilDue(
  dueDate: string | null,
  today: Date = new Date()
): number | null {
  if (!dueDate) return null;
  return differenceInCalendarDays(parseISO(dueDate), today);
}

export function shouldSendReminder(
  dueDate: string | null,
  reminderOffset: number | null,
  status: TaskStatus,
  today: Date = new Date()
): boolean {
  if (!dueDate || reminderOffset === null || status === "done") return false;
  const daysUntil = differenceInCalendarDays(parseISO(dueDate), today);
  return daysUntil === reminderOffset;
}
