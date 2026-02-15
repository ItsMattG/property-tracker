import { eq, and, desc, inArray, sql } from "drizzle-orm";
import { bankAccounts, connectionAlerts, anomalyAlerts } from "../db/schema";
import type {
  BankAccount, NewBankAccount, ConnectionAlert, NewConnectionAlert,
  AnomalyAlert, NewAnomalyAlert,
} from "../db/schema";
import { BaseRepository, type DB } from "./base";
import type {
  IBankAccountRepository, BankAccountWithRelations,
  AnomalyAlertWithRelations, AnomalyAlertFull, AnomalyAlertCounts,
} from "./interfaces/bank-account.repository.interface";

export class BankAccountRepository
  extends BaseRepository
  implements IBankAccountRepository
{
  async findByOwner(
    userId: string,
    opts?: { withProperty?: boolean; withAlerts?: boolean }
  ): Promise<BankAccountWithRelations[]> {
    return this.db.query.bankAccounts.findMany({
      where: eq(bankAccounts.userId, userId),
      with: {
        ...(opts?.withProperty && { defaultProperty: true }),
        ...(opts?.withAlerts && {
          alerts: {
            where: eq(connectionAlerts.status, "active"),
          },
        }),
      },
    });
  }

  async findById(id: string, userId: string): Promise<BankAccount | null> {
    const result = await this.db.query.bankAccounts.findFirst({
      where: and(eq(bankAccounts.id, id), eq(bankAccounts.userId, userId)),
    });
    return result ?? null;
  }

  async create(data: NewBankAccount, tx?: DB): Promise<BankAccount> {
    const client = this.resolve(tx);
    const [account] = await client.insert(bankAccounts).values(data).returning();
    return account;
  }

  async update(id: string, data: Partial<BankAccount>, tx?: DB): Promise<BankAccount> {
    const client = this.resolve(tx);
    const [account] = await client
      .update(bankAccounts)
      .set(data)
      .where(eq(bankAccounts.id, id))
      .returning();
    return account;
  }

  async updateByInstitution(
    institution: string,
    userId: string,
    data: Partial<BankAccount>,
    tx?: DB
  ): Promise<void> {
    const client = this.resolve(tx);
    await client
      .update(bankAccounts)
      .set(data)
      .where(
        and(
          eq(bankAccounts.institution, institution),
          eq(bankAccounts.userId, userId)
        )
      );
  }

  async delete(id: string, tx?: DB): Promise<void> {
    const client = this.resolve(tx);
    await client.delete(bankAccounts).where(eq(bankAccounts.id, id));
  }

  async findActiveAlerts(
    userId: string
  ): Promise<(ConnectionAlert & { bankAccount: BankAccount })[]> {
    return this.db.query.connectionAlerts.findMany({
      where: and(
        eq(connectionAlerts.userId, userId),
        eq(connectionAlerts.status, "active")
      ),
      with: {
        bankAccount: true,
      },
      orderBy: [desc(connectionAlerts.createdAt)],
    }) as Promise<(ConnectionAlert & { bankAccount: BankAccount })[]>;
  }

  async findActiveAlertsByAccount(accountId: string): Promise<ConnectionAlert[]> {
    return this.db.query.connectionAlerts.findMany({
      where: and(
        eq(connectionAlerts.bankAccountId, accountId),
        eq(connectionAlerts.status, "active")
      ),
    });
  }

  async createAlert(data: NewConnectionAlert, tx?: DB): Promise<ConnectionAlert> {
    const client = this.resolve(tx);
    const [alert] = await client.insert(connectionAlerts).values(data).returning();
    return alert;
  }

  async dismissAlert(
    id: string,
    userId: string,
    tx?: DB
  ): Promise<ConnectionAlert | null> {
    const client = this.resolve(tx);
    const [alert] = await client
      .update(connectionAlerts)
      .set({
        status: "dismissed",
        dismissedAt: new Date(),
      })
      .where(
        and(
          eq(connectionAlerts.id, id),
          eq(connectionAlerts.userId, userId)
        )
      )
      .returning();
    return alert ?? null;
  }

  async resolveAlertsByAccount(accountId: string, tx?: DB): Promise<void> {
    const client = this.resolve(tx);
    await client
      .update(connectionAlerts)
      .set({
        status: "resolved",
        resolvedAt: new Date(),
      })
      .where(
        and(
          eq(connectionAlerts.bankAccountId, accountId),
          eq(connectionAlerts.status, "active")
        )
      );
  }

  // --- Anomaly Alerts ---

  async findAnomalyAlerts(
    userId: string,
    opts?: { status?: AnomalyAlert["status"]; severity?: AnomalyAlert["severity"]; propertyId?: string; limit?: number; offset?: number }
  ): Promise<AnomalyAlertWithRelations[]> {
    const conditions = [eq(anomalyAlerts.userId, userId)];
    if (opts?.status) conditions.push(eq(anomalyAlerts.status, opts.status));
    if (opts?.severity) conditions.push(eq(anomalyAlerts.severity, opts.severity));
    if (opts?.propertyId) conditions.push(eq(anomalyAlerts.propertyId, opts.propertyId));

    return this.db.query.anomalyAlerts.findMany({
      where: and(...conditions),
      with: { property: true, transaction: true },
      orderBy: [desc(anomalyAlerts.createdAt)],
      limit: opts?.limit ?? 50,
      offset: opts?.offset ?? 0,
    }) as Promise<AnomalyAlertWithRelations[]>;
  }

  async findAnomalyAlertById(id: string, userId: string): Promise<AnomalyAlertFull | null> {
    const result = await this.db.query.anomalyAlerts.findFirst({
      where: and(eq(anomalyAlerts.id, id), eq(anomalyAlerts.userId, userId)),
      with: {
        property: true,
        transaction: true,
        recurringTransaction: true,
        expectedTransaction: true,
      },
    });
    return (result as AnomalyAlertFull) ?? null;
  }

  async getAnomalyAlertCounts(userId: string): Promise<AnomalyAlertCounts> {
    const result = await this.db
      .select({
        total: sql<number>`count(*)::int`,
        critical: sql<number>`count(*) filter (where ${anomalyAlerts.severity} = 'critical')::int`,
        warning: sql<number>`count(*) filter (where ${anomalyAlerts.severity} = 'warning')::int`,
        info: sql<number>`count(*) filter (where ${anomalyAlerts.severity} = 'info')::int`,
      })
      .from(anomalyAlerts)
      .where(and(eq(anomalyAlerts.userId, userId), eq(anomalyAlerts.status, "active")));

    return {
      total: result[0]?.total ?? 0,
      critical: result[0]?.critical ?? 0,
      warning: result[0]?.warning ?? 0,
      info: result[0]?.info ?? 0,
    };
  }

  async updateAnomalyAlertStatus(
    id: string, userId: string, data: Partial<AnomalyAlert>, tx?: DB
  ): Promise<AnomalyAlert | null> {
    const client = this.resolve(tx);
    const [alert] = await client
      .update(anomalyAlerts)
      .set(data)
      .where(and(eq(anomalyAlerts.id, id), eq(anomalyAlerts.userId, userId)))
      .returning();
    return alert ?? null;
  }

  async bulkUpdateAnomalyAlertStatus(
    ids: string[], userId: string, data: Partial<AnomalyAlert>, tx?: DB
  ): Promise<void> {
    const client = this.resolve(tx);
    await client
      .update(anomalyAlerts)
      .set(data)
      .where(and(inArray(anomalyAlerts.id, ids), eq(anomalyAlerts.userId, userId)));
  }

  async createAnomalyAlerts(alerts: NewAnomalyAlert[], tx?: DB): Promise<AnomalyAlert[]> {
    const client = this.resolve(tx);
    return client.insert(anomalyAlerts).values(alerts).returning();
  }
}
