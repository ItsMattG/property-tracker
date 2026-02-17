import type { PersonalCategory, NewPersonalCategory } from "../../db/schema";
import type { DB } from "../base";

export interface IPersonalCategoryRepository {
  /** List all categories for a user, ordered by sortOrder */
  findByUser(userId: string): Promise<PersonalCategory[]>;

  /** Get a single category by id scoped to user */
  findById(id: string, userId: string): Promise<PersonalCategory | null>;

  /** Insert a new personal category */
  create(data: NewPersonalCategory, tx?: DB): Promise<PersonalCategory>;

  /** Update a category's fields — returns null if no matching category */
  update(id: string, userId: string, data: Partial<PersonalCategory>, tx?: DB): Promise<PersonalCategory | null>;

  /** Delete a category scoped to user */
  delete(id: string, userId: string, tx?: DB): Promise<void>;

  /** Seed default categories for a new user (50/30/20 grouping) */
  seedDefaults(userId: string, tx?: DB): Promise<PersonalCategory[]>;
}
