import { NextResponse } from "next/server";
import { db } from "@/server/db";
import {
  recurringTransactions,
  expectedTransactions,
  transactions,
} from "@/server/db/schema";
import { eq, inArray } from "drizzle-orm";
import {
  generateExpectedTransactions,
  findMatchingTransactions,
} from "@/server/services/recurring";
import { verifyCronRequest, unauthorizedResponse } from "@/lib/cron-auth";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!verifyCronRequest(request.headers)) {
    return unauthorizedResponse();
  }

  const today = new Date();
  const results = {
    generated: 0,
    matched: 0,
    missed: 0,
    errors: [] as string[],
  };

  try {
    // Step 1: Get all active recurring templates
    const templates = await db.query.recurringTransactions.findMany({
      where: eq(recurringTransactions.isActive, true),
    });

    if (templates.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No active templates",
        results,
      });
    }

    const templateIds = templates.map((t) => t.id);

    // Step 2: Batch fetch ALL existing expected transactions for these templates
    const allExisting = await db.query.expectedTransactions.findMany({
      where: inArray(expectedTransactions.recurringTransactionId, templateIds),
    });

    // Group by template ID for O(1) lookup
    const existingByTemplate = new Map<string, string[]>();
    for (const exp of allExisting) {
      const dates = existingByTemplate.get(exp.recurringTransactionId) || [];
      dates.push(exp.expectedDate);
      existingByTemplate.set(exp.recurringTransactionId, dates);
    }

    // Step 3: Generate new expected transactions (batch insert)
    const toInsert: Array<{
      recurringTransactionId: string;
      userId: string;
      propertyId: string;
      expectedDate: string;
      expectedAmount: string;
    }> = [];

    for (const template of templates) {
      try {
        const existingDates = existingByTemplate.get(template.id) || [];
        const generated = generateExpectedTransactions(
          template,
          today,
          14,
          existingDates
        );

        for (const g of generated) {
          toInsert.push({
            recurringTransactionId: g.recurringTransactionId,
            userId: g.userId,
            propertyId: g.propertyId,
            expectedDate: g.expectedDate,
            expectedAmount: g.expectedAmount,
          });
        }
      } catch (error) {
        results.errors.push(
          `Failed to generate for template ${template.id}: ${error}`
        );
      }
    }

    // Batch insert all generated expected transactions
    if (toInsert.length > 0) {
      await db.insert(expectedTransactions).values(toInsert);
      results.generated = toInsert.length;
    }

    // Step 4: Run matching for pending expected transactions
    const pending = await db.query.expectedTransactions.findMany({
      where: eq(expectedTransactions.status, "pending"),
      with: {
        recurringTransaction: true,
      },
    });

    if (pending.length > 0) {
      // Get unique user IDs from pending
      const userIds = [...new Set(pending.map((p) => p.userId))];

      // Batch fetch transactions for all relevant users (with reasonable limit)
      const recentTransactions = await db.query.transactions.findMany({
        where: inArray(transactions.userId, userIds),
        orderBy: (t, { desc }) => [desc(t.date)],
        limit: 1000,
      });

      // Group transactions by user for O(1) lookup
      const txByUser = new Map<string, typeof recentTransactions>();
      for (const tx of recentTransactions) {
        const userTxs = txByUser.get(tx.userId) || [];
        userTxs.push(tx);
        txByUser.set(tx.userId, userTxs);
      }

      // Process matches
      for (const expected of pending) {
        if (!expected.recurringTransaction) continue;

        try {
          const amountTolerance = Number(
            expected.recurringTransaction.amountTolerance
          );
          const dateTolerance = Number(
            expected.recurringTransaction.dateTolerance
          );

          const userTransactions = txByUser.get(expected.userId) || [];
          const matches = findMatchingTransactions(
            expected,
            userTransactions,
            amountTolerance,
            dateTolerance
          );

          if (matches.length > 0 && matches[0].confidence === "high") {
            await db
              .update(expectedTransactions)
              .set({
                status: "matched",
                matchedTransactionId: matches[0].transaction.id,
              })
              .where(eq(expectedTransactions.id, expected.id));

            await db
              .update(transactions)
              .set({
                category: expected.recurringTransaction.category,
                transactionType: expected.recurringTransaction.transactionType,
                propertyId: expected.propertyId,
                updatedAt: new Date(),
              })
              .where(eq(transactions.id, matches[0].transaction.id));

            results.matched++;
          }
        } catch (error) {
          results.errors.push(
            `Failed to match expected ${expected.id}: ${error}`
          );
        }
      }
    }

    // Step 5: Mark missed transactions
    const stillPending = await db.query.expectedTransactions.findMany({
      where: eq(expectedTransactions.status, "pending"),
      with: {
        recurringTransaction: true,
      },
    });

    for (const expected of stillPending) {
      if (!expected.recurringTransaction) continue;

      const alertDelayDays = Number(
        expected.recurringTransaction.alertDelayDays
      );
      const expectedDate = new Date(expected.expectedDate);
      const missedThreshold = new Date(expectedDate);
      missedThreshold.setDate(missedThreshold.getDate() + alertDelayDays);

      if (today > missedThreshold) {
        try {
          await db
            .update(expectedTransactions)
            .set({ status: "missed" })
            .where(eq(expectedTransactions.id, expected.id));
          results.missed++;
        } catch (error) {
          results.errors.push(
            `Failed to mark missed ${expected.id}: ${error}`
          );
        }
      }
    }
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: String(error),
        results,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    message: "Generate expected cron executed",
    timestamp: new Date().toISOString(),
    results,
  });
}
