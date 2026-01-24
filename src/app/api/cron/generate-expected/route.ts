import { NextResponse } from "next/server";
import { db } from "@/server/db";
import {
  recurringTransactions,
  expectedTransactions,
  transactions,
} from "@/server/db/schema";
import { eq, and, lte } from "drizzle-orm";
import {
  generateExpectedTransactions,
  findMatchingTransactions,
} from "@/server/services/recurring";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

    // Step 2: Generate expected transactions for each template
    for (const template of templates) {
      try {
        // Get existing expected transaction dates
        const existing = await db.query.expectedTransactions.findMany({
          where: eq(
            expectedTransactions.recurringTransactionId,
            template.id
          ),
        });
        const existingDates = existing.map((e) => e.expectedDate);

        // Generate new expected transactions
        const generated = generateExpectedTransactions(
          template,
          today,
          14,
          existingDates
        );

        if (generated.length > 0) {
          await db.insert(expectedTransactions).values(
            generated.map((g) => ({
              recurringTransactionId: g.recurringTransactionId,
              userId: g.userId,
              propertyId: g.propertyId,
              expectedDate: g.expectedDate,
              expectedAmount: g.expectedAmount,
            }))
          );
          results.generated += generated.length;
        }
      } catch (error) {
        results.errors.push(
          `Failed to generate for template ${template.id}: ${error}`
        );
      }
    }

    // Step 3: Run matching for pending expected transactions
    const pending = await db.query.expectedTransactions.findMany({
      where: eq(expectedTransactions.status, "pending"),
      with: {
        recurringTransaction: true,
      },
    });

    // Get all transactions that could be matched
    const allTransactions = await db.query.transactions.findMany({
      orderBy: (t, { desc }) => [desc(t.date)],
    });

    for (const expected of pending) {
      if (!expected.recurringTransaction) continue;

      try {
        const amountTolerance = Number(
          expected.recurringTransaction.amountTolerance
        );
        const dateTolerance = Number(
          expected.recurringTransaction.dateTolerance
        );

        // Filter to user's transactions
        const userTransactions = allTransactions.filter(
          (t) => t.userId === expected.userId
        );

        const matches = findMatchingTransactions(
          expected,
          userTransactions,
          amountTolerance,
          dateTolerance
        );

        // Auto-match high confidence
        if (matches.length > 0 && matches[0].confidence === "high") {
          await db
            .update(expectedTransactions)
            .set({
              status: "matched",
              matchedTransactionId: matches[0].transaction.id,
            })
            .where(eq(expectedTransactions.id, expected.id));

          // Apply template to transaction
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

    // Step 4: Mark missed transactions
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

          // TODO: Queue email alert
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
