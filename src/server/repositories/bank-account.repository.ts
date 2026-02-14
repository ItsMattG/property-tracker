import { eq, and, desc, sql } from "drizzle-orm";
import { bankAccounts, connectionAlerts } from "../db/schema";
import type { BankAccount, NewBankAccount, ConnectionAlert, NewConnectionAlert } from "../db/schema";
import { BaseRepository, type DB } from "./base";
import type { IBankAccountRepository, BankAccountWithRelations } from "./interfaces/bank-account.repository.interface";

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
}
