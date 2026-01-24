import { describe, it, expect } from "vitest";
import { parseCSV } from "../csv-import";

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
});
