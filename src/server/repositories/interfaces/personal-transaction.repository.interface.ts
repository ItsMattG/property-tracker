import type { PersonalTransaction, NewPersonalTransaction } from "../../db/schema";
import type { DB } from "../base";

export interface PersonalTransactionWithCategory extends PersonalTransaction {
  categoryName: string | null;
  categoryIcon: string | null;
}

export interface IPersonalTransactionRepository {
  /** Paginated, filtered query with category info — ordered by date desc */
  findByUser(userId: string, opts: {
    categoryId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{ transactions: PersonalTransactionWithCategory[]; total: number }>;

  /** Simple user-scoped lookup by id */
  findById(id: string, userId: string): Promise<PersonalTransaction | null>;

  /** Insert a single personal transaction */
  create(data: NewPersonalTransaction, tx?: DB): Promise<PersonalTransaction>;

  /** Bulk insert personal transactions */
  createMany(data: NewPersonalTransaction[], tx?: DB): Promise<PersonalTransaction[]>;

  /** User-scoped update — returns null if no matching transaction */
  update(id: string, userId: string, data: Partial<PersonalTransaction>, tx?: DB): Promise<PersonalTransaction | null>;

  /** User-scoped delete */
  delete(id: string, userId: string, tx?: DB): Promise<void>;

  /** Lookup by Basiq external ID for dedup during bank sync */
  findByBasiqId(basiqTransactionId: string): Promise<PersonalTransaction | null>;

  /** Group transactions by month, summing income and expenses separately */
  getMonthlySummary(userId: string, months: number): Promise<{ month: string; income: number; expenses: number }[]>;
}
