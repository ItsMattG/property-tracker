import { describe, it, expect } from "vitest";
import {
  parseCSV,
  sanitizeField,
  parseCSVHeaders,
  matchCategory,
  matchTransactionType,
  parseBooleanField,
  splitCSVLine,
  parseRichCSV,
} from "../csv-import";

describe("parseCSV", () => {
  it("parses standard CSV with Date, Description, Amount columns", () => {
    const csv = `Date,Description,Amount
15/01/2026,Rent payment,2400.00
16/01/2026,Water bill,-85.50`;

    const result = parseCSV(csv);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      date: "2026-01-15",
      description: "Rent payment",
      amount: "2400.00",
    });
    expect(result[1]).toEqual({
      date: "2026-01-16",
      description: "Water bill",
      amount: "-85.50",
    });
  });

  it("handles Debit/Credit columns instead of Amount", () => {
    const csv = `Date,Description,Debit,Credit
15/01/2026,Rent payment,,2400.00
16/01/2026,Water bill,85.50,`;

    const result = parseCSV(csv);

    expect(result).toHaveLength(2);
    expect(result[0].amount).toBe("2400");
    expect(result[1].amount).toBe("-85.5");
  });

  it("handles YYYY-MM-DD date format", () => {
    const csv = `Date,Description,Amount
2026-01-15,Rent payment,2400.00`;

    const result = parseCSV(csv);

    expect(result[0].date).toBe("2026-01-15");
  });

  it("handles DD-MM-YYYY date format", () => {
    const csv = `Date,Description,Amount
15-01-2026,Rent payment,2400.00`;

    const result = parseCSV(csv);

    expect(result[0].date).toBe("2026-01-15");
  });

  it("throws error for empty CSV (header only)", () => {
    const csv = `Date,Description,Amount`;

    expect(() => parseCSV(csv)).toThrow(
      "CSV must have at least a header row and one data row"
    );
  });

  it("skips rows with missing required fields", () => {
    const csv = `Date,Description,Amount
15/01/2026,Rent payment,2400.00
,Missing date,100.00
15/01/2026,,100.00`;

    const result = parseCSV(csv);

    expect(result).toHaveLength(1);
  });

  it("should sanitize description fields for formula injection", () => {
    const csv = `Date,Description,Amount
15/01/2026,=SUM(A1:A10),100.00`;

    const rows = parseCSV(csv);
    expect(rows[0].description).toBe("'=SUM(A1:A10)");
  });
});

describe("sanitizeField", () => {
  it("should escape formula injection characters", () => {
    expect(sanitizeField("=SUM(A1:A10)")).toBe("'=SUM(A1:A10)");
    expect(sanitizeField("+1234567890")).toBe("'+1234567890");
    expect(sanitizeField("-1234567890")).toBe("'-1234567890");
    expect(sanitizeField("@SUM(A1)")).toBe("'@SUM(A1)");
  });

  it("should not modify safe strings", () => {
    expect(sanitizeField("Normal description")).toBe("Normal description");
    expect(sanitizeField("Payment to John")).toBe("Payment to John");
    expect(sanitizeField("Rent from tenant")).toBe("Rent from tenant");
  });

  it("should truncate overly long fields", () => {
    const longString = "a".repeat(1000);
    expect(sanitizeField(longString).length).toBe(500);
  });

  it("should handle empty strings", () => {
    expect(sanitizeField("")).toBe("");
  });
});

describe("parseCSVHeaders", () => {
  it("detects all column types from rich spreadsheet headers", () => {
    const headers = [
      "Date", "Property", "Type", "Sub-Category", "Description",
      "Amount (AUD)", "Deductible?", "Capitalised?", "Linked Invoice (URL)",
      "Invoice Present?", "Notes", "Month", "Financial Year", "Tax Category"
    ];
    const result = parseCSVHeaders(headers);
    expect(result.date).toBe(0);
    expect(result.property).toBe(1);
    expect(result.transactionType).toBe(2);
    expect(result.category).toBe(3);
    expect(result.description).toBe(4);
    expect(result.amount).toBe(5);
    expect(result.isDeductible).toBe(6);
    expect(result.invoiceUrl).toBe(8);
    expect(result.invoicePresent).toBe(9);
    expect(result.notes).toBe(10);
  });

  it("detects basic bank CSV headers", () => {
    const headers = ["Date", "Description", "Amount"];
    const result = parseCSVHeaders(headers);
    expect(result.date).toBe(0);
    expect(result.description).toBe(1);
    expect(result.amount).toBe(2);
    expect(result.property).toBe(-1);
  });

  it("detects debit/credit columns", () => {
    const headers = ["Transaction Date", "Narrative", "Debit", "Credit"];
    const result = parseCSVHeaders(headers);
    expect(result.date).toBe(0);
    expect(result.description).toBe(1);
    expect(result.debit).toBe(2);
    expect(result.credit).toBe(3);
  });

  it("returns -1 for undetected columns", () => {
    const headers = ["Date", "Description", "Amount"];
    const result = parseCSVHeaders(headers);
    expect(result.debit).toBe(-1);
    expect(result.credit).toBe(-1);
    expect(result.category).toBe(-1);
    expect(result.isDeductible).toBe(-1);
    expect(result.invoiceUrl).toBe(-1);
    expect(result.invoicePresent).toBe(-1);
    expect(result.notes).toBe(-1);
    expect(result.transactionType).toBe(-1);
  });

  it("matches case-insensitively", () => {
    const headers = ["DATE", "DESCRIPTION", "AMOUNT"];
    const result = parseCSVHeaders(headers);
    expect(result.date).toBe(0);
    expect(result.description).toBe(1);
    expect(result.amount).toBe(2);
  });

  it("matches 'amount(aud)' variant", () => {
    const headers = ["Date", "Description", "Amount(AUD)"];
    const result = parseCSVHeaders(headers);
    expect(result.amount).toBe(2);
  });
});

describe("matchCategory", () => {
  it("matches exact category labels", () => {
    expect(matchCategory("Insurance")).toBe("insurance");
    expect(matchCategory("Cleaning")).toBe("cleaning");
  });

  it("matches fuzzy category labels", () => {
    expect(matchCategory("Borrowing expenses")).toBe("borrowing_expenses");
    expect(matchCategory("Council rates")).toBe("council_rates");
    expect(matchCategory("Sundry rental expenses")).toBe("sundry_rental_expenses");
    expect(matchCategory("Legal expenses")).toBe("legal_expenses");
    expect(matchCategory("Water charges")).toBe("water_charges");
    expect(matchCategory("Body Corporate Fees")).toBe("body_corporate");
  });

  it("matches capital categories", () => {
    expect(matchCategory("Stamp Duty")).toBe("stamp_duty");
    expect(matchCategory("Conveyancing")).toBe("conveyancing");
    expect(matchCategory("Buyer's Agent Fees")).toBe("buyers_agent_fees");
  });

  it("returns null for unrecognized categories", () => {
    expect(matchCategory("Unknown Thing")).toBeNull();
    expect(matchCategory("")).toBeNull();
  });

  it("matches exact value strings", () => {
    expect(matchCategory("insurance")).toBe("insurance");
    expect(matchCategory("borrowing_expenses")).toBe("borrowing_expenses");
    expect(matchCategory("stamp_duty")).toBe("stamp_duty");
  });
});

describe("matchTransactionType", () => {
  it("maps common type strings", () => {
    expect(matchTransactionType("Capital")).toBe("capital");
    expect(matchTransactionType("Expense")).toBe("expense");
    expect(matchTransactionType("Income")).toBe("income");
    expect(matchTransactionType("CAPITAL")).toBe("capital");
  });

  it("matches Transfer and Personal", () => {
    expect(matchTransactionType("Transfer")).toBe("transfer");
    expect(matchTransactionType("Personal")).toBe("personal");
  });

  it("returns null for unrecognized types", () => {
    expect(matchTransactionType("Unknown")).toBeNull();
    expect(matchTransactionType("")).toBeNull();
  });
});

describe("parseBooleanField", () => {
  it("parses truthy values", () => {
    expect(parseBooleanField("Y")).toBe(true);
    expect(parseBooleanField("Yes")).toBe(true);
    expect(parseBooleanField("true")).toBe(true);
    expect(parseBooleanField("1")).toBe(true);
  });

  it("parses falsy values", () => {
    expect(parseBooleanField("N")).toBe(false);
    expect(parseBooleanField("No")).toBe(false);
    expect(parseBooleanField("false")).toBe(false);
    expect(parseBooleanField("0")).toBe(false);
  });

  it("returns null for unparseable values", () => {
    expect(parseBooleanField("")).toBeNull();
    expect(parseBooleanField("maybe")).toBeNull();
  });
});

describe("splitCSVLine", () => {
  it("splits simple CSV line", () => {
    expect(splitCSVLine("a,b,c")).toEqual(["a", "b", "c"]);
  });

  it("handles quoted fields with commas", () => {
    expect(splitCSVLine('a,"hello, world",c')).toEqual(["a", "hello, world", "c"]);
  });

  it("trims whitespace from values", () => {
    expect(splitCSVLine(" a , b , c ")).toEqual(["a", "b", "c"]);
  });

  it("handles empty fields", () => {
    expect(splitCSVLine("a,,c")).toEqual(["a", "", "c"]);
  });
});

describe("parseRichCSV", () => {
  it("parses a rich CSV with all columns", () => {
    const csv = `Date,Property,Type,Sub-Category,Description,Amount (AUD),Deductible?,Notes
14/10/2025,North Bendigo,Expense,Insurance,Building Insurance,$1864.14,Y,Annual premium`;

    const headers = csv.split("\n")[0].split(",");
    const columnMap = parseCSVHeaders(headers);
    const rows = parseRichCSV(csv, columnMap);

    expect(rows).toHaveLength(1);
    expect(rows[0].date).toBe("2025-10-14");
    expect(rows[0].property).toBe("North Bendigo");
    expect(rows[0].category).toBe("Insurance");
    expect(rows[0].amount).toBe("1864.14");
    expect(rows[0].isDeductible).toBe(true);
    expect(rows[0].notes).toBe("Annual premium");
  });

  it("handles missing optional columns gracefully", () => {
    const csv = `Date,Description,Amount
15/01/2026,Rent payment,2400.00`;

    const headers = csv.split("\n")[0].split(",");
    const columnMap = parseCSVHeaders(headers);
    const rows = parseRichCSV(csv, columnMap);

    expect(rows).toHaveLength(1);
    expect(rows[0].date).toBe("2026-01-15");
    expect(rows[0].property).toBeNull();
    expect(rows[0].category).toBeNull();
    expect(rows[0].notes).toBeNull();
  });

  it("handles debit/credit columns when amount is missing", () => {
    const csv = `Date,Description,Debit,Credit
15/01/2026,Rent received,,2400.00
16/01/2026,Water bill,85.50,`;

    const headers = csv.split("\n")[0].split(",");
    const columnMap = parseCSVHeaders(headers);
    const rows = parseRichCSV(csv, columnMap);

    expect(rows).toHaveLength(2);
    expect(rows[0].amount).toBe("2400");
    expect(rows[1].amount).toBe("-85.5");
  });

  it("assigns correct rowNumbers (1-indexed, header=row 1)", () => {
    const csv = `Date,Description,Amount
15/01/2026,Row one,100
16/01/2026,Row two,200`;

    const headers = csv.split("\n")[0].split(",");
    const columnMap = parseCSVHeaders(headers);
    const rows = parseRichCSV(csv, columnMap);

    expect(rows[0].rowNumber).toBe(2);
    expect(rows[1].rowNumber).toBe(3);
  });

  it("skips empty lines", () => {
    const csv = `Date,Description,Amount
15/01/2026,Row one,100

16/01/2026,Row two,200`;

    const headers = csv.split("\n")[0].split(",");
    const columnMap = parseCSVHeaders(headers);
    const rows = parseRichCSV(csv, columnMap);

    expect(rows).toHaveLength(2);
  });

  it("returns null date for unparseable dates", () => {
    const csv = `Date,Description,Amount
not-a-date,Something,100`;

    const headers = csv.split("\n")[0].split(",");
    const columnMap = parseCSVHeaders(headers);
    const rows = parseRichCSV(csv, columnMap);

    expect(rows).toHaveLength(1);
    expect(rows[0].date).toBeNull();
  });
});
