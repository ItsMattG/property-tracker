import type { Task, NewTask } from "../../db/schema";
import type { DB } from "../base";

export interface TaskFiltersInput {
  status?: "todo" | "in_progress" | "done";
  priority?: "urgent" | "high" | "normal" | "low";
  propertyId?: string;
  entityId?: string;
  assigneeId?: string;
  dueBefore?: string;
  dueAfter?: string;
  sortBy: "dueDate" | "priority" | "createdAt";
  sortDir: "asc" | "desc";
  limit: number;
  offset: number;
}

export interface TaskWithRelations {
  id: string;
  userId: string;
  assigneeId: string | null;
  propertyId: string | null;
  entityId: string | null;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  reminderOffset: number | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  propertyName: string | null;
  entityName: string | null;
  assigneeEmail: string | null;
}

export interface ITaskRepository {
  list(ownerId: string, filters: TaskFiltersInput): Promise<TaskWithRelations[]>;
  findById(id: string, ownerId: string): Promise<TaskWithRelations | null>;
  countByStatus(ownerId: string): Promise<Record<string, number>>;
  create(data: NewTask, tx?: DB): Promise<Task>;
  findByIdForOwner(id: string, ownerId: string): Promise<Task | null>;
  update(id: string, data: Partial<Task>, tx?: DB): Promise<Task>;
  delete(id: string, ownerId: string, tx?: DB): Promise<void>;
  validateAssigneeAccess(ownerId: string, assigneeId: string): Promise<boolean>;
}
