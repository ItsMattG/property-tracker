import { describe, it, expect } from "vitest";

import { findPotentialDuplicate } from "../duplicate-detection";

const mockTransactions = [
  {
    id: "tx-1",
    date: "2026-01-15",
    amount: "-150.00",
    description: "Bunnings Warehouse",
    status: "confirmed",
  },
  {
    id: "tx-2",
    date: "2026-02-01",
    amount: "-250.00",
    description: "ABC Plumbing",
    status: "confirmed",
  },
];

describe("findPotentialDuplicate", () => {
  it("finds exact match on amount + date + vendor", () => {
    const result = findPotentialDuplicate(
      { amount: 150, date: "2026-01-15", vendor: "Bunnings Warehouse" },
      mockTransactions
    );
    expect(result).toBe("tx-1");
  });

  it("finds match within 7-day window", () => {
    const result = findPotentialDuplicate(
      { amount: 150, date: "2026-01-18", vendor: "Bunnings" },
      mockTransactions
    );
    expect(result).toBe("tx-1");
  });

  it("returns null when no match", () => {
    const result = findPotentialDuplicate(
      { amount: 999, date: "2026-01-15", vendor: "Unknown" },
      mockTransactions
    );
    expect(result).toBeNull();
  });

  it("returns null when date outside 7-day window", () => {
    const result = findPotentialDuplicate(
      { amount: 150, date: "2026-01-25", vendor: "Bunnings" },
      mockTransactions
    );
    expect(result).toBeNull();
  });

  it("matches vendor name fuzzily (substring)", () => {
    const result = findPotentialDuplicate(
      { amount: 250, date: "2026-02-01", vendor: "ABC Plumbing Services" },
      mockTransactions
    );
    expect(result).toBe("tx-2");
  });

  it("skips pending_review transactions", () => {
    const txWithPending = [
      ...mockTransactions,
      {
        id: "tx-3",
        date: "2026-01-15",
        amount: "-150.00",
        description: "Bunnings",
        status: "pending_review",
      },
    ];
    const result = findPotentialDuplicate(
      { amount: 150, date: "2026-01-15", vendor: "Bunnings" },
      txWithPending
    );
    expect(result).toBe("tx-1");
  });

  it("returns null when amount is null", () => {
    const result = findPotentialDuplicate(
      { amount: null, date: "2026-01-15", vendor: "Bunnings" },
      mockTransactions
    );
    expect(result).toBeNull();
  });
});
