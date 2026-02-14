import { eq, and, lt } from "drizzle-orm";
import { loans } from "../db/schema";
import type { Loan, NewLoan } from "../db/schema";
import { BaseRepository, type DB } from "./base";
import type { ILoanRepository, LoanWithRelations } from "./interfaces/loan.repository.interface";

export class LoanRepository extends BaseRepository implements ILoanRepository {
  async findByOwner(
    userId: string,
    opts?: { propertyId?: string }
  ): Promise<LoanWithRelations[]> {
    const conditions = [eq(loans.userId, userId)];

    if (opts?.propertyId) {
      conditions.push(eq(loans.propertyId, opts.propertyId));
    }

    return this.db.query.loans.findMany({
      where: and(...conditions),
      with: {
        property: true,
        offsetAccount: true,
      },
      orderBy: (loans, { desc }) => [desc(loans.createdAt)],
    }) as Promise<LoanWithRelations[]>;
  }

  async findStale(userId: string, cutoffDate: Date): Promise<LoanWithRelations[]> {
    return this.db.query.loans.findMany({
      where: and(
        eq(loans.userId, userId),
        lt(loans.updatedAt, cutoffDate)
      ),
      with: { property: true },
      orderBy: (loans, { asc }) => [asc(loans.updatedAt)],
    }) as Promise<LoanWithRelations[]>;
  }

  async findById(id: string, userId: string): Promise<LoanWithRelations | null> {
    const result = await this.db.query.loans.findFirst({
      where: and(eq(loans.id, id), eq(loans.userId, userId)),
      with: {
        property: true,
        offsetAccount: true,
      },
    });
    return (result as LoanWithRelations) ?? null;
  }

  async create(data: NewLoan, tx?: DB): Promise<Loan> {
    const client = this.resolve(tx);
    const [loan] = await client.insert(loans).values(data).returning();
    return loan;
  }

  async update(
    id: string,
    userId: string,
    data: Partial<NewLoan>,
    tx?: DB
  ): Promise<Loan> {
    const client = this.resolve(tx);
    const [loan] = await client
      .update(loans)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(loans.id, id), eq(loans.userId, userId)))
      .returning();
    return loan;
  }

  async delete(id: string, userId: string, tx?: DB): Promise<void> {
    const client = this.resolve(tx);
    await client
      .delete(loans)
      .where(and(eq(loans.id, id), eq(loans.userId, userId)));
  }
}
