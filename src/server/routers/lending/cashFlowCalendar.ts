import { z } from "zod";
import { router, protectedProcedure } from "../../trpc";
import {
  expectedTransactions,
  transactions,
  loans,
  properties,
  bankAccounts,
  cashFlowForecasts,
  forecastScenarios,
} from "../../db/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { calculateNextDates } from "../../services/transaction";

interface CalendarEvent {
  id: string;
  date: string;
  amount: number;
  description: string;
  category: string;
  type: "income" | "expense";
  source: "expected" | "loan" | "actual" | "forecast";
  status: "pending" | "matched" | "missed" | "confirmed" | "skipped";
  propertyId: string | null;
  propertyAddress: string | null;
}

interface DailyBalance {
  date: string;
  balance: number;
  isForecasted: boolean;
}

export const cashFlowCalendarRouter = router({
  getEvents: protectedProcedure
    .input(
      z.object({
        startDate: z.string(), // YYYY-MM-DD
        endDate: z.string(),
        propertyId: z.string().uuid().optional(),
        scenarioId: z.string().uuid().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.portfolio.ownerId;
      const { startDate, endDate, propertyId, scenarioId } = input;

      // Cross-domain: calendar aggregates properties, loans, transactions, forecasts, accounts
      const userProperties = await ctx.db.query.properties.findMany({
        where: and(
          eq(properties.userId, userId),
          eq(properties.status, "active")
        ),
        columns: { id: true, address: true },
      });
      const propertyMap = new Map(userProperties.map((p) => [p.id, p.address]));
      const propertyIds = propertyId
        ? [propertyId]
        : userProperties.map((p) => p.id);

      if (propertyIds.length === 0) {
        return { events: [] as CalendarEvent[], projectedBalances: [] as DailyBalance[] };
      }

      // 1. Expected transactions (recurring)
      const expectedFilter = and(
        eq(expectedTransactions.userId, userId),
        gte(expectedTransactions.expectedDate, startDate),
        lte(expectedTransactions.expectedDate, endDate),
        ...(propertyId
          ? [eq(expectedTransactions.propertyId, propertyId)]
          : [])
      );
      const expectedRows = await ctx.db.query.expectedTransactions.findMany({
        where: expectedFilter,
        with: { recurringTransaction: { columns: { description: true, category: true, transactionType: true } } },
      });
      const matchedTransactionIds = expectedRows
        .filter((e) => e.matchedTransactionId)
        .map((e) => e.matchedTransactionId!);

      const expectedEvents: CalendarEvent[] = expectedRows.map((e) => ({
        id: `expected-${e.id}`,
        date: e.expectedDate,
        amount: Number(e.expectedAmount),
        description: e.recurringTransaction?.description ?? "Recurring",
        category: e.recurringTransaction?.category ?? "uncategorized",
        type: e.recurringTransaction?.transactionType === "income" ? "income" : "expense",
        source: "expected" as const,
        status: e.status as CalendarEvent["status"],
        propertyId: e.propertyId,
        propertyAddress: propertyMap.get(e.propertyId) ?? null,
      }));

      // 2. Loan repayments (generated on-the-fly)
      const userLoans = await ctx.db.query.loans.findMany({
        where: and(
          eq(loans.userId, userId),
          ...(propertyId ? [eq(loans.propertyId, propertyId)] : [])
        ),
      });

      const today = new Date();
      const todayStr = today.toISOString().split("T")[0];
      const loanEvents: CalendarEvent[] = [];

      for (const loan of userLoans) {
        const freqMap: Record<string, string> = {
          weekly: "weekly",
          fortnightly: "fortnightly",
          monthly: "monthly",
          quarterly: "quarterly",
          annually: "annually",
        };
        const frequency = (freqMap[loan.repaymentFrequency] ?? "monthly") as "weekly" | "fortnightly" | "monthly" | "quarterly" | "annually";
        const dates = calculateNextDates(
          {
            frequency,
            dayOfMonth: null,
            dayOfWeek: null,
            startDate: startDate < todayStr ? todayStr : startDate,
            endDate: endDate,
          },
          new Date(startDate),
          Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000)
        );

        for (const d of dates) {
          const dateStr = d.toISOString().split("T")[0];
          if (dateStr >= startDate && dateStr <= endDate) {
            loanEvents.push({
              id: `loan-${loan.id}-${dateStr}`,
              date: dateStr,
              amount: -Math.abs(Number(loan.repaymentAmount)),
              description: `${loan.lender} repayment`,
              category: "interest_on_loans",
              type: "expense",
              source: "loan",
              status: dateStr < todayStr ? "confirmed" : "pending",
              propertyId: loan.propertyId,
              propertyAddress: propertyMap.get(loan.propertyId) ?? null,
            });
          }
        }
      }

      // 3. Actual transactions (historical portion)
      const actualFilter = and(
        eq(transactions.userId, userId),
        gte(transactions.date, startDate),
        lte(transactions.date, endDate),
        ...(propertyId ? [eq(transactions.propertyId, propertyId)] : []),
        // Exclude transactions that are already matched to expected transactions
        ...(matchedTransactionIds.length > 0
          ? [sql`${transactions.id} NOT IN (${sql.join(matchedTransactionIds.map((id) => sql`${id}`), sql`, `)})`]
          : [])
      );
      const actualRows = await ctx.db.query.transactions.findMany({
        where: actualFilter,
        columns: {
          id: true,
          date: true,
          amount: true,
          description: true,
          category: true,
          transactionType: true,
          propertyId: true,
        },
      });

      const actualEvents: CalendarEvent[] = actualRows.map((t) => ({
        id: `actual-${t.id}`,
        date: t.date,
        amount: Number(t.amount),
        description: t.description,
        category: t.category,
        type: t.transactionType === "income" ? "income" : "expense",
        source: "actual" as const,
        status: "confirmed" as const,
        propertyId: t.propertyId,
        propertyAddress: t.propertyId ? (propertyMap.get(t.propertyId) ?? null) : null,
      }));

      // 4. Forecast scenario (optional)
      const forecastEvents: CalendarEvent[] = [];
      let effectiveScenarioId = scenarioId ?? null;

      if (!effectiveScenarioId) {
        const defaultScenario = await ctx.db.query.forecastScenarios.findFirst({
          where: and(
            eq(forecastScenarios.userId, userId),
            eq(forecastScenarios.isDefault, true)
          ),
        });
        effectiveScenarioId = defaultScenario?.id ?? null;
      }

      if (effectiveScenarioId) {
        const forecasts = await ctx.db.query.cashFlowForecasts.findMany({
          where: and(
            eq(cashFlowForecasts.userId, userId),
            eq(cashFlowForecasts.scenarioId, effectiveScenarioId),
            ...(propertyId
              ? [eq(cashFlowForecasts.propertyId, propertyId)]
              : [])
          ),
        });

        for (const f of forecasts) {
          // forecastMonth is a date column (YYYY-MM-DD)
          const monthDate = f.forecastMonth;
          if (monthDate >= startDate && monthDate <= endDate) {
            if (Number(f.projectedIncome) > 0) {
              forecastEvents.push({
                id: `forecast-income-${f.id}`,
                date: monthDate,
                amount: Number(f.projectedIncome),
                description: "Projected income",
                category: "rental_income",
                type: "income",
                source: "forecast",
                status: "pending",
                propertyId: f.propertyId,
                propertyAddress: f.propertyId ? (propertyMap.get(f.propertyId) ?? null) : null,
              });
            }
            if (Number(f.projectedExpenses) > 0) {
              forecastEvents.push({
                id: `forecast-expense-${f.id}`,
                date: monthDate,
                amount: -Math.abs(Number(f.projectedExpenses)),
                description: "Projected expenses",
                category: "uncategorized",
                type: "expense",
                source: "forecast",
                status: "pending",
                propertyId: f.propertyId,
                propertyAddress: f.propertyId ? (propertyMap.get(f.propertyId) ?? null) : null,
              });
            }
          }
        }
      }

      // Combine all events
      const events = [
        ...expectedEvents,
        ...loanEvents,
        ...actualEvents,
        ...forecastEvents,
      ].sort((a, b) => a.date.localeCompare(b.date));

      // 5. Projected balances
      // Get current bank account balances
      const accounts = await ctx.db.query.bankAccounts.findMany({
        where: eq(bankAccounts.userId, userId),
        columns: { balance: true },
      });
      let runningBalance = accounts.reduce(
        (sum, a) => sum + Number(a.balance ?? 0),
        0
      );

      const balanceMap = new Map<string, number>();
      for (const event of events) {
        const existing = balanceMap.get(event.date) ?? 0;
        balanceMap.set(event.date, existing + event.amount);
      }

      const projectedBalances: DailyBalance[] = [];
      const sortedDates = [...balanceMap.keys()].sort();
      for (const date of sortedDates) {
        runningBalance += balanceMap.get(date)!;
        projectedBalances.push({
          date,
          balance: Math.round(runningBalance * 100) / 100,
          isForecasted: date > todayStr,
        });
      }

      return { events, projectedBalances };
    }),

  getProperties: protectedProcedure.query(async ({ ctx }) => {
    // Cross-domain: calendar needs property list for filtering
    return ctx.db.query.properties.findMany({
      where: and(
        eq(properties.userId, ctx.portfolio.ownerId),
        eq(properties.status, "active")
      ),
      columns: { id: true, address: true },
      orderBy: (t, { asc }) => [asc(t.address)],
    });
  }),
});
