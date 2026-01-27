import { z } from "zod";
import { tool } from "ai";
import { db } from "@/server/db";
import {
  properties,
  transactions,
  loans,
  tasks,
  complianceRecords,
  propertyValues,
} from "@/server/db/schema";
import { eq, and, desc, gte, lte, sql } from "drizzle-orm";
import {
  getRequirementsForState,
  type AustralianState,
} from "@/lib/compliance-requirements";
import { calculateComplianceStatus } from "@/server/services/compliance";

export function getChatTools(userId: string) {
  return {
    getPortfolioSummary: tool({
      description:
        "Get a summary of the user's property portfolio including property count, total value, total loans, equity, and income/expense totals for the current financial year.",
      parameters: z.object({}),
      execute: async () => {
        const userProperties = await db.query.properties.findMany({
          where: eq(properties.userId, userId),
          columns: {
            id: true,
            address: true,
            suburb: true,
            state: true,
            purchasePrice: true,
            purchaseDate: true,
            status: true,
          },
        });

        const totalPurchaseValue = userProperties.reduce(
          (sum, p) => sum + Number(p.purchasePrice),
          0
        );

        const loanResult = await db
          .select({ total: sql<string>`COALESCE(SUM(current_balance::numeric), 0)` })
          .from(loans)
          .where(eq(loans.userId, userId));
        const totalLoans = Number(loanResult[0]?.total || 0);

        const valuations = [];
        for (const prop of userProperties) {
          const latest = await db.query.propertyValues.findFirst({
            where: eq(propertyValues.propertyId, prop.id),
            orderBy: [desc(propertyValues.valueDate)],
          });
          if (latest) {
            valuations.push({ propertyId: prop.id, value: Number(latest.estimatedValue) });
          }
        }
        const totalCurrentValue = valuations.reduce((sum, v) => sum + v.value, 0) || totalPurchaseValue;

        // FY dates (July 1 - June 30)
        const now = new Date();
        const fyYear = now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear();
        const fyStart = `${fyYear - 1}-07-01`;
        const fyEnd = `${fyYear}-06-30`;

        const incomeResult = await db
          .select({ total: sql<string>`COALESCE(SUM(amount::numeric), 0)` })
          .from(transactions)
          .where(
            and(
              eq(transactions.userId, userId),
              eq(transactions.transactionType, "income"),
              gte(transactions.date, fyStart),
              lte(transactions.date, fyEnd)
            )
          );
        const expenseResult = await db
          .select({ total: sql<string>`COALESCE(SUM(ABS(amount::numeric)), 0)` })
          .from(transactions)
          .where(
            and(
              eq(transactions.userId, userId),
              eq(transactions.transactionType, "expense"),
              gte(transactions.date, fyStart),
              lte(transactions.date, fyEnd)
            )
          );

        const totalIncome = Number(incomeResult[0]?.total || 0);
        const totalExpenses = Number(expenseResult[0]?.total || 0);

        return {
          propertyCount: userProperties.length,
          activeProperties: userProperties.filter((p) => p.status === "active").length,
          totalPurchaseValue,
          totalCurrentValue,
          totalLoans,
          totalEquity: totalCurrentValue - totalLoans,
          currentFY: `FY${fyYear}`,
          totalIncome,
          totalExpenses,
          netCashFlow: totalIncome - totalExpenses,
          currency: "AUD",
        };
      },
    }),

    listProperties: tool({
      description:
        "List all properties in the portfolio with address, purchase price, and status.",
      parameters: z.object({}),
      execute: async () => {
        const props = await db.query.properties.findMany({
          where: eq(properties.userId, userId),
          orderBy: [desc(properties.createdAt)],
        });
        return props.map((p) => ({
          id: p.id,
          address: `${p.address}, ${p.suburb} ${p.state} ${p.postcode}`,
          purchasePrice: Number(p.purchasePrice),
          purchaseDate: p.purchaseDate,
          status: p.status,
          entityName: p.entityName,
        }));
      },
    }),

    getPropertyDetails: tool({
      description:
        "Get detailed information about a specific property including financials, loans, and latest valuation. Use listProperties first to get the property ID.",
      parameters: z.object({
        propertyId: z.string().uuid().describe("The property ID to look up"),
      }),
      execute: async ({ propertyId }) => {
        const property = await db.query.properties.findFirst({
          where: and(eq(properties.id, propertyId), eq(properties.userId, userId)),
        });
        if (!property) return { error: "Property not found" };

        const propertyLoans = await db.query.loans.findMany({
          where: eq(loans.propertyId, propertyId),
        });

        const latestValuation = await db.query.propertyValues.findFirst({
          where: eq(propertyValues.propertyId, propertyId),
          orderBy: [desc(propertyValues.valueDate)],
        });

        const totalLoanBalance = propertyLoans.reduce(
          (sum, l) => sum + Number(l.currentBalance),
          0
        );
        const currentValue = latestValuation
          ? Number(latestValuation.estimatedValue)
          : Number(property.purchasePrice);

        return {
          id: property.id,
          address: `${property.address}, ${property.suburb} ${property.state} ${property.postcode}`,
          purchasePrice: Number(property.purchasePrice),
          purchaseDate: property.purchaseDate,
          status: property.status,
          entityName: property.entityName,
          currentValue,
          equity: currentValue - totalLoanBalance,
          loans: propertyLoans.map((l) => ({
            lender: l.lender,
            balance: Number(l.currentBalance),
            rate: Number(l.interestRate),
            type: l.loanType,
            rateType: l.rateType,
            repayment: Number(l.repaymentAmount),
            frequency: l.repaymentFrequency,
          })),
          valuationDate: latestValuation?.valueDate || null,
          currency: "AUD",
        };
      },
    }),

    getTransactions: tool({
      description:
        "Search transactions with optional filters. Returns up to 20 results. Use for questions about income, expenses, specific categories, or date ranges.",
      parameters: z.object({
        propertyId: z.string().uuid().optional().describe("Filter by property ID"),
        category: z.string().optional().describe("Filter by category (e.g. rental_income, insurance, council_rates, water_rates, repairs_maintenance)"),
        startDate: z.string().optional().describe("Filter from date (YYYY-MM-DD)"),
        endDate: z.string().optional().describe("Filter to date (YYYY-MM-DD)"),
      }),
      execute: async ({ propertyId, category, startDate, endDate }) => {
        const conditions = [eq(transactions.userId, userId)];
        if (propertyId) conditions.push(eq(transactions.propertyId, propertyId));
        if (category) conditions.push(eq(transactions.category, category as never));
        if (startDate) conditions.push(gte(transactions.date, startDate));
        if (endDate) conditions.push(lte(transactions.date, endDate));

        const results = await db.query.transactions.findMany({
          where: and(...conditions),
          orderBy: [desc(transactions.date)],
          limit: 20,
          with: { property: { columns: { address: true, suburb: true } } },
        });

        return {
          transactions: results.map((t) => ({
            date: t.date,
            description: t.description,
            amount: Number(t.amount),
            category: t.category,
            type: t.transactionType,
            propertyAddress: t.property
              ? `${t.property.address}, ${t.property.suburb}`
              : "Unassigned",
            isVerified: t.isVerified,
          })),
          count: results.length,
          note: results.length === 20 ? "Showing first 20 results. Narrow your search for more specific results." : undefined,
        };
      },
    }),

    getComplianceStatus: tool({
      description:
        "Get compliance status across the portfolio — overdue items, upcoming due dates, and overall compliance health.",
      parameters: z.object({
        propertyId: z.string().uuid().optional().describe("Filter by property ID, or omit for portfolio-wide"),
      }),
      execute: async ({ propertyId }) => {
        const userProps = propertyId
          ? await db.query.properties.findMany({
              where: and(eq(properties.id, propertyId), eq(properties.userId, userId)),
            })
          : await db.query.properties.findMany({
              where: eq(properties.userId, userId),
            });

        if (userProps.length === 0) return { error: "No properties found" };

        const allRecords = await db.query.complianceRecords.findMany({
          where: eq(complianceRecords.userId, userId),
        });

        const items = [];
        for (const prop of userProps) {
          const reqs = getRequirementsForState(prop.state as AustralianState);
          const propRecords = allRecords.filter((r) => r.propertyId === prop.id);

          for (const req of reqs) {
            const lastRecord = propRecords.find((r) => r.requirementId === req.id);
            let status = "never_completed";
            let nextDueAt = null;

            if (lastRecord) {
              nextDueAt = lastRecord.nextDueAt;
              status = calculateComplianceStatus(new Date(lastRecord.nextDueAt));
            }

            items.push({
              propertyAddress: `${prop.address}, ${prop.suburb}`,
              requirement: req.name,
              status,
              nextDueAt,
            });
          }
        }

        return {
          total: items.length,
          overdue: items.filter((i) => i.status === "overdue"),
          dueSoon: items.filter((i) => i.status === "due_soon"),
          compliant: items.filter((i) => i.status === "compliant").length,
          neverCompleted: items.filter((i) => i.status === "never_completed").length,
        };
      },
    }),

    getTasks: tool({
      description: "Get the user's tasks, optionally filtered by status or property.",
      parameters: z.object({
        status: z
          .enum(["todo", "in_progress", "done"])
          .optional()
          .describe("Filter by task status"),
        propertyId: z.string().uuid().optional().describe("Filter by property"),
      }),
      execute: async ({ status, propertyId }) => {
        const conditions = [eq(tasks.userId, userId)];
        if (status) conditions.push(eq(tasks.status, status));
        if (propertyId) conditions.push(eq(tasks.propertyId, propertyId));

        const results = await db
          .select({
            task: tasks,
            propertyAddress: properties.address,
            propertySuburb: properties.suburb,
          })
          .from(tasks)
          .leftJoin(properties, eq(tasks.propertyId, properties.id))
          .where(and(...conditions))
          .orderBy(desc(tasks.createdAt))
          .limit(20);

        return results.map((r) => ({
          title: r.task.title,
          description: r.task.description,
          status: r.task.status,
          priority: r.task.priority,
          dueDate: r.task.dueDate,
          property: r.propertyAddress
            ? `${r.propertyAddress}, ${r.propertySuburb}`
            : null,
        }));
      },
    }),

    getLoans: tool({
      description: "Get loan details across the portfolio or for a specific property.",
      parameters: z.object({
        propertyId: z.string().uuid().optional().describe("Filter by property"),
      }),
      execute: async ({ propertyId }) => {
        const conditions = [eq(loans.userId, userId)];
        if (propertyId) conditions.push(eq(loans.propertyId, propertyId));

        const results = await db.query.loans.findMany({
          where: and(...conditions),
          with: { property: { columns: { address: true, suburb: true } } },
        });

        return results.map((l) => ({
          lender: l.lender,
          currentBalance: Number(l.currentBalance),
          originalAmount: Number(l.originalAmount),
          interestRate: Number(l.interestRate),
          loanType: l.loanType,
          rateType: l.rateType,
          repaymentAmount: Number(l.repaymentAmount),
          repaymentFrequency: l.repaymentFrequency,
          fixedRateExpiry: l.fixedRateExpiry,
          property: l.property
            ? `${l.property.address}, ${l.property.suburb}`
            : "Unknown",
        }));
      },
    }),
  };
}
