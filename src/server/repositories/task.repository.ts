import { eq, and, or, desc, asc, lte, gte, count } from "drizzle-orm";
import {
  tasks,
  properties,
  entities,
  users,
  portfolioMembers,
} from "../db/schema";
import type { Task, NewTask } from "../db/schema";
import { BaseRepository, type DB } from "./base";
import type {
  ITaskRepository,
  TaskFiltersInput,
  TaskWithRelations,
} from "./interfaces/task.repository.interface";

export class TaskRepository extends BaseRepository implements ITaskRepository {
  async list(
    ownerId: string,
    filters: TaskFiltersInput
  ): Promise<TaskWithRelations[]> {
    const conditions = [
      or(eq(tasks.userId, ownerId), eq(tasks.assigneeId, ownerId)),
    ];

    if (filters.status) conditions.push(eq(tasks.status, filters.status));
    if (filters.priority) conditions.push(eq(tasks.priority, filters.priority));
    if (filters.propertyId)
      conditions.push(eq(tasks.propertyId, filters.propertyId));
    if (filters.entityId)
      conditions.push(eq(tasks.entityId, filters.entityId));
    if (filters.assigneeId)
      conditions.push(eq(tasks.assigneeId, filters.assigneeId));
    if (filters.dueBefore)
      conditions.push(lte(tasks.dueDate, filters.dueBefore));
    if (filters.dueAfter)
      conditions.push(gte(tasks.dueDate, filters.dueAfter));

    const sortColumn =
      filters.sortBy === "dueDate"
        ? tasks.dueDate
        : filters.sortBy === "priority"
          ? tasks.priority
          : tasks.createdAt;
    const sortFn = filters.sortDir === "asc" ? asc : desc;

    const results = await this.db
      .select({
        task: tasks,
        propertyAddress: properties.address,
        propertySuburb: properties.suburb,
        entityName: entities.name,
        assigneeEmail: users.email,
      })
      .from(tasks)
      .leftJoin(properties, eq(tasks.propertyId, properties.id))
      .leftJoin(entities, eq(tasks.entityId, entities.id))
      .leftJoin(users, eq(tasks.assigneeId, users.id))
      .where(and(...conditions))
      .orderBy(sortFn(sortColumn))
      .limit(filters.limit)
      .offset(filters.offset);

    return results.map((r) => ({
      ...r.task,
      propertyName: r.propertyAddress
        ? `${r.propertyAddress}, ${r.propertySuburb}`
        : null,
      entityName: r.entityName,
      assigneeEmail: r.assigneeEmail,
    }));
  }

  async findById(
    id: string,
    ownerId: string
  ): Promise<TaskWithRelations | null> {
    const results = await this.db
      .select({
        task: tasks,
        propertyAddress: properties.address,
        propertySuburb: properties.suburb,
        entityName: entities.name,
        assigneeEmail: users.email,
      })
      .from(tasks)
      .leftJoin(properties, eq(tasks.propertyId, properties.id))
      .leftJoin(entities, eq(tasks.entityId, entities.id))
      .leftJoin(users, eq(tasks.assigneeId, users.id))
      .where(
        and(
          eq(tasks.id, id),
          or(eq(tasks.userId, ownerId), eq(tasks.assigneeId, ownerId))
        )
      )
      .limit(1);

    if (!results.length) return null;

    const r = results[0];
    return {
      ...r.task,
      propertyName: r.propertyAddress
        ? `${r.propertyAddress}, ${r.propertySuburb}`
        : null,
      entityName: r.entityName,
      assigneeEmail: r.assigneeEmail,
    };
  }

  async countByStatus(ownerId: string): Promise<Record<string, number>> {
    const result = await this.db
      .select({
        status: tasks.status,
        count: count(),
      })
      .from(tasks)
      .where(or(eq(tasks.userId, ownerId), eq(tasks.assigneeId, ownerId)))
      .groupBy(tasks.status);

    const counts: Record<string, number> = { todo: 0, in_progress: 0, done: 0 };
    for (const row of result) {
      counts[row.status] = Number(row.count);
    }
    return counts;
  }

  async create(data: NewTask, tx?: DB): Promise<Task> {
    const client = this.resolve(tx);
    const [task] = await client.insert(tasks).values(data).returning();
    return task;
  }

  async findByIdForOwner(id: string, ownerId: string): Promise<Task | null> {
    const result = await this.db.query.tasks.findFirst({
      where: and(eq(tasks.id, id), eq(tasks.userId, ownerId)),
    });
    return result ?? null;
  }

  async update(id: string, data: Partial<Task>, tx?: DB): Promise<Task> {
    const client = this.resolve(tx);
    const [updated] = await client
      .update(tasks)
      .set(data)
      .where(eq(tasks.id, id))
      .returning();
    return updated;
  }

  async delete(id: string, ownerId: string, tx?: DB): Promise<void> {
    const client = this.resolve(tx);
    await client
      .delete(tasks)
      .where(and(eq(tasks.id, id), eq(tasks.userId, ownerId)));
  }

  async validateAssigneeAccess(
    ownerId: string,
    assigneeId: string
  ): Promise<boolean> {
    if (assigneeId === ownerId) return true;
    const member = await this.db.query.portfolioMembers.findFirst({
      where: and(
        eq(portfolioMembers.ownerId, ownerId),
        eq(portfolioMembers.userId, assigneeId)
      ),
    });
    return !!member;
  }
}
