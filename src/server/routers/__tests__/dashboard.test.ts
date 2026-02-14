import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockContext, createTestCaller, mockUser } from "../../__tests__/test-utils";

// Mock the portfolio-helpers module before importing anything that uses it
vi.mock("../portfolio-helpers", () => ({
  getLatestPropertyValues: vi.fn(),
}));

import { getLatestPropertyValues } from "../portfolio-helpers";
const mockGetLatestPropertyValues = vi.mocked(getLatestPropertyValues);

/** Drizzle uses Symbol.for("drizzle:Name") to store table names */
const DRIZZLE_NAME = Symbol.for("drizzle:Name");

describe("dashboard.getInitialData", () => {
  const lastYear = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);

  const testProperties = [
    {
      id: "prop-1",
      userId: "user-1",
      address: "123 Main St",
      createdAt: lastYear,
      purchasePrice: "500000",
      status: "active",
    },
    {
      id: "prop-2",
      userId: "user-1",
      address: "456 Oak Ave",
      createdAt: lastYear,
      purchasePrice: "600000",
      status: "active",
    },
  ];

  const defaultOnboarding = {
    id: "onb-1",
    userId: "user-1",
    wizardDismissedAt: new Date(),
    checklistDismissedAt: new Date(),
    completedTours: [],
    toursDisabled: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Build a fully-mocked db object.
   *
   * Uses the Drizzle table symbol to route `db.select().from(table).where()`
   * to the appropriate mock data based on the table being queried.
   */
  function buildMockDb(opts: {
    activeProperties?: any[];
    propertiesFindMany?: any[];
    onboarding?: any;
    debtTotal?: string;
  }) {
    const activeProps = opts.activeProperties ?? testProperties;
    const debtTotal = opts.debtTotal ?? "0";

    const selectFn = vi.fn().mockImplementation(() => ({
      from: vi.fn().mockImplementation((table: any) => {
        const tableName = table?.[DRIZZLE_NAME] ?? "";

        if (tableName === "properties") {
          return { where: vi.fn().mockResolvedValue(activeProps) };
        }

        if (tableName === "loans") {
          return { where: vi.fn().mockResolvedValue([{ total: debtTotal }]) };
        }

        // All other tables (transactions, bank_accounts, etc.) return count rows
        return { where: vi.fn().mockResolvedValue([{ count: 0 }]) };
      }),
    }));

    return {
      select: selectFn,
      query: {
        users: {
          findFirst: vi.fn().mockResolvedValue(mockUser),
        },
        connectionAlerts: {
          findMany: vi.fn().mockResolvedValue([]),
        },
        userOnboarding: {
          findFirst: vi.fn().mockResolvedValue(opts.onboarding ?? defaultOnboarding),
        },
        properties: {
          findMany: vi.fn().mockResolvedValue(opts.propertiesFindMany ?? testProperties),
        },
      },
    };
  }

  it("returns correct portfolio value from DISTINCT ON results", async () => {
    const db = buildMockDb({});

    mockGetLatestPropertyValues
      .mockResolvedValueOnce(new Map([["prop-1", 650000], ["prop-2", 700000]]))
      .mockResolvedValueOnce(new Map([["prop-1", 640000], ["prop-2", 690000]]));

    const ctx = createMockContext({ userId: "user-1", user: mockUser });
    ctx.db = db as any;
    const caller = createTestCaller(ctx);
    const result = await caller.dashboard.getInitialData();

    expect(result.trends.portfolioValue.current).toBe(1350000);
    expect(result.trends.portfolioValue.previous).toBe(1330000);
    expect(mockGetLatestPropertyValues).toHaveBeenCalledTimes(2);
  });

  it("falls back to purchasePrice when no valuation exists for a property", async () => {
    const db = buildMockDb({});

    // Only prop-1 has a valuation; prop-2 is missing from the map
    mockGetLatestPropertyValues
      .mockResolvedValueOnce(new Map([["prop-1", 650000]]))
      .mockResolvedValueOnce(new Map([["prop-1", 640000]]));

    const ctx = createMockContext({ userId: "user-1", user: mockUser });
    ctx.db = db as any;
    const caller = createTestCaller(ctx);
    const result = await caller.dashboard.getInitialData();

    // prop-1 = 650k (valuation), prop-2 = 600k (purchasePrice fallback)
    expect(result.trends.portfolioValue.current).toBe(1250000);
    // Previous: prop-1 = 640k, prop-2 = 600k (fallback)
    expect(result.trends.portfolioValue.previous).toBe(1240000);
  });

  it("returns null previous when all properties created this month", async () => {
    const thisMonthProperties = testProperties.map((p) => ({
      ...p,
      createdAt: new Date(), // created this month
    }));

    const db = buildMockDb({
      activeProperties: thisMonthProperties,
      propertiesFindMany: thisMonthProperties,
    });

    mockGetLatestPropertyValues
      .mockResolvedValueOnce(new Map([["prop-1", 650000], ["prop-2", 700000]]))
      .mockResolvedValueOnce(new Map());

    const ctx = createMockContext({ userId: "user-1", user: mockUser });
    ctx.db = db as any;
    const caller = createTestCaller(ctx);
    const result = await caller.dashboard.getInitialData();

    expect(result.trends.portfolioValue.current).toBe(1350000);
    expect(result.trends.portfolioValue.previous).toBeNull();
  });

  it("calculates equity as portfolioValue minus debt", async () => {
    const db = buildMockDb({ debtTotal: "500000" });

    mockGetLatestPropertyValues
      .mockResolvedValueOnce(new Map([["prop-1", 650000], ["prop-2", 700000]]))
      .mockResolvedValueOnce(new Map([["prop-1", 640000], ["prop-2", 690000]]));

    const ctx = createMockContext({ userId: "user-1", user: mockUser });
    ctx.db = db as any;
    const caller = createTestCaller(ctx);
    const result = await caller.dashboard.getInitialData();

    expect(result.trends.totalEquity.current).toBe(850000);
    expect(result.trends.totalEquity.previous).toBe(830000);
  });

  it("handles empty property list", async () => {
    const db = buildMockDb({
      activeProperties: [],
      propertiesFindMany: [],
    });

    const ctx = createMockContext({ userId: "user-1", user: mockUser });
    ctx.db = db as any;
    const caller = createTestCaller(ctx);
    const result = await caller.dashboard.getInitialData();

    expect(result.trends.portfolioValue.current).toBe(0);
    expect(result.trends.portfolioValue.previous).toBeNull();
    expect(result.trends.totalEquity.current).toBe(0);
    expect(result.trends.totalEquity.previous).toBeNull();
    expect(mockGetLatestPropertyValues).not.toHaveBeenCalled();
  });
});
