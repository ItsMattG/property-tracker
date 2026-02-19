import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockContext,
  createTestCaller,
  createMockUow,
  mockUser,
} from "../../../__tests__/test-utils";
import type { UnitOfWork } from "../../../repositories/unit-of-work";
import type { PortfolioInsightRow } from "../../../db/schema";

// Shared reference for the mock UoW instance to be returned by the UnitOfWork constructor
let currentMockUow: UnitOfWork;

// Mock UnitOfWork so protectedProcedure doesn't overwrite our mock UoW
vi.mock("../../../repositories/unit-of-work", () => ({
  UnitOfWork: class MockUnitOfWork {
    constructor() {
      return currentMockUow;
    }
  },
}));

// Mock the AI insight generator service
vi.mock("../../../services/ai/insight-generator", () => ({
  generatePortfolioInsights: vi.fn(),
}));

/**
 * Create an authenticated mock context with UoW.
 * Sets up ctx.db.query.users.findFirst so the protectedProcedure
 * middleware resolves the user before reaching the router handler.
 */
function createAuthCtxWithUow(uow: UnitOfWork) {
  currentMockUow = uow;
  const ctx = createMockContext({
    userId: mockUser.id,
    user: mockUser,
    uow,
  });
  ctx.db = {
    query: {
      users: {
        findFirst: vi.fn().mockResolvedValue(mockUser),
      },
    },
  } as ReturnType<typeof createMockContext>["db"];
  return ctx;
}

// --- Mock data ---

const mockInsights = [
  {
    propertyId: "prop-1",
    category: "yield" as const,
    severity: "positive" as const,
    title: "Strong rental yield",
    body: "Your property at 10 Test St has a gross yield of 5.2%.",
  },
  {
    propertyId: null,
    category: "concentration" as const,
    severity: "warning" as const,
    title: "Geographic concentration risk",
    body: "100% of your portfolio is in NSW. Consider diversifying.",
  },
];

const freshInsightRow: PortfolioInsightRow = {
  id: "insight-1",
  userId: "user-1",
  insights: mockInsights,
  generatedAt: new Date(),
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h from now
  modelUsed: "claude-3-5-haiku-20241022",
  inputTokens: 500,
  outputTokens: 200,
  createdAt: new Date(),
};

const mockProperties = [
  {
    id: "prop-1",
    userId: "user-1",
    address: "10 Test St",
    suburb: "Sydney",
    state: "NSW",
    postcode: "2000",
    purchasePrice: "500000",
    purchaseDate: "2022-01-01",
    entityName: "Personal",
    status: "active",
  },
];

const mockLoans = [
  {
    id: "loan-1",
    userId: "user-1",
    propertyId: "prop-1",
    lender: "Bank A",
    loanType: "principal_and_interest",
    rateType: "variable",
    originalAmount: "400000",
    currentBalance: "350000",
    interestRate: "5.50",
    repaymentAmount: "2000",
    repaymentFrequency: "monthly",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const mockTransactions = [
  {
    id: "tx-1",
    userId: "user-1",
    propertyId: "prop-1",
    amount: "25000",
    transactionType: "income",
    category: "rental_income",
    date: "2025-06-01",
    description: "Rental income",
  },
  {
    id: "tx-2",
    userId: "user-1",
    propertyId: "prop-1",
    amount: "-2000",
    transactionType: "expense",
    category: "insurance",
    date: "2025-07-01",
    description: "Insurance",
  },
];

describe("portfolio.getInsights", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns cached insights when fresh", async () => {
    const uow = createMockUow({
      insights: {
        findFreshByUser: vi.fn().mockResolvedValue(freshInsightRow),
      },
    });
    const ctx = createAuthCtxWithUow(uow);
    const caller = createTestCaller(ctx);

    const result = await caller.portfolio.getInsights();

    expect(result.stale).toBe(false);
    expect(result.insights).toEqual(mockInsights);
    expect(result.generatedAt).toEqual(freshInsightRow.generatedAt);
  });

  it("returns stale flag when no cached insights", async () => {
    const uow = createMockUow({
      insights: {
        findFreshByUser: vi.fn().mockResolvedValue(null),
      },
    });
    const ctx = createAuthCtxWithUow(uow);
    const caller = createTestCaller(ctx);

    const result = await caller.portfolio.getInsights();

    expect(result.stale).toBe(true);
    expect(result.insights).toBeNull();
    expect(result.generatedAt).toBeNull();
  });
});

describe("portfolio.generateInsights", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generates insights and caches result", async () => {
    const { generatePortfolioInsights } = await import(
      "../../../services/ai/insight-generator"
    );
    const mockGenerate = vi.mocked(generatePortfolioInsights);
    mockGenerate.mockResolvedValue({
      insights: mockInsights,
      modelUsed: "claude-3-5-haiku-20241022",
      inputTokens: 500,
      outputTokens: 200,
    });

    const uow = createMockUow({
      insights: {
        findFreshByUser: vi.fn().mockResolvedValue(null),
        upsert: vi.fn().mockResolvedValue(freshInsightRow),
      },
      portfolio: {
        findProperties: vi.fn().mockResolvedValue(mockProperties),
        getLatestPropertyValues: vi
          .fn()
          .mockResolvedValue(new Map([["prop-1", 550000]])),
        findLoansByProperties: vi.fn().mockResolvedValue(mockLoans),
        findTransactionsInRange: vi.fn().mockResolvedValue(mockTransactions),
      },
    });
    const ctx = createAuthCtxWithUow(uow);
    const caller = createTestCaller(ctx);

    const result = await caller.portfolio.generateInsights();

    expect(result.insights).toEqual(mockInsights);
    expect(result.generatedAt).toBeDefined();
    expect(mockGenerate).toHaveBeenCalledOnce();
    expect(uow.insights.upsert).toHaveBeenCalledOnce();
  });

  it("rate-limits to 1 generation per hour", async () => {
    const recentInsightRow: PortfolioInsightRow = {
      ...freshInsightRow,
      generatedAt: new Date(), // just generated
    };

    const uow = createMockUow({
      insights: {
        findFreshByUser: vi.fn().mockResolvedValue(recentInsightRow),
      },
    });
    const ctx = createAuthCtxWithUow(uow);
    const caller = createTestCaller(ctx);

    await expect(caller.portfolio.generateInsights()).rejects.toThrow(
      "Insights were generated recently"
    );
  });
});
