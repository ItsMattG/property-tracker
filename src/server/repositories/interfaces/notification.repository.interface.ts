import type {
  NotificationPreferences,
  NewNotificationPreferences,
  PushSubscription,
  NewPushSubscription,
  NotificationLogEntry,
} from "../../db/schema";

export interface INotificationRepository {
  findPreferences(userId: string): Promise<NotificationPreferences | null>;
  createPreferences(data: NewNotificationPreferences): Promise<NotificationPreferences>;
  updatePreferences(userId: string, data: Partial<NotificationPreferences>): Promise<NotificationPreferences>;
  findPushSubscription(userId: string, endpoint: string): Promise<PushSubscription | null>;
  listPushSubscriptions(userId: string): Promise<PushSubscription[]>;
  createPushSubscription(data: NewPushSubscription): Promise<PushSubscription>;
  deletePushSubscription(userId: string, endpoint: string): Promise<void>;
  findNotificationLog(userId: string, limit: number): Promise<NotificationLogEntry[]>;
}
