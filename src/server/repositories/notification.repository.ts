import { eq, and, desc } from "drizzle-orm";
import {
  notificationPreferences,
  pushSubscriptions,
  notificationLog,
} from "../db/schema";
import type {
  NotificationPreferences,
  NewNotificationPreferences,
  PushSubscription,
  NewPushSubscription,
  NotificationLogEntry,
} from "../db/schema";
import { BaseRepository } from "./base";
import type { INotificationRepository } from "./interfaces/notification.repository.interface";

export class NotificationRepository
  extends BaseRepository
  implements INotificationRepository
{
  async findPreferences(userId: string): Promise<NotificationPreferences | null> {
    const result = await this.db.query.notificationPreferences.findFirst({
      where: eq(notificationPreferences.userId, userId),
    });
    return result ?? null;
  }

  async createPreferences(data: NewNotificationPreferences): Promise<NotificationPreferences> {
    const [created] = await this.db
      .insert(notificationPreferences)
      .values(data)
      .returning();
    return created;
  }

  async updatePreferences(
    userId: string,
    data: Partial<NotificationPreferences>
  ): Promise<NotificationPreferences> {
    const [updated] = await this.db
      .update(notificationPreferences)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(notificationPreferences.userId, userId))
      .returning();
    return updated;
  }

  async findPushSubscription(
    userId: string,
    endpoint: string
  ): Promise<PushSubscription | null> {
    const result = await this.db.query.pushSubscriptions.findFirst({
      where: and(
        eq(pushSubscriptions.userId, userId),
        eq(pushSubscriptions.endpoint, endpoint)
      ),
    });
    return result ?? null;
  }

  async listPushSubscriptions(userId: string): Promise<PushSubscription[]> {
    return this.db.query.pushSubscriptions.findMany({
      where: eq(pushSubscriptions.userId, userId),
      orderBy: [desc(pushSubscriptions.createdAt)],
    });
  }

  async createPushSubscription(data: NewPushSubscription): Promise<PushSubscription> {
    const [created] = await this.db
      .insert(pushSubscriptions)
      .values(data)
      .returning();
    return created;
  }

  async deletePushSubscription(userId: string, endpoint: string): Promise<void> {
    await this.db
      .delete(pushSubscriptions)
      .where(
        and(
          eq(pushSubscriptions.userId, userId),
          eq(pushSubscriptions.endpoint, endpoint)
        )
      );
  }

  async findNotificationLog(userId: string, limit: number): Promise<NotificationLogEntry[]> {
    return this.db.query.notificationLog.findMany({
      where: eq(notificationLog.userId, userId),
      orderBy: [desc(notificationLog.sentAt)],
      limit,
    });
  }
}
