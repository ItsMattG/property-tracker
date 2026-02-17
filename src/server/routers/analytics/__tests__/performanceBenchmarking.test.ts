import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockContext,
  createTestCaller,
  createMockUow,
  mockUser,
} from "../../../__tests__/test-utils";
import type { UnitOfWork } from "../../../repositories/unit-of-work";

// Shared reference for the mock UoW instance
let currentMockUow: UnitOfWork;

// Mock UnitOfWork so protectedProcedure doesn't overwrite our mock
vi.mock("../../../repositories/unit-of-work", () => ({
  UnitOfWork: class MockUnitOfWork {
    constructor() {
      return currentMockUow;
    }
  },
}));

// Mock the property-analysis service to avoid external dependencies
vi.mock("../../../services/property-analysis", () => ({
  getMockSuburbBenchmark: vi.fn(),
}));

const mockProperties = [
  {
    id: "prop-1",
    userId: "user-1",
    address: "123 Main St",
    suburb: "Richmond",
    state: "VIC",
    purchasePrice: "500000",
    status: "active",
    createdAt: new Date(),
  },
  {
    id: "prop-2",
    userId: "user-1",
    address: "456 Oak Ave",
    suburb: "Fitzroy",
    state: "VIC",
    purchasePrice: "700000",
    status: "active",
    createdAt: new Date(),
  },
];

const mockTransactions = [
  {
    id: "txn-1",
    propertyId: "prop-1",
    category: "rental_income",
    transactionType: "income",
    amount: "25000",
    userId: "user-1",
  },
  {
    id: "txn-2",
    propertyId: "prop-1",
    category: "insurance",
    transactionType: "expense",
    amount: "2000",
    userId: "user-1",
  },
  {
    id: "txn-3",
    propertyId: "prop-2",
    category: "rental_income",
    transactionType: "income",
    amount: "35000",
    userId: "user-1",
  },
  {
    id: "txn-4",
    propertyId: "prop-2",
    category: "council_rates",
    transactionType: "expense",
    amount: "5000",
    userId: "user-1",
  },
];

const mockBenchmarks = [
  {
    id: "bench-1",
    propertyId: "prop-1",
    performanceScore: 72,
    yieldPercentile: 75,
    growthPercentile: 55,
    expensePercentile: 80,
    vacancyPercentile: 55,
    cohortSize: 50,
    cohortDescription: "houses in Richmond VIC",
    suburbBenchmarkId: "sb-1",
    insights: "[]",
    calculatedAt: new Date(),
  },
  {
    id: "bench-2",
    propertyId: "prop-2",
    performanceScore: 45,
    yieldPercentile: 40,
    growthPercentile: 55,
    expensePercentile: 25,
    vacancyPercentile: 55,
    cohortSize: 30,
    cohortDescription: "houses in Fitzroy VIC",
    suburbBenchmarkId: "sb-2",
    insights: "[]",
    calculatedAt: new Date(),
  },
];

function setupCtx(overrides: Record<string, Record<string, unknown>> = {}) {
  const uow = createMockUow({
    property: {
      findByOwner: vi.fn().mockResolvedValue(mockProperties),
    },
    transactions: {
      findAllByOwner: vi.fn().mockResolvedValue(mockTransactions),
    },
    propertyValue: {
      findRecent: vi.fn().mockResolvedValue([]),
    },
    similarProperties: {
      findPerformanceBenchmarksByProperties: vi.fn().mockResolvedValue(mockBenchmarks),
    },
    ...overrides,
  });

  currentMockUow = uow;

  const ctx = createMockContext({ userId: mockUser.id, user: mockUser, uow });
  ctx.db = {
    query: {
      users: { findFirst: vi.fn().mockResolvedValue(mockUser) },
    },
  } as ReturnType<typeof createMockContext>["db"];

  return { ctx, caller: createTestCaller(ctx), uow };
}

describe("performanceBenchmarking.getPortfolioScorecard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty summary for user with no properties", async () => {
    const { caller } = setupCtx({
      property: {
        findByOwner: vi.fn().mockResolvedValue([]),
      },
    });

    const result = await caller.performanceBenchmarking.getPortfolioScorecard();

    expect(result.properties).toEqual([]);
    expect(result.averageScore).toBe(0);
    expect(result.averageGrossYield).toBe(0);
    expect(result.averageNetYield).toBe(0);
    expect(result.totalAnnualCashFlow).toBe(0);
    expect(result.totalAnnualRent).toBe(0);
    expect(result.totalAnnualExpenses).toBe(0);
    expect(result.totalCurrentValue).toBe(0);
  });

  it("returns scorecard entries sorted by performance score descending", async () => {
    const { caller } = setupCtx();

    const result = await caller.performanceBenchmarking.getPortfolioScorecard();

    expect(result.properties).toHaveLength(2);
    // prop-1 has score 72, prop-2 has score 45 => prop-1 should be first
    expect(result.properties[0].propertyId).toBe("prop-1");
    expect(result.properties[0].performanceScore).toBe(72);
    expect(result.properties[1].propertyId).toBe("prop-2");
    expect(result.properties[1].performanceScore).toBe(45);
  });

  it("calculates correct yield metrics per property", async () => {
    const { caller } = setupCtx();

    const result = await caller.performanceBenchmarking.getPortfolioScorecard();

    // prop-1: rent=25000, value=500000 => grossYield = 5.0%
    const prop1 = result.properties.find((p) => p.propertyId === "prop-1");
    expect(prop1).toBeDefined();
    expect(prop1!.grossYield).toBe(5.0);
    expect(prop1!.annualRent).toBe(25000);
    expect(prop1!.annualExpenses).toBe(2000);
    expect(prop1!.annualCashFlow).toBe(23000);

    // prop-2: rent=35000, value=700000 => grossYield = 5.0%
    const prop2 = result.properties.find((p) => p.propertyId === "prop-2");
    expect(prop2).toBeDefined();
    expect(prop2!.grossYield).toBe(5.0);
    expect(prop2!.annualRent).toBe(35000);
    expect(prop2!.annualExpenses).toBe(5000);
    expect(prop2!.annualCashFlow).toBe(30000);
  });

  it("calculates portfolio-level averages and totals", async () => {
    const { caller } = setupCtx();

    const result = await caller.performanceBenchmarking.getPortfolioScorecard();

    // Average score: (72 + 45) / 2 = 58.5 => rounded 59 (Math.round)
    expect(result.averageScore).toBe(59);
    expect(result.totalAnnualRent).toBe(60000);
    expect(result.totalAnnualExpenses).toBe(7000);
    expect(result.totalAnnualCashFlow).toBe(53000);
    expect(result.totalCurrentValue).toBe(1200000);
  });

  it("uses purchase price as current value when no valuations exist", async () => {
    const { caller } = setupCtx();

    const result = await caller.performanceBenchmarking.getPortfolioScorecard();

    // No valuations returned, so should use purchasePrice
    const prop1 = result.properties.find((p) => p.propertyId === "prop-1");
    expect(prop1!.currentValue).toBe(500000);
    expect(prop1!.purchasePrice).toBe(500000);
  });

  it("uses valuation when available", async () => {
    const { caller } = setupCtx({
      propertyValue: {
        findRecent: vi.fn().mockImplementation((propertyId: string) => {
          if (propertyId === "prop-1") {
            return Promise.resolve([{ estimatedValue: "550000" }]);
          }
          return Promise.resolve([]);
        }),
      },
    });

    const result = await caller.performanceBenchmarking.getPortfolioScorecard();

    const prop1 = result.properties.find((p) => p.propertyId === "prop-1");
    expect(prop1!.currentValue).toBe(550000);

    const prop2 = result.properties.find((p) => p.propertyId === "prop-2");
    expect(prop2!.currentValue).toBe(700000); // Falls back to purchasePrice
  });

  it("defaults to score 50 when no benchmark exists for a property", async () => {
    const { caller } = setupCtx({
      similarProperties: {
        findPerformanceBenchmarksByProperties: vi.fn().mockResolvedValue([]),
      },
    });

    const result = await caller.performanceBenchmarking.getPortfolioScorecard();

    expect(result.properties[0].performanceScore).toBe(50);
    expect(result.properties[0].scoreLabel).toBe("Average");
  });

  it("includes correct score labels", async () => {
    const { caller } = setupCtx();

    const result = await caller.performanceBenchmarking.getPortfolioScorecard();

    const prop1 = result.properties.find((p) => p.propertyId === "prop-1");
    expect(prop1!.scoreLabel).toBe("Good"); // score 72

    const prop2 = result.properties.find((p) => p.propertyId === "prop-2");
    expect(prop2!.scoreLabel).toBe("Average"); // score 45
  });

  it("identifies underperforming properties via benchmarks", async () => {
    const { caller } = setupCtx({
      similarProperties: {
        findPerformanceBenchmarksByProperties: vi.fn().mockResolvedValue([
          {
            ...mockBenchmarks[0],
            yieldPercentile: 10, // Below 25 => underperforming
          },
          mockBenchmarks[1],
        ]),
      },
    });

    const result = await caller.performanceBenchmarking.getPortfolioScorecard();

    const prop1 = result.properties.find((p) => p.propertyId === "prop-1");
    expect(prop1!.isUnderperforming).toBe(true);

    const prop2 = result.properties.find((p) => p.propertyId === "prop-2");
    expect(prop2!.isUnderperforming).toBe(false);
  });
});
