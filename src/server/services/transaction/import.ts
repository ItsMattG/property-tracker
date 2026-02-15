import type { ITransactionRepository } from "@/server/repositories/interfaces/transaction.repository.interface";
import type { CSVRow } from "@/server/services/banking";
import type { TransactionCategory, TransactionType } from "./category";

interface ImportResult {
  importedCount: number;
  errorCount: number;
  errors: string[];
}

interface RichCSVRow {
  date: string;
  description: string;
  amount: number;
  propertyId: string | null;
  category: TransactionCategory;
  transactionType: TransactionType;
  isDeductible: boolean;
  notes: string | null;
  invoiceUrl: string | null;
  invoicePresent: boolean;
}

/** Import basic CSV rows — assigns all to a single property as uncategorized */
export async function importCSVRows(
  repo: ITransactionRepository,
  userId: string,
  propertyId: string,
  rows: CSVRow[]
): Promise<ImportResult> {
  const imported: string[] = [];
  const errors: string[] = [];

  for (const row of rows) {
    try {
      const transaction = await repo.create({
        userId,
        propertyId,
        date: row.date,
        description: row.description,
        amount: row.amount,
        category: "uncategorized",
        transactionType: parseFloat(row.amount) >= 0 ? "income" : "expense",
        isDeductible: false,
      });

      imported.push(transaction.id);
    } catch (error) {
      errors.push(`Row ${row.date} ${row.description}: ${error}`);
    }
  }

  return {
    importedCount: imported.length,
    errorCount: errors.length,
    errors: errors.slice(0, 5),
  };
}

/** Import rich CSV rows — each row includes category, property, and metadata */
export async function importRichCSVRows(
  repo: ITransactionRepository,
  userId: string,
  rows: RichCSVRow[]
): Promise<ImportResult> {
  const imported: string[] = [];
  const errors: string[] = [];

  for (const row of rows) {
    try {
      const transaction = await repo.create({
        userId,
        propertyId: row.propertyId,
        date: row.date,
        description: row.description,
        amount: row.amount.toString(),
        category: row.category,
        transactionType: row.transactionType,
        isDeductible: row.isDeductible,
        notes: row.notes,
        invoiceUrl: row.invoiceUrl,
        invoicePresent: row.invoicePresent,
      });

      imported.push(transaction.id);
    } catch (error) {
      errors.push(`Row ${row.date} ${row.description}: ${error}`);
    }
  }

  return {
    importedCount: imported.length,
    errorCount: errors.length,
    errors: errors.slice(0, 5),
  };
}
