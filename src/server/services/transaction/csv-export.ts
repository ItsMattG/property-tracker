import { db } from "@/server/db";
import { transactions, properties } from "@/server/db/schema";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { getCategoryLabel, getCategoryInfo } from "@/lib/categories";
import { format } from "date-fns";
import { axiomMetrics } from "@/lib/axiom";
import { logger } from "@/lib/logger";
import type { TransactionWithRelations } from "@/server/repositories/interfaces/transaction.repository.interface";

interface ExportOptions {
  userId: string;
  propertyId?: string;
  startDate?: string;
  endDate?: string;
  includePersonal?: boolean;
}

/** Escape a CSV value by wrapping in quotes if it contains commas, quotes, or newlines */
function escapeCsvValue(val: string): string {
  if (val.includes(",") || val.includes('"') || val.includes("\n")) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

/** Format transaction results (from findAllByOwner) into a CSV string + filename */
export function formatTransactionsCSV(
  results: TransactionWithRelations[]
): { csv: string; filename: string } {
  const header =
    "Date,Description,Amount,Category,Transaction Type,Property,Is Deductible,Is Verified,Notes";

  const rows = results.map((t) => {
    const prop = t.property as { address?: string } | null | undefined;
    return [
      t.date,
      escapeCsvValue(t.description),
      t.amount,
      getCategoryLabel(t.category),
      t.transactionType,
      prop?.address ?? "",
      t.isDeductible ? "Yes" : "No",
      t.isVerified ? "Yes" : "No",
      escapeCsvValue(t.notes ?? ""),
    ].join(",");
  });

  const csv = [header, ...rows].join("\n");
  const today = new Date().toISOString().split("T")[0];
  const filename = `bricktrack-transactions-${today}.csv`;

  return { csv, filename };
}

export async function generateTransactionsCSV(options: ExportOptions): Promise<string> {
  const startTime = Date.now();
  logger.info("Generating transactions CSV", { userId: options.userId, propertyId: options.propertyId });

  const conditions = [eq(transactions.userId, options.userId)];

  if (options.propertyId) {
    conditions.push(eq(transactions.propertyId, options.propertyId));
  }

  if (options.startDate) {
    conditions.push(gte(transactions.date, options.startDate));
  }

  if (options.endDate) {
    conditions.push(lte(transactions.date, options.endDate));
  }

  const results = await db.query.transactions.findMany({
    where: and(...conditions),
    orderBy: [desc(transactions.date)],
    with: {
      property: true,
      bankAccount: true,
    },
  });

  // Filter out personal transactions if not included
  const filteredResults = options.includePersonal
    ? results
    : results.filter((t) => t.category !== "personal");

  // Build CSV header
  const headers = [
    "Date",
    "Property",
    "Description",
    "Amount",
    "Category",
    "ATO Code",
    "Type",
    "Deductible",
    "Bank Account",
    "Verified",
  ];

  // Build CSV rows
  const rows: string[][] = filteredResults.map((t) => {
    const categoryInfo = getCategoryInfo(t.category);

    return [
      format(new Date(t.date), "dd/MM/yyyy"),
      t.property ? `${t.property.address}, ${t.property.suburb}` : "Unassigned",
      escapeCSV(t.description),
      t.amount,
      getCategoryLabel(t.category),
      categoryInfo?.atoReference || "",
      t.transactionType,
      t.isDeductible ? "Yes" : "No",
      t.bankAccount?.accountName || "",
      t.isVerified ? "Yes" : "No",
    ];
  });

  // Combine headers and rows
  const csvContent = [headers, ...rows]
    .map((row) => row.map((cell) => `"${cell}"`).join(","))
    .join("\n");

  // Track export metrics
  const duration = Date.now() - startTime;
  axiomMetrics.timing("export.duration", duration, { type: "transactions_csv" });
  axiomMetrics.increment("export.generated", { type: "transactions_csv" });
  logger.info("Transactions CSV generated", { rowCount: rows.length, duration });

  return csvContent;
}

export async function generateAnnualSummaryCSV(options: ExportOptions): Promise<string> {
  const startTime = Date.now();
  logger.info("Generating annual summary CSV", { userId: options.userId });

  const conditions = [eq(transactions.userId, options.userId)];

  if (options.startDate) {
    conditions.push(gte(transactions.date, options.startDate));
  }

  if (options.endDate) {
    conditions.push(lte(transactions.date, options.endDate));
  }

  const results = await db.query.transactions.findMany({
    where: and(...conditions),
    with: {
      property: true,
    },
  });

  // Get all user properties
  const userProperties = await db.query.properties.findMany({
    where: eq(properties.userId, options.userId),
  });

  // Aggregate by property and category
  const summary = new Map<string, Map<string, number>>();

  // Initialize with all properties
  for (const property of userProperties) {
    summary.set(property.id, new Map());
  }

  // Aggregate transactions
  for (const t of results) {
    if (t.propertyId) {
      const propertySummary = summary.get(t.propertyId);
      if (propertySummary) {
        const current = propertySummary.get(t.category) || 0;
        propertySummary.set(t.category, current + Number(t.amount));
      }
    }
  }

  // Build CSV
  const headers = ["Property", "Category", "ATO Code", "Total Amount", "Deductible"];
  const rows: string[][] = [];

  for (const [propertyId, categories] of summary) {
    const property = userProperties.find((p) => p.id === propertyId);
    if (!property) continue;

    for (const [category, total] of categories) {
      const categoryInfo = getCategoryInfo(category);
      rows.push([
        `${property.address}, ${property.suburb}`,
        getCategoryLabel(category),
        categoryInfo?.atoReference || "",
        total.toFixed(2),
        categoryInfo?.isDeductible ? "Yes" : "No",
      ]);
    }
  }

  const csvContent = [headers, ...rows]
    .map((row) => row.map((cell) => `"${cell}"`).join(","))
    .join("\n");

  // Track export metrics
  const duration = Date.now() - startTime;
  axiomMetrics.timing("export.duration", duration, { type: "annual_summary_csv" });
  axiomMetrics.increment("export.generated", { type: "annual_summary_csv" });
  logger.info("Annual summary CSV generated", { rowCount: rows.length, duration });

  return csvContent;
}

function escapeCSV(value: string): string {
  return value.replace(/"/g, '""');
}
