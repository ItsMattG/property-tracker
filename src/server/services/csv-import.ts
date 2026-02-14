import { z } from "zod";
import { ValidationError } from "@/server/errors";
import { categories } from "@/lib/categories";

const MAX_FIELD_LENGTH = 500;
const FORMULA_CHARS = ["=", "+", "-", "@"];

export const csvRowSchema = z.object({
  date: z.string(),
  description: z.string(),
  amount: z.string(),
  category: z.string().optional(),
});

export type CSVRow = z.infer<typeof csvRowSchema>;

// --- New interfaces for enhanced CSV import ---

export interface CSVColumnMap {
  date: number;
  description: number;
  amount: number;
  debit: number;
  credit: number;
  property: number;
  transactionType: number;
  category: number;
  isDeductible: number;
  invoiceUrl: number;
  invoicePresent: number;
  notes: number;
}

export interface ParsedCSVRow {
  rowNumber: number;
  date: string | null;
  description: string | null;
  amount: string | null;
  property: string | null;
  transactionType: string | null;
  category: string | null;
  isDeductible: boolean | null;
  invoiceUrl: string | null;
  invoicePresent: boolean | null;
  notes: string | null;
}

// --- Header matchers for column detection ---

const HEADER_MATCHERS: Record<keyof CSVColumnMap, string[]> = {
  date: ["date", "transaction date", "trans date"],
  description: ["description", "desc", "narrative", "details", "memo"],
  amount: ["amount", "value", "debit/credit", "amount (aud)", "amount(aud)"],
  debit: ["debit", "withdrawal"],
  credit: ["credit", "deposit"],
  property: ["property", "property name"],
  transactionType: ["type", "transaction type"],
  category: ["sub-category", "subcategory", "category", "sub category"],
  isDeductible: ["deductible", "deductible?", "tax deductible"],
  invoiceUrl: ["linked invoice", "invoice url", "invoice link", "linked invoice (url)"],
  invoicePresent: ["invoice present", "invoice present?", "has invoice"],
  notes: ["notes", "note", "comments"],
};

// --- Core utility functions ---

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

/**
 * Split a CSV line into values, handling quoted fields with commas.
 */
export function splitCSVLine(line: string): string[] {
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

  return values;
}

/**
 * Detect column indices from header strings using fuzzy matching.
 * Returns -1 for undetected columns.
 */
export function parseCSVHeaders(headers: string[]): CSVColumnMap {
  const normalized = headers.map((h) => h.trim().toLowerCase().replace(/"/g, ""));

  const result: CSVColumnMap = {
    date: -1,
    description: -1,
    amount: -1,
    debit: -1,
    credit: -1,
    property: -1,
    transactionType: -1,
    category: -1,
    isDeductible: -1,
    invoiceUrl: -1,
    invoicePresent: -1,
    notes: -1,
  };

  for (const [column, matchers] of Object.entries(HEADER_MATCHERS)) {
    const idx = normalized.findIndex((h) => matchers.includes(h));
    if (idx !== -1) {
      result[column as keyof CSVColumnMap] = idx;
    }
  }

  return result;
}

/**
 * Fuzzy match a category string to a category enum value.
 * Matching order: exact value -> exact label (case-insensitive) -> snake_case conversion -> partial/contains.
 */
export function matchCategory(input: string): string | null {
  if (!input) return null;

  const trimmed = input.trim();
  if (!trimmed) return null;

  // 1. Exact value match
  const exactValue = categories.find((c) => c.value === trimmed);
  if (exactValue) return exactValue.value;

  // 2. Exact label match (case-insensitive)
  const lowerInput = trimmed.toLowerCase();
  const exactLabel = categories.find((c) => c.label.toLowerCase() === lowerInput);
  if (exactLabel) return exactLabel.value;

  // 3. Snake_case conversion match
  const snakeCased = lowerInput.replace(/\s+/g, "_");
  const snakeMatch = categories.find((c) => c.value === snakeCased);
  if (snakeMatch) return snakeMatch.value;

  // 4. Partial/contains match — check if input is contained in label or label in input
  const partialMatch = categories.find(
    (c) =>
      c.label.toLowerCase().includes(lowerInput) ||
      lowerInput.includes(c.label.toLowerCase())
  );
  if (partialMatch) return partialMatch.value;

  return null;
}

/**
 * Match a transaction type string to an enum value.
 * Supports: "Capital", "Expense", "Income", "Transfer", "Personal" (case-insensitive).
 */
export function matchTransactionType(input: string): string | null {
  if (!input) return null;

  const lower = input.trim().toLowerCase();
  const validTypes = ["capital", "expense", "income", "transfer", "personal"];

  if (validTypes.includes(lower)) {
    return lower;
  }

  return null;
}

/**
 * Parse a boolean-like field value.
 * "Y", "Yes", "true", "1" -> true
 * "N", "No", "false", "0" -> false
 * Otherwise -> null
 */
export function parseBooleanField(value: string): boolean | null {
  if (!value) return null;

  const lower = value.trim().toLowerCase();

  if (["y", "yes", "true", "1"].includes(lower)) return true;
  if (["n", "no", "false", "0"].includes(lower)) return false;

  return null;
}

// --- Date normalization ---

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

  throw new ValidationError(`Could not parse date: ${dateStr}`);
}

/**
 * Try to normalize a date string, returning null on failure instead of throwing.
 */
function tryNormalizeDate(dateStr: string): string | null {
  try {
    return normalizeDate(dateStr);
  } catch {
    return null;
  }
}

// --- Legacy parseCSV (refactored to use splitCSVLine) ---

export function parseCSV(csvContent: string): CSVRow[] {
  const lines = csvContent.trim().split("\n");
  if (lines.length < 2) {
    throw new ValidationError("CSV must have at least a header row and one data row");
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

  if (dateIdx === -1) throw new ValidationError("Could not find date column");
  if (descIdx === -1) throw new ValidationError("Could not find description column");
  if (amountIdx === -1 && (debitIdx === -1 || creditIdx === -1)) {
    throw new ValidationError("Could not find amount column(s)");
  }

  const rows: CSVRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = splitCSVLine(line);

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

// --- Enhanced parseRichCSV ---

/**
 * Parse a full CSV using a column map. Skips header row.
 * Returns ParsedCSVRow[] with all detectable fields.
 */
export function parseRichCSV(csvContent: string, columnMap: CSVColumnMap): ParsedCSVRow[] {
  const lines = csvContent.trim().split("\n");
  if (lines.length < 2) return [];

  const rows: ParsedCSVRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = splitCSVLine(line);

    const getValue = (colIdx: number): string | null => {
      if (colIdx === -1) return null;
      const val = values[colIdx]?.replace(/"/g, "").trim();
      return val || null;
    };

    // Parse amount: use amount column, or compute from debit/credit
    let amount: string | null = null;
    const rawAmount = getValue(columnMap.amount);
    if (rawAmount) {
      amount = rawAmount.replace(/[$,]/g, "");
    } else if (columnMap.debit !== -1 || columnMap.credit !== -1) {
      const debitStr = getValue(columnMap.debit);
      const creditStr = getValue(columnMap.credit);
      const debit = parseFloat(debitStr?.replace(/[$,]/g, "") || "0");
      const credit = parseFloat(creditStr?.replace(/[$,]/g, "") || "0");
      amount = (credit - debit).toString();
    }

    // Parse date (return null on failure)
    const rawDate = getValue(columnMap.date);
    const date = rawDate ? tryNormalizeDate(rawDate) : null;

    // Parse description with sanitization
    const rawDescription = getValue(columnMap.description);
    const description = rawDescription ? sanitizeField(rawDescription) : null;

    // Parse boolean fields
    const rawDeductible = getValue(columnMap.isDeductible);
    const isDeductible = rawDeductible ? parseBooleanField(rawDeductible) : null;

    const rawInvoicePresent = getValue(columnMap.invoicePresent);
    const invoicePresent = rawInvoicePresent ? parseBooleanField(rawInvoicePresent) : null;

    rows.push({
      rowNumber: i + 1, // 1-indexed, header = row 1, first data row = row 2
      date,
      description,
      amount,
      property: getValue(columnMap.property),
      transactionType: getValue(columnMap.transactionType),
      category: getValue(columnMap.category),
      isDeductible,
      invoiceUrl: getValue(columnMap.invoiceUrl),
      invoicePresent,
      notes: getValue(columnMap.notes),
    });
  }

  return rows;
}
