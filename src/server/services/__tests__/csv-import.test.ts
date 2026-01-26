import { describe, it, expect } from "vitest";
import { parseCSV, sanitizeField } from "../csv-import";

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
