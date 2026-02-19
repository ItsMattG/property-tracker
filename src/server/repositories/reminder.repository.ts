import { eq, and, gte, lte, isNull, sql } from "drizzle-orm";
import { propertyReminders, users, properties } from "../db/schema";
import type { PropertyReminder, NewPropertyReminder } from "../db/schema";
import { BaseRepository, type DB } from "./base";
import type { IReminderRepository } from "./interfaces/reminder.repository.interface";

export class ReminderRepository
  extends BaseRepository
  implements IReminderRepository
{
  async findByOwner(
    userId: string,
    opts?: { propertyId?: string }
  ): Promise<PropertyReminder[]> {
    const conditions = [eq(propertyReminders.userId, userId)];
    if (opts?.propertyId) {
      conditions.push(eq(propertyReminders.propertyId, opts.propertyId));
    }

    return this.db.query.propertyReminders.findMany({
      where: and(...conditions),
      orderBy: (r, { asc }) => [asc(r.dueDate)],
    });
  }

  async findById(id: string, userId: string): Promise<PropertyReminder | null> {
    const result = await this.db.query.propertyReminders.findFirst({
      where: and(
        eq(propertyReminders.id, id),
        eq(propertyReminders.userId, userId)
      ),
    });
    return result ?? null;
  }

  async findUpcoming(userId: string, days: number): Promise<PropertyReminder[]> {
    const today = new Date().toISOString().split("T")[0];
    const future = new Date();
    future.setDate(future.getDate() + days);
    const futureDate = future.toISOString().split("T")[0];

    return this.db.query.propertyReminders.findMany({
      where: and(
        eq(propertyReminders.userId, userId),
        gte(propertyReminders.dueDate, today),
        lte(propertyReminders.dueDate, futureDate),
        isNull(propertyReminders.completedAt)
      ),
      orderBy: (r, { asc }) => [asc(r.dueDate)],
    });
  }

  async findByMonth(
    userId: string,
    year: number,
    month: number
  ): Promise<PropertyReminder[]> {
    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    // Last day of month: create date for first of next month, subtract one day
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    return this.db.query.propertyReminders.findMany({
      where: and(
        eq(propertyReminders.userId, userId),
        gte(propertyReminders.dueDate, startDate),
        lte(propertyReminders.dueDate, endDate),
        isNull(propertyReminders.completedAt)
      ),
      orderBy: (r, { asc }) => [asc(r.dueDate)],
    });
  }

  async findDueForNotification(
    today: string
  ): Promise<(PropertyReminder & { userEmail: string; propertyAddress: string })[]> {
    const rows = await this.db
      .select({
        id: propertyReminders.id,
        propertyId: propertyReminders.propertyId,
        userId: propertyReminders.userId,
        reminderType: propertyReminders.reminderType,
        title: propertyReminders.title,
        dueDate: propertyReminders.dueDate,
        reminderDaysBefore: propertyReminders.reminderDaysBefore,
        notes: propertyReminders.notes,
        notifiedAt: propertyReminders.notifiedAt,
        completedAt: propertyReminders.completedAt,
        createdAt: propertyReminders.createdAt,
        updatedAt: propertyReminders.updatedAt,
        userEmail: users.email,
        propertyAddress: properties.address,
      })
      .from(propertyReminders)
      .innerJoin(users, eq(propertyReminders.userId, users.id))
      .innerJoin(properties, eq(propertyReminders.propertyId, properties.id))
      .where(
        and(
          isNull(propertyReminders.completedAt),
          isNull(propertyReminders.notifiedAt),
          sql`(${propertyReminders.dueDate}::date - ${today}::date) = ANY(${propertyReminders.reminderDaysBefore})`
        )
      );

    return rows;
  }

  async create(data: NewPropertyReminder, tx?: DB): Promise<PropertyReminder> {
    const client = this.resolve(tx);
    const [reminder] = await client
      .insert(propertyReminders)
      .values(data)
      .returning();
    return reminder;
  }

  async update(
    id: string,
    userId: string,
    data: Partial<PropertyReminder>,
    tx?: DB
  ): Promise<PropertyReminder | null> {
    const client = this.resolve(tx);
    const [reminder] = await client
      .update(propertyReminders)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(
          eq(propertyReminders.id, id),
          eq(propertyReminders.userId, userId)
        )
      )
      .returning();
    return reminder ?? null;
  }

  async delete(id: string, userId: string, tx?: DB): Promise<void> {
    const client = this.resolve(tx);
    await client
      .delete(propertyReminders)
      .where(
        and(
          eq(propertyReminders.id, id),
          eq(propertyReminders.userId, userId)
        )
      );
  }
}
