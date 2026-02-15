import { eq, and, lt, sql } from "drizzle-orm";
import { loans, brokers, loanPacks, loanComparisons, refinanceAlerts } from "../db/schema";
import type {
  Loan, NewLoan, Broker, NewBroker, LoanPack, NewLoanPack,
  LoanComparison, NewLoanComparison, RefinanceAlert, NewRefinanceAlert,
} from "../db/schema";
import { BaseRepository, type DB } from "./base";
import type {
  ILoanRepository, LoanWithRelations,
  BrokerWithPackCount, LoanPackWithBroker, LoanComparisonWithLoan,
} from "./interfaces/loan.repository.interface";

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

  async findRecent(
    userId: string,
    limit: number
  ): Promise<Array<{
    id: string;
    lender: string;
    currentBalance: string;
    updatedAt: Date;
  }>> {
    return this.db.query.loans.findMany({
      where: eq(loans.userId, userId),
      orderBy: (l, { desc }) => [desc(l.updatedAt)],
      limit,
      columns: {
        id: true,
        lender: true,
        currentBalance: true,
        updatedAt: true,
      },
    });
  }

  // --- Brokers ---

  async listBrokersWithStats(userId: string): Promise<BrokerWithPackCount[]> {
    const results = await this.db.query.brokers.findMany({
      where: eq(brokers.userId, userId),
      with: { loanPacks: true },
      orderBy: (b, { desc }) => [desc(b.createdAt)],
    });
    return results.map((b) => ({
      ...b,
      packCount: b.loanPacks?.length ?? 0,
      loanPacks: undefined,
    })) as unknown as BrokerWithPackCount[];
  }

  async findBrokerById(id: string, userId: string): Promise<Broker | null> {
    const result = await this.db.query.brokers.findFirst({
      where: and(eq(brokers.id, id), eq(brokers.userId, userId)),
    });
    return result ?? null;
  }

  async findBrokerPacks(brokerId: string): Promise<LoanPack[]> {
    return this.db.query.loanPacks.findMany({
      where: eq(loanPacks.brokerId, brokerId),
      orderBy: (lp, { desc }) => [desc(lp.createdAt)],
    });
  }

  async createBroker(data: NewBroker, tx?: DB): Promise<Broker> {
    const client = this.resolve(tx);
    const [broker] = await client.insert(brokers).values(data).returning();
    return broker;
  }

  async updateBroker(id: string, userId: string, data: Partial<Broker>, tx?: DB): Promise<Broker> {
    const client = this.resolve(tx);
    const [broker] = await client
      .update(brokers)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(brokers.id, id), eq(brokers.userId, userId)))
      .returning();
    return broker;
  }

  async deleteBroker(id: string, userId: string, tx?: DB): Promise<void> {
    const client = this.resolve(tx);
    await client.delete(brokers).where(and(eq(brokers.id, id), eq(brokers.userId, userId)));
  }

  // --- Loan Packs ---

  async createLoanPack(data: NewLoanPack, tx?: DB): Promise<LoanPack> {
    const client = this.resolve(tx);
    const [pack] = await client.insert(loanPacks).values(data).returning();
    return pack;
  }

  async findLoanPacksByOwner(userId: string): Promise<LoanPackWithBroker[]> {
    return this.db.query.loanPacks.findMany({
      where: eq(loanPacks.userId, userId),
      with: { broker: true },
      orderBy: (lp, { desc }) => [desc(lp.createdAt)],
    }) as Promise<LoanPackWithBroker[]>;
  }

  async deleteLoanPack(id: string, userId: string, tx?: DB): Promise<void> {
    const client = this.resolve(tx);
    await client.delete(loanPacks).where(and(eq(loanPacks.id, id), eq(loanPacks.userId, userId)));
  }

  async findLoanPackByToken(token: string): Promise<LoanPack | null> {
    const result = await this.db.query.loanPacks.findFirst({
      where: eq(loanPacks.token, token),
    });
    return result ?? null;
  }

  async incrementLoanPackAccess(id: string, tx?: DB): Promise<LoanPack> {
    const client = this.resolve(tx);
    const [pack] = await client
      .update(loanPacks)
      .set({
        accessCount: sql`${loanPacks.accessCount} + 1`,
        accessedAt: new Date(),
      })
      .where(eq(loanPacks.id, id))
      .returning();
    return pack;
  }

  // --- Loan Comparisons ---

  async createComparison(data: NewLoanComparison, tx?: DB): Promise<LoanComparison> {
    const client = this.resolve(tx);
    const [comparison] = await client.insert(loanComparisons).values(data).returning();
    return comparison;
  }

  async findComparisonsByOwner(userId: string, loanId?: string): Promise<LoanComparisonWithLoan[]> {
    const conditions = [eq(loanComparisons.userId, userId)];
    if (loanId) conditions.push(eq(loanComparisons.loanId, loanId));
    return this.db.query.loanComparisons.findMany({
      where: and(...conditions),
      with: { loan: { with: { property: true } } },
      orderBy: (lc, { desc }) => [desc(lc.createdAt)],
    }) as Promise<LoanComparisonWithLoan[]>;
  }

  async deleteComparison(id: string, userId: string, tx?: DB): Promise<void> {
    const client = this.resolve(tx);
    await client.delete(loanComparisons).where(
      and(eq(loanComparisons.id, id), eq(loanComparisons.userId, userId))
    );
  }

  // --- Refinance Alerts ---

  async findRefinanceAlert(loanId: string): Promise<RefinanceAlert | null> {
    const result = await this.db.query.refinanceAlerts.findFirst({
      where: eq(refinanceAlerts.loanId, loanId),
    });
    return result ?? null;
  }

  async upsertRefinanceAlert(loanId: string, data: Partial<RefinanceAlert>, tx?: DB): Promise<RefinanceAlert> {
    const client = this.resolve(tx);
    const existing = await this.db.query.refinanceAlerts.findFirst({
      where: eq(refinanceAlerts.loanId, loanId),
    });

    if (existing) {
      const [updated] = await client
        .update(refinanceAlerts)
        .set(data)
        .where(eq(refinanceAlerts.id, existing.id))
        .returning();
      return updated;
    }

    const [created] = await client
      .insert(refinanceAlerts)
      .values({ loanId, ...data } as NewRefinanceAlert)
      .returning();
    return created;
  }
}
