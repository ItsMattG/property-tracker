import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getMargin,
  getEstimatedMarketRate,
  getLatestCashRate,
  LoanPurpose,
  RepaymentType
} from "../rate-data";
import { db } from "@/server/db";

vi.mock("@/server/db", () => ({
  db: {
    query: {
      rateHistory: {
        findFirst: vi.fn(),
      },
    },
  },
}));

describe("rate-data service", () => {
  describe("getMargin", () => {
    it("returns 2.00 for owner occupied P&I with LVR <= 80%", () => {
      const margin = getMargin("owner_occupied", "principal_and_interest", 80);
      expect(margin).toBe(2.0);
    });

    it("returns 2.30 for owner occupied P&I with LVR > 80%", () => {
      const margin = getMargin("owner_occupied", "principal_and_interest", 85);
      expect(margin).toBe(2.3);
    });

    it("returns 2.40 for owner occupied IO with LVR <= 80%", () => {
      const margin = getMargin("owner_occupied", "interest_only", 70);
      expect(margin).toBe(2.4);
    });

    it("returns 2.70 for owner occupied IO with LVR > 80%", () => {
      const margin = getMargin("owner_occupied", "interest_only", 90);
      expect(margin).toBe(2.7);
    });

    it("returns 2.30 for investor P&I with LVR <= 80%", () => {
      const margin = getMargin("investor", "principal_and_interest", 75);
      expect(margin).toBe(2.3);
    });

    it("returns 2.60 for investor P&I with LVR > 80%", () => {
      const margin = getMargin("investor", "principal_and_interest", 85);
      expect(margin).toBe(2.6);
    });

    it("returns 2.60 for investor IO with LVR <= 80%", () => {
      const margin = getMargin("investor", "interest_only", 80);
      expect(margin).toBe(2.6);
    });

    it("returns 2.90 for investor IO with LVR > 80%", () => {
      const margin = getMargin("investor", "interest_only", 95);
      expect(margin).toBe(2.9);
    });
  });
});

describe("getLatestCashRate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the latest cash rate from database", async () => {
    vi.mocked(db.query.rateHistory.findFirst).mockResolvedValue({
      id: "123",
      rateDate: "2026-01-20",
      cashRate: "4.35",
      createdAt: new Date(),
    });

    const rate = await getLatestCashRate();
    expect(rate).toBe(4.35);
  });

  it("returns null when no rates exist", async () => {
    vi.mocked(db.query.rateHistory.findFirst).mockResolvedValue(undefined);

    const rate = await getLatestCashRate();
    expect(rate).toBeNull();
  });
});

describe("getEstimatedMarketRate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns cash rate plus margin", async () => {
    vi.mocked(db.query.rateHistory.findFirst).mockResolvedValue({
      id: "123",
      rateDate: "2026-01-20",
      cashRate: "4.35",
      createdAt: new Date(),
    });

    const rate = await getEstimatedMarketRate("owner_occupied", "principal_and_interest", 75);
    expect(rate).toBe(6.35); // 4.35 + 2.0
  });

  it("returns null when no cash rate available", async () => {
    vi.mocked(db.query.rateHistory.findFirst).mockResolvedValue(undefined);

    const rate = await getEstimatedMarketRate("owner_occupied", "principal_and_interest", 75);
    expect(rate).toBeNull();
  });
});
