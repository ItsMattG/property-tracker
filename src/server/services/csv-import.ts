import { z } from "zod";

export const csvRowSchema = z.object({
  date: z.string(),
  description: z.string(),
  amount: z.string(),
  category: z.string().optional(),
});

export type CSVRow = z.infer<typeof csvRowSchema>;

export function parseCSV(csvContent: string): CSVRow[] {
  const lines = csvContent.trim().split("\n");
  if (lines.length < 2) {
    throw new Error("CSV must have at least a header row and one data row");
  }

  const headerLine = lines[0];
  const headers = headerLine.split(",").map((h) => h.trim().toLowerCase().replace(/"/g, ""));

  // Find column indices
  const dateIdx = headers.findIndex((h) =>
    ["date", "transaction date", "trans date"].includes(h)
  );
  const descIdx = headers.findIndex((h) =>
    ["description", "desc", "narrative", "details", "memo"].includes(h)
  );
  const amountIdx = headers.findIndex((h) =>
    ["amount", "value", "debit/credit"].includes(h)
  );
  const debitIdx = headers.findIndex((h) => ["debit", "withdrawal"].includes(h));
  const creditIdx = headers.findIndex((h) => ["credit", "deposit"].includes(h));

  if (dateIdx === -1) throw new Error("Could not find date column");
  if (descIdx === -1) throw new Error("Could not find description column");
  if (amountIdx === -1 && (debitIdx === -1 || creditIdx === -1)) {
    throw new Error("Could not find amount column(s)");
  }

  const rows: CSVRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Simple CSV parsing (handles quoted fields with commas)
    const values: string[] = [];
    let current = "";
    let inQuotes = false;

    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        values.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    const date = values[dateIdx]?.replace(/"/g, "");
    const description = values[descIdx]?.replace(/"/g, "");

    let amount: string;
    if (amountIdx !== -1) {
      amount = values[amountIdx]?.replace(/"/g, "").replace(/[$,]/g, "");
    } else {
      const debit = parseFloat(values[debitIdx]?.replace(/"/g, "").replace(/[$,]/g, "") || "0");
      const credit = parseFloat(values[creditIdx]?.replace(/"/g, "").replace(/[$,]/g, "") || "0");
      amount = (credit - debit).toString();
    }

    if (date && description && amount) {
      rows.push({
        date: normalizeDate(date),
        description,
        amount,
      });
    }
  }

  return rows;
}

function normalizeDate(dateStr: string): string {
  // Handle various date formats
  const patterns = [
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, // DD/MM/YYYY or MM/DD/YYYY
    /^(\d{4})-(\d{2})-(\d{2})$/, // YYYY-MM-DD
    /^(\d{1,2})-(\d{1,2})-(\d{4})$/, // DD-MM-YYYY
  ];

  for (const pattern of patterns) {
    const match = dateStr.match(pattern);
    if (match) {
      if (pattern === patterns[1]) {
        // Already YYYY-MM-DD
        return dateStr;
      }
      // Assume DD/MM/YYYY for Australian format
      const [, day, month, year] = match;
      return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    }
  }

  throw new Error(`Could not parse date: ${dateStr}`);
}
