import { z } from "zod";

const MAX_FIELD_LENGTH = 500;
const FORMULA_CHARS = ["=", "+", "-", "@"];

export const csvRowSchema = z.object({
  date: z.string(),
  description: z.string(),
  amount: z.string(),
  category: z.string().optional(),
});

export type CSVRow = z.infer<typeof csvRowSchema>;

/**
 * Sanitize a field to prevent CSV injection attacks
 */
export function sanitizeField(value: string): string {
  if (!value) return value;

  let sanitized = value;

  // Truncate overly long fields
  if (sanitized.length > MAX_FIELD_LENGTH) {
    sanitized = sanitized.slice(0, MAX_FIELD_LENGTH);
  }

  // Escape formula injection characters by prefixing with single quote
  if (FORMULA_CHARS.some((char) => sanitized.startsWith(char))) {
    sanitized = "'" + sanitized;
  }

  return sanitized;
}

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
    const rawDescription = values[descIdx]?.replace(/"/g, "");
    const description = sanitizeField(rawDescription || "");

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
