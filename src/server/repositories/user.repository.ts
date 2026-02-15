import { eq, and } from "drizzle-orm";
import {
  users,
  subscriptions,
  userOnboarding,
  pushTokens,
  milestonePreferences,
  propertyMilestoneOverrides,
} from "../db/schema";
import type {
  User,
  UserOnboarding,
  PushToken,
  MilestonePreferences,
  PropertyMilestoneOverride,
} from "../db/schema";
import { BaseRepository, type DB } from "./base";
import type { IUserRepository } from "./interfaces/user.repository.interface";

type Subscription = typeof subscriptions.$inferSelect;

export class UserRepository extends BaseRepository implements IUserRepository {
  async findById(id: string): Promise<User | null>;
  async findById(id: string, columns: Partial<Record<keyof User, true>>): Promise<Partial<User> | null>;
  async findById(id: string, columns?: Partial<Record<keyof User, true>>): Promise<User | Partial<User> | null> {
    if (columns) {
      const result = await this.db.query.users.findFirst({
        where: eq(users.id, id),
        columns,
      });
      return (result as Partial<User>) ?? null;
    }
    const result = await this.db.query.users.findFirst({
      where: eq(users.id, id),
    });
    return result ?? null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const result = await this.db.query.users.findFirst({
      where: eq(users.email, email),
    });
    return result ?? null;
  }

  async update(id: string, data: Partial<User>, tx?: DB): Promise<void> {
    const client = this.resolve(tx);
    await client.update(users).set(data).where(eq(users.id, id));
  }

  async findSubscription(
    userId: string
  ): Promise<{ plan: string; status: string; currentPeriodEnd: Date | null } | null> {
    const sub = await this.db.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, userId),
    });
    if (!sub) return null;
    return {
      plan: sub.plan,
      status: sub.status,
      currentPeriodEnd: sub.currentPeriodEnd,
    };
  }

  async findSubscriptionFull(userId: string): Promise<Subscription | null> {
    const sub = await this.db.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, userId),
    });
    return sub ?? null;
  }

  // --- Onboarding ---

  async findOnboarding(userId: string): Promise<UserOnboarding | null> {
    const result = await this.db.query.userOnboarding.findFirst({
      where: eq(userOnboarding.userId, userId),
    });
    return result ?? null;
  }

  async createOnboarding(userId: string): Promise<UserOnboarding> {
    const [created] = await this.db
      .insert(userOnboarding)
      .values({ userId })
      .returning();
    return created;
  }

  async updateOnboarding(userId: string, data: Partial<UserOnboarding>): Promise<UserOnboarding | null> {
    const [updated] = await this.db
      .update(userOnboarding)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(userOnboarding.userId, userId))
      .returning();
    return updated ?? null;
  }

  // --- Push tokens ---

  async findPushToken(token: string): Promise<PushToken | null> {
    const result = await this.db.query.pushTokens.findFirst({
      where: eq(pushTokens.token, token),
    });
    return result ?? null;
  }

  async upsertPushToken(data: { userId: string; token: string; platform: "ios" | "android" }): Promise<void> {
    const existing = await this.findPushToken(data.token);
    if (existing) {
      if (existing.userId !== data.userId) {
        await this.db
          .update(pushTokens)
          .set({ userId: data.userId })
          .where(eq(pushTokens.id, existing.id));
      }
    } else {
      await this.db.insert(pushTokens).values(data);
    }
  }

  async deletePushToken(userId: string, token: string): Promise<void> {
    await this.db
      .delete(pushTokens)
      .where(and(eq(pushTokens.userId, userId), eq(pushTokens.token, token)));
  }

  // --- Milestone preferences ---

  async findMilestonePrefs(userId: string): Promise<MilestonePreferences | null> {
    const result = await this.db.query.milestonePreferences.findFirst({
      where: eq(milestonePreferences.userId, userId),
    });
    return result ?? null;
  }

  async upsertMilestonePrefs(userId: string, data: Partial<MilestonePreferences>): Promise<MilestonePreferences> {
    const existing = await this.findMilestonePrefs(userId);
    if (existing) {
      const [updated] = await this.db
        .update(milestonePreferences)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(milestonePreferences.userId, userId))
        .returning();
      return updated;
    }
    const [created] = await this.db
      .insert(milestonePreferences)
      .values({ userId, ...data })
      .returning();
    return created;
  }

  async findPropertyOverride(propertyId: string): Promise<PropertyMilestoneOverride | null> {
    const result = await this.db.query.propertyMilestoneOverrides.findFirst({
      where: eq(propertyMilestoneOverrides.propertyId, propertyId),
    });
    return result ?? null;
  }

  async upsertPropertyOverride(
    propertyId: string,
    data: Partial<PropertyMilestoneOverride>
  ): Promise<PropertyMilestoneOverride> {
    const existing = await this.findPropertyOverride(propertyId);
    if (existing) {
      const [updated] = await this.db
        .update(propertyMilestoneOverrides)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(propertyMilestoneOverrides.propertyId, propertyId))
        .returning();
      return updated;
    }
    const [created] = await this.db
      .insert(propertyMilestoneOverrides)
      .values({ propertyId, ...data })
      .returning();
    return created;
  }

  async deletePropertyOverride(propertyId: string): Promise<void> {
    await this.db
      .delete(propertyMilestoneOverrides)
      .where(eq(propertyMilestoneOverrides.propertyId, propertyId));
  }
}
