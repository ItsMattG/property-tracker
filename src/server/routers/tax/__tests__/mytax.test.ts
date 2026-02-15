import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockContext, createTestCaller } from "../../../__tests__/test-utils";

vi.mock("../../../services/transaction", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../services/transaction")>()),
  buildMyTaxReport: vi.fn(),
}));

import { buildMyTaxReport } from "../../../services/transaction";

const mockUser = {
  id: "user-1",
  userId: "user-1",
  email: "test@example.com",
  name: "Test User",
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("mytax router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getReport", () => {
    it("returns MyTax report for given year", async () => {
      const ctx = createMockContext({ userId: "user-1", user: mockUser });
      ctx.db = {
        query: {
          users: { findFirst: vi.fn().mockResolvedValue(mockUser) },
        },
      } as any;

      const mockReport = {
        financialYear: "FY 2025-26",
        fyNumber: 2026,
        startDate: "2025-07-01",
        endDate: "2026-06-30",
        properties: [],
        personalSummary: null,
        totalIncome: 0,
        totalDeductions: 0,
        netRentalResult: 0,
        generatedAt: "2026-01-28T00:00:00.000Z",
      };

      vi.mocked(buildMyTaxReport).mockResolvedValue(mockReport);

      const caller = createTestCaller(ctx);
      const result = await caller.mytax.getReport({ year: 2026 });

      expect(result.financialYear).toBe("FY 2025-26");
      expect(buildMyTaxReport).toHaveBeenCalledWith("user-1", 2026);
    });
  });
});
