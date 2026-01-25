// src/server/services/property-manager/sync.ts

import { eq, and } from "drizzle-orm";
import type { PropertyManagerProvider } from "./types";
import { transactions, propertyManagerMappings } from "@/server/db/schema";

type DbClient = {
  query: {
    propertyManagerMappings: {
      findMany: (opts: unknown) => Promise<Array<{
        providerPropertyId: string;
        propertyId: string | null;
        autoSync: boolean;
      }>>;
    };
    transactions: {
      findFirst: (opts: unknown) => Promise<unknown>;
    };
  };
  insert: (table: unknown) => {
    values: (values: unknown) => {
      returning: () => Promise<Array<{ id: string }>>;
    };
  };
  update: (table: unknown) => {
    set: (values: unknown) => {
      where: (condition: unknown) => Promise<void>;
    };
  };
};

interface SyncResult {
  created: number;
  skipped: number;
  errors: string[];
}

export class PropertyManagerSyncService {
  constructor(
    private provider: PropertyManagerProvider,
    private db: DbClient
  ) {}

  async syncRentPayments(
    accessToken: string,
    connectionId: string,
    userId: string,
    since?: Date
  ): Promise<SyncResult> {
    const result: SyncResult = { created: 0, skipped: 0, errors: [] };

    try {
      const payments = await this.provider.getRentPayments(accessToken, since);
      const mappings = await this.db.query.propertyManagerMappings.findMany({
        where: eq(propertyManagerMappings.connectionId, connectionId),
      });

      const mappingByProviderId = new Map(
        mappings.map((m) => [m.providerPropertyId, m])
      );

      for (const payment of payments) {
        const mapping = mappingByProviderId.get(payment.propertyId);

        if (!mapping || !mapping.propertyId || !mapping.autoSync) {
          result.skipped++;
          continue;
        }

        // Check for duplicate
        const existing = await this.db.query.transactions.findFirst({
          where: and(
            eq(transactions.providerTransactionId, payment.id),
            eq(transactions.provider, this.provider.name)
          ),
        });

        if (existing) {
          result.skipped++;
          continue;
        }

        // Create transaction
        await this.db
          .insert(transactions)
          .values({
            userId,
            propertyId: mapping.propertyId,
            date: payment.date,
            description: payment.description,
            amount: String(payment.amount),
            category: "rental_income",
            transactionType: "income",
            status: "confirmed",
            providerTransactionId: payment.id,
            provider: this.provider.name,
          })
          .returning();

        result.created++;
      }
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : "Unknown error");
    }

    return result;
  }

  async syncMaintenanceJobs(
    accessToken: string,
    connectionId: string,
    userId: string,
    since?: Date
  ): Promise<SyncResult> {
    const result: SyncResult = { created: 0, skipped: 0, errors: [] };

    try {
      const jobs = await this.provider.getMaintenanceJobs(accessToken, since);
      const mappings = await this.db.query.propertyManagerMappings.findMany({
        where: eq(propertyManagerMappings.connectionId, connectionId),
      });

      const mappingByProviderId = new Map(
        mappings.map((m) => [m.providerPropertyId, m])
      );

      for (const job of jobs) {
        if (job.status !== "completed") continue;

        const mapping = mappingByProviderId.get(job.propertyId);

        if (!mapping || !mapping.propertyId || !mapping.autoSync) {
          result.skipped++;
          continue;
        }

        const existing = await this.db.query.transactions.findFirst({
          where: and(
            eq(transactions.providerTransactionId, job.id),
            eq(transactions.provider, this.provider.name)
          ),
        });

        if (existing) {
          result.skipped++;
          continue;
        }

        await this.db
          .insert(transactions)
          .values({
            userId,
            propertyId: mapping.propertyId,
            date: job.date,
            description: job.supplierName
              ? `${job.description} - ${job.supplierName}`
              : job.description,
            amount: String(-Math.abs(job.amount)), // Expenses are negative
            category: "repairs_and_maintenance",
            transactionType: "expense",
            status: "confirmed",
            providerTransactionId: job.id,
            provider: this.provider.name,
          })
          .returning();

        result.created++;
      }
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : "Unknown error");
    }

    return result;
  }

  async syncBills(
    accessToken: string,
    connectionId: string,
    userId: string,
    since?: Date
  ): Promise<SyncResult> {
    const result: SyncResult = { created: 0, skipped: 0, errors: [] };

    try {
      const bills = await this.provider.getBills(accessToken, since);
      const mappings = await this.db.query.propertyManagerMappings.findMany({
        where: eq(propertyManagerMappings.connectionId, connectionId),
      });

      const mappingByProviderId = new Map(
        mappings.map((m) => [m.providerPropertyId, m])
      );

      for (const bill of bills) {
        const mapping = mappingByProviderId.get(bill.propertyId);

        if (!mapping || !mapping.propertyId || !mapping.autoSync) {
          result.skipped++;
          continue;
        }

        const existing = await this.db.query.transactions.findFirst({
          where: and(
            eq(transactions.providerTransactionId, bill.id),
            eq(transactions.provider, this.provider.name)
          ),
        });

        if (existing) {
          result.skipped++;
          continue;
        }

        await this.db
          .insert(transactions)
          .values({
            userId,
            propertyId: mapping.propertyId,
            date: bill.date,
            description: bill.description,
            amount: String(-Math.abs(bill.amount)),
            category: this.mapBillCategory(bill.category),
            transactionType: "expense",
            status: "confirmed",
            providerTransactionId: bill.id,
            provider: this.provider.name,
          })
          .returning();

        result.created++;
      }
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : "Unknown error");
    }

    return result;
  }

  private mapBillCategory(category?: string): string {
    if (!category) return "sundry_rental_expenses";
    const lower = category.toLowerCase();
    if (lower.includes("rate") || lower.includes("council")) return "council_rates";
    if (lower.includes("water")) return "water_charges";
    if (lower.includes("insurance")) return "insurance";
    if (lower.includes("strata") || lower.includes("body")) return "body_corporate";
    return "sundry_rental_expenses";
  }

  async runFullSync(
    accessToken: string,
    connectionId: string,
    userId: string,
    since?: Date
  ): Promise<{
    rentPayments: SyncResult;
    maintenanceJobs: SyncResult;
    bills: SyncResult;
  }> {
    const [rentPayments, maintenanceJobs, bills] = await Promise.all([
      this.syncRentPayments(accessToken, connectionId, userId, since),
      this.syncMaintenanceJobs(accessToken, connectionId, userId, since),
      this.syncBills(accessToken, connectionId, userId, since),
    ]);

    return { rentPayments, maintenanceJobs, bills };
  }
}
