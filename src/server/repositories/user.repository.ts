import { eq } from "drizzle-orm";
import { users, subscriptions } from "../db/schema";
import type { User } from "../db/schema";
import { BaseRepository, type DB } from "./base";
import type { IUserRepository } from "./interfaces/user.repository.interface";

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
}
