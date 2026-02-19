import type { PropertyReminder, NewPropertyReminder } from "../../db/schema";
import type { DB } from "../base";

export interface IReminderRepository {
  /** List reminders for a user, optionally filtered by property */
  findByOwner(userId: string, opts?: { propertyId?: string }): Promise<PropertyReminder[]>;

  /** Get a single reminder by id scoped to user */
  findById(id: string, userId: string): Promise<PropertyReminder | null>;

  /** Find upcoming reminders within N days that are not yet completed */
  findUpcoming(userId: string, days: number): Promise<PropertyReminder[]>;

  /** Find reminders for a specific calendar month (excludes completed) */
  findByMonth(userId: string, year: number, month: number): Promise<PropertyReminder[]>;

  /** Find reminders that need notification sent today based on reminderDaysBefore */
  findDueForNotification(today: string): Promise<(PropertyReminder & { userEmail: string; propertyAddress: string })[]>;

  /** Insert a new reminder */
  create(data: NewPropertyReminder, tx?: DB): Promise<PropertyReminder>;

  /** Update a reminder's fields — returns null if no matching reminder */
  update(id: string, userId: string, data: Partial<PropertyReminder>, tx?: DB): Promise<PropertyReminder | null>;

  /** Delete a reminder */
  delete(id: string, userId: string, tx?: DB): Promise<void>;
}
