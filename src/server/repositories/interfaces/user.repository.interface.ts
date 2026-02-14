import type { User } from "../../db/schema";
import type { DB } from "../base";

export interface IUserRepository {
  /** Find a user by id */
  findById(id: string): Promise<User | null>;

  /** Find a user by id with specific columns */
  findById<T extends Partial<Record<keyof User, true>>>(
    id: string,
    columns: T,
  ): Promise<Pick<User, Extract<keyof T, keyof User>> | null>;

  /** Update a user */
  update(id: string, data: Partial<User>, tx?: DB): Promise<void>;

  /** Find subscription for a user */
  findSubscription(userId: string): Promise<{
    plan: string;
    status: string;
    currentPeriodEnd: Date | null;
  } | null>;
}
