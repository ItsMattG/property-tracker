import { eq, and } from "drizzle-orm";
import { personalCategories } from "../db/schema";
import type { PersonalCategory, NewPersonalCategory } from "../db/schema";
import { BaseRepository, type DB } from "./base";
import type { IPersonalCategoryRepository } from "./interfaces";

const DEFAULT_CATEGORIES = [
  { name: "Rent/Mortgage", group: "needs" as const, icon: "home", sortOrder: 0 },
  { name: "Groceries", group: "needs" as const, icon: "shopping-cart", sortOrder: 1 },
  { name: "Utilities", group: "needs" as const, icon: "zap", sortOrder: 2 },
  { name: "Transport", group: "needs" as const, icon: "car", sortOrder: 3 },
  { name: "Insurance", group: "needs" as const, icon: "shield", sortOrder: 4 },
  { name: "Health", group: "needs" as const, icon: "heart-pulse", sortOrder: 5 },
  { name: "Dining Out", group: "wants" as const, icon: "utensils", sortOrder: 6 },
  { name: "Entertainment", group: "wants" as const, icon: "tv", sortOrder: 7 },
  { name: "Subscriptions", group: "wants" as const, icon: "repeat", sortOrder: 8 },
  { name: "Clothing", group: "wants" as const, icon: "shirt", sortOrder: 9 },
  { name: "Personal Care", group: "wants" as const, icon: "sparkles", sortOrder: 10 },
  { name: "Gifts", group: "wants" as const, icon: "gift", sortOrder: 11 },
  { name: "Savings", group: "savings" as const, icon: "piggy-bank", sortOrder: 12 },
  { name: "Debt Repayment", group: "savings" as const, icon: "trending-down", sortOrder: 13 },
  { name: "Education", group: "savings" as const, icon: "graduation-cap", sortOrder: 14 },
] as const;

export class PersonalCategoryRepository extends BaseRepository implements IPersonalCategoryRepository {
  async findByUser(userId: string): Promise<PersonalCategory[]> {
    return this.db
      .select()
      .from(personalCategories)
      .where(eq(personalCategories.userId, userId))
      .orderBy(personalCategories.sortOrder);
  }

  async findById(id: string, userId: string): Promise<PersonalCategory | null> {
    const [category] = await this.db
      .select()
      .from(personalCategories)
      .where(and(eq(personalCategories.id, id), eq(personalCategories.userId, userId)));
    return category ?? null;
  }

  async create(data: NewPersonalCategory, tx?: DB): Promise<PersonalCategory> {
    const client = this.resolve(tx);
    const [category] = await client
      .insert(personalCategories)
      .values(data)
      .returning();
    return category;
  }

  async update(id: string, userId: string, data: Partial<PersonalCategory>, tx?: DB): Promise<PersonalCategory | null> {
    const client = this.resolve(tx);
    const [updated] = await client
      .update(personalCategories)
      .set(data)
      .where(and(eq(personalCategories.id, id), eq(personalCategories.userId, userId)))
      .returning();
    return updated ?? null;
  }

  async delete(id: string, userId: string, tx?: DB): Promise<void> {
    const client = this.resolve(tx);
    await client
      .delete(personalCategories)
      .where(and(eq(personalCategories.id, id), eq(personalCategories.userId, userId)));
  }

  async seedDefaults(userId: string, tx?: DB): Promise<PersonalCategory[]> {
    const client = this.resolve(tx);
    const values = DEFAULT_CATEGORIES.map((cat) => ({
      userId,
      name: cat.name,
      group: cat.group,
      icon: cat.icon,
      sortOrder: cat.sortOrder,
    }));
    return client.insert(personalCategories).values(values).returning();
  }
}
