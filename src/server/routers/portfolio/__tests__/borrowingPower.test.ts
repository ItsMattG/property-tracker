import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockContext,
  createTestCaller,
  createMockUow,
  mockUser,
} from "../../../__tests__/test-utils";
import type { UnitOfWork } from "../../../repositories/unit-of-work";

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
  } as never;
  return ctx;
}

// --- Default mock data ---

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
  {
    id: "prop-2",
    userId: "user-1",
    address: "20 Demo Ave",
    suburb: "Melbourne",
    state: "VIC",
    postcode: "3000",
    purchasePrice: "700000",
    purchaseDate: "2022-06-01",
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
  {
    id: "loan-2",
    userId: "user-1",
    propertyId: "prop-2",
    lender: "Bank B",
    loanType: "principal_and_interest",
    rateType: "variable",
    originalAmount: "560000",
    currentBalance: "500000",
    interestRate: "6.00",
    repaymentAmount: "1200",
    repaymentFrequency: "fortnightly",
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
  {
    id: "tx-3",
    userId: "user-1",
    propertyId: "prop-2",
    amount: "35000",
    transactionType: "income",
    category: "rental_income",
    date: "2025-06-01",
    description: "Rental income",
  },
  {
    id: "tx-4",
    userId: "user-1",
    propertyId: "prop-2",
    amount: "-5000",
    transactionType: "expense",
    category: "council_rates",
    date: "2025-08-01",
    description: "Council rates",
  },
];

// No valuations — procedure falls back to purchasePrice
const emptyValuesMap = new Map<string, number>();

function defaultUow() {
  return createMockUow({
    portfolio: {
      findProperties: vi.fn().mockResolvedValue(mockProperties),
      getLatestPropertyValues: vi.fn().mockResolvedValue(emptyValuesMap),
      findLoansByProperties: vi.fn().mockResolvedValue(mockLoans),
      findTransactionsInRange: vi.fn().mockResolvedValue(mockTransactions),
    },
  });
}

describe("portfolio.getBorrowingPower", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- Test 1: Empty portfolio ---
  it("returns zeros with hasLoans false for empty portfolio", async () => {
    const uow = createMockUow({
      portfolio: {
        findProperties: vi.fn().mockResolvedValue([]),
      },
    });
    const ctx = createAuthCtxWithUow(uow);
    const caller = createTestCaller(ctx);

    const result = await caller.portfolio.getBorrowingPower();

    expect(result).toEqual({
      totalPortfolioValue: 0,
      totalDebt: 0,
      portfolioLVR: 0,
      usableEquity: 0,
      annualRentalIncome: 0,
      annualExpenses: 0,
      annualRepayments: 0,
      netSurplus: 0,
      debtServiceRatio: null,
      estimatedBorrowingPower: 0,
      weightedAvgRate: 0,
      hasLoans: false,
    });
  });

  // --- Test 2: Properties with no loans ---
  it("returns usableEquity = value * 0.80 when no loans and borrowingPower = usableEquity with positive surplus", async () => {
    const uow = createMockUow({
      portfolio: {
        findProperties: vi.fn().mockResolvedValue(mockProperties),
        getLatestPropertyValues: vi.fn().mockResolvedValue(emptyValuesMap),
        findLoansByProperties: vi.fn().mockResolvedValue([]),
        findTransactionsInRange: vi.fn().mockResolvedValue(mockTransactions),
      },
    });
    const ctx = createAuthCtxWithUow(uow);
    const caller = createTestCaller(ctx);

    const result = await caller.portfolio.getBorrowingPower();

    // totalValue = 500000 + 700000 = 1,200,000
    // usableEquity = max(0, 1200000 * 0.80 - 0) = 960,000
    expect(result.totalPortfolioValue).toBe(1200000);
    expect(result.totalDebt).toBe(0);
    expect(result.usableEquity).toBe(960000);
    expect(result.hasLoans).toBe(false);
    expect(result.weightedAvgRate).toBe(0);
    // surplus = 60000 - 7000 - 0 = 53000 > 0, so borrowingPower = usableEquity
    expect(result.annualRepayments).toBe(0);
    expect(result.netSurplus).toBe(53000);
    expect(result.estimatedBorrowingPower).toBe(960000);
  });

  // --- Test 3: Correct annualization of repayments ---
  it("annualizes repayments: monthly*12, fortnightly*26", async () => {
    const uow = defaultUow();
    const ctx = createAuthCtxWithUow(uow);
    const caller = createTestCaller(ctx);

    const result = await caller.portfolio.getBorrowingPower();

    // loan-1: $2000 monthly * 12 = $24,000
    // loan-2: $1200 fortnightly * 26 = $31,200
    // total = $55,200
    expect(result.annualRepayments).toBe(55200);
  });

  // --- Test 4: Weighted average interest rate ---
  it("calculates weighted average rate by loan balance", async () => {
    const uow = defaultUow();
    const ctx = createAuthCtxWithUow(uow);
    const caller = createTestCaller(ctx);

    const result = await caller.portfolio.getBorrowingPower();

    // (350000 * 5.50 + 500000 * 6.00) / 850000
    // = (1925000 + 3000000) / 850000
    // = 4925000 / 850000
    // ≈ 5.7941...
    expect(result.weightedAvgRate).toBeCloseTo(5.7941, 3);
  });

  // --- Test 5: estimatedBorrowingPower = usableEquity when surplus positive ---
  it("sets estimatedBorrowingPower = usableEquity when surplus is positive", async () => {
    // Override: smaller repayments so surplus is positive
    const smallRepaymentLoans = [
      {
        ...mockLoans[0],
        repaymentAmount: "500",  // monthly * 12 = 6000
        repaymentFrequency: "monthly",
      },
      {
        ...mockLoans[1],
        repaymentAmount: "200",  // fortnightly * 26 = 5200
        repaymentFrequency: "fortnightly",
      },
    ];

    const uow = createMockUow({
      portfolio: {
        findProperties: vi.fn().mockResolvedValue(mockProperties),
        getLatestPropertyValues: vi.fn().mockResolvedValue(emptyValuesMap),
        findLoansByProperties: vi.fn().mockResolvedValue(smallRepaymentLoans),
        findTransactionsInRange: vi.fn().mockResolvedValue(mockTransactions),
      },
    });
    const ctx = createAuthCtxWithUow(uow);
    const caller = createTestCaller(ctx);

    const result = await caller.portfolio.getBorrowingPower();

    // repayments = 6000 + 5200 = 11200
    // surplus = 60000 - 7000 - 11200 = 41800 > 0
    // usableEquity = max(0, 1200000*0.80 - 850000) = 110000
    expect(result.annualRepayments).toBe(11200);
    expect(result.netSurplus).toBe(41800);
    expect(result.usableEquity).toBe(110000);
    expect(result.estimatedBorrowingPower).toBe(110000);
  });

  // --- Test 6: estimatedBorrowingPower = 0 when surplus negative ---
  it("sets estimatedBorrowingPower = 0 when surplus is negative", async () => {
    const uow = defaultUow();
    const ctx = createAuthCtxWithUow(uow);
    const caller = createTestCaller(ctx);

    const result = await caller.portfolio.getBorrowingPower();

    // surplus = 60000 - 7000 - 55200 = -2200 < 0
    expect(result.netSurplus).toBe(-2200);
    expect(result.estimatedBorrowingPower).toBe(0);
  });

  // --- Test 7: DSR null when no rental income ---
  it("returns debtServiceRatio null when no rental income", async () => {
    const expenseOnlyTransactions = mockTransactions.filter(
      (t) => t.transactionType !== "income"
    );

    const uow = createMockUow({
      portfolio: {
        findProperties: vi.fn().mockResolvedValue(mockProperties),
        getLatestPropertyValues: vi.fn().mockResolvedValue(emptyValuesMap),
        findLoansByProperties: vi.fn().mockResolvedValue(mockLoans),
        findTransactionsInRange: vi.fn().mockResolvedValue(expenseOnlyTransactions),
      },
    });
    const ctx = createAuthCtxWithUow(uow);
    const caller = createTestCaller(ctx);

    const result = await caller.portfolio.getBorrowingPower();

    expect(result.annualRentalIncome).toBe(0);
    expect(result.debtServiceRatio).toBeNull();
  });

  // --- Test 8: Usable equity capped at 0 when LVR > 80% ---
  it("caps usableEquity at 0 when LVR exceeds 80%", async () => {
    // High-balance loans that exceed 80% LVR
    const highBalanceLoans = [
      { ...mockLoans[0], currentBalance: "450000" },  // prop-1 worth 500k
      { ...mockLoans[1], currentBalance: "600000" },  // prop-2 worth 700k
    ];
    // totalDebt = 1,050,000, totalValue = 1,200,000
    // 80% of value = 960,000 < 1,050,000
    // usableEquity = max(0, 960000 - 1050000) = max(0, -90000) = 0

    const uow = createMockUow({
      portfolio: {
        findProperties: vi.fn().mockResolvedValue(mockProperties),
        getLatestPropertyValues: vi.fn().mockResolvedValue(emptyValuesMap),
        findLoansByProperties: vi.fn().mockResolvedValue(highBalanceLoans),
        findTransactionsInRange: vi.fn().mockResolvedValue(mockTransactions),
      },
    });
    const ctx = createAuthCtxWithUow(uow);
    const caller = createTestCaller(ctx);

    const result = await caller.portfolio.getBorrowingPower();

    expect(result.usableEquity).toBe(0);
    expect(result.portfolioLVR).toBeCloseTo(87.5, 1);
  });

  // --- Test 9: Capital expenses (stamp_duty) excluded from annualExpenses ---
  it("excludes capital category transactions from annualExpenses", async () => {
    const transactionsWithCapital = [
      ...mockTransactions,
      {
        id: "tx-5",
        userId: "user-1",
        propertyId: "prop-1",
        amount: "-15000",
        transactionType: "expense",
        category: "stamp_duty",
        date: "2025-01-15",
        description: "Stamp duty",
      },
    ];

    const uow = createMockUow({
      portfolio: {
        findProperties: vi.fn().mockResolvedValue(mockProperties),
        getLatestPropertyValues: vi.fn().mockResolvedValue(emptyValuesMap),
        findLoansByProperties: vi.fn().mockResolvedValue(mockLoans),
        findTransactionsInRange: vi.fn().mockResolvedValue(transactionsWithCapital),
      },
    });
    const ctx = createAuthCtxWithUow(uow);
    const caller = createTestCaller(ctx);

    const result = await caller.portfolio.getBorrowingPower();

    // stamp_duty is capital — should be excluded
    // expenses = 2000 + 5000 = 7000 (same as default, stamp_duty excluded)
    expect(result.annualExpenses).toBe(7000);
  });
});
