import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockContext,
  createTestCaller,
  createMockUow,
  mockUser,
} from "../../../__tests__/test-utils";
import type { UnitOfWork } from "../../../repositories/unit-of-work";
import { basiqService } from "../../../services/banking";

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

// Mock banking services
vi.mock("../../../services/banking", () => ({
  checkRateLimit: vi.fn().mockReturnValue({ allowed: true }),
  basiqService: {
    refreshConnection: vi.fn().mockResolvedValue(undefined),
    getTransactions: vi.fn().mockResolvedValue({ data: [] }),
  },
  batchCategorize: vi.fn().mockResolvedValue(undefined),
  detectUnusualAmount: vi.fn().mockReturnValue(null),
  detectDuplicates: vi.fn().mockReturnValue(null),
  detectUnexpectedExpense: vi.fn().mockReturnValue(null),
  getHistoricalAverage: vi.fn().mockResolvedValue(null),
  getKnownMerchants: vi.fn().mockResolvedValue([]),
  mapBasiqErrorToAlertType: vi.fn().mockReturnValue("connection_error"),
  mapAlertTypeToConnectionStatus: vi.fn().mockReturnValue("error"),
  shouldCreateAlert: vi.fn().mockReturnValue(false),
}));

// Mock metrics, axiom, and logger
vi.mock("@/lib/metrics", () => ({
  metrics: {
    bankSyncSuccess: vi.fn(),
    bankSyncFailed: vi.fn(),
  },
}));

vi.mock("@/lib/axiom", () => ({
  axiomMetrics: {
    timing: vi.fn(),
    increment: vi.fn(),
  },
  flushAxiom: vi.fn().mockResolvedValue(undefined),
  ingestLog: vi.fn(),
  withAxiomTiming: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn().mockReturnValue({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
  setLogContext: vi.fn(),
  clearLogContext: vi.fn(),
  getLogContext: vi.fn().mockReturnValue({}),
}));

const ACCOUNT_ID = "550e8400-e29b-41d4-a716-446655440000";
const PROPERTY_ID = "660e8400-e29b-41d4-a716-446655440001";

const mockAccount = {
  id: ACCOUNT_ID,
  userId: mockUser.id,
  basiqConnectionId: "conn-1",
  basiqAccountId: "basiq-acct-1",
  defaultPropertyId: PROPERTY_ID,
  lastManualSyncAt: null,
  lastSyncedAt: null,
  institution: "Test Bank",
  connectionStatus: "connected",
  lastSyncStatus: null,
};

const basiqTransactions = [
  { id: "basiq-txn-1", postDate: "2026-01-15", description: "Rent Payment", amount: "1500.00", direction: "credit" as const },
  { id: "basiq-txn-2", postDate: "2026-01-16", description: "Water Bill", amount: "120.00", direction: "debit" as const },
  { id: "basiq-txn-3", postDate: "2026-01-17", description: "Insurance", amount: "200.00", direction: "debit" as const },
];

function setupCtx(overrides: Record<string, Record<string, unknown>> = {}) {
  const uow = createMockUow({
    bankAccount: {
      findById: vi.fn().mockResolvedValue(mockAccount),
      update: vi.fn().mockResolvedValue(mockAccount),
      resolveAlertsByAccount: vi.fn().mockResolvedValue(undefined),
      createAnomalyAlerts: vi.fn().mockResolvedValue(undefined),
      findActiveAlertsByAccount: vi.fn().mockResolvedValue([]),
      createAlert: vi.fn().mockResolvedValue(undefined),
    },
    transactions: {
      createMany: vi.fn().mockResolvedValue([{ id: "txn-1" }, { id: "txn-2" }, { id: "txn-3" }]),
      create: vi.fn().mockResolvedValue({ id: "txn-new" }),
      findRecentByAccount: vi.fn().mockResolvedValue([]),
      findUncategorizedByAccount: vi.fn().mockResolvedValue([]),
    },
    user: {
      findById: vi.fn().mockResolvedValue({ ...mockUser, basiqUserId: "basiq-user-1" }),
      findSubscriptionFull: vi.fn().mockResolvedValue(null),
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

describe("banking syncAccount — batch transaction insert", () => {
  const mockedBasiqService = vi.mocked(basiqService);

  beforeEach(() => {
    vi.clearAllMocks();

    // Re-configure basiqService mock for each test to return transactions
    mockedBasiqService.getTransactions.mockResolvedValue({
      data: basiqTransactions,
    } as never);
  });

  it("batch inserts all transactions via createMany on happy path", async () => {
    const { caller, uow } = setupCtx();

    const result = await caller.banking.syncAccount({ accountId: ACCOUNT_ID });

    expect(result.success).toBe(true);
    expect(result.transactionsAdded).toBe(3);

    // createMany should be called once with all transactions
    expect(uow.transactions.createMany).toHaveBeenCalledTimes(1);
    expect(uow.transactions.createMany).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          userId: mockUser.id,
          bankAccountId: ACCOUNT_ID,
          basiqTransactionId: "basiq-txn-1",
          propertyId: PROPERTY_ID,
          amount: "1500.00",
          transactionType: "income",
        }),
        expect.objectContaining({
          basiqTransactionId: "basiq-txn-2",
          amount: "-120.00",
          transactionType: "expense",
        }),
        expect.objectContaining({
          basiqTransactionId: "basiq-txn-3",
          amount: "-200.00",
          transactionType: "expense",
        }),
      ])
    );

    // Individual create should NOT be called
    expect(uow.transactions.create).not.toHaveBeenCalled();
  });

  it("falls back to individual inserts when createMany throws duplicate key error (23505)", async () => {
    const duplicateError = Object.assign(new Error("duplicate key value"), { code: "23505" });

    const { caller, uow } = setupCtx({
      transactions: {
        createMany: vi.fn().mockRejectedValue(duplicateError),
        create: vi.fn().mockResolvedValue({ id: "txn-individual" }),
        findRecentByAccount: vi.fn().mockResolvedValue([]),
        findUncategorizedByAccount: vi.fn().mockResolvedValue([]),
      },
    });

    const result = await caller.banking.syncAccount({ accountId: ACCOUNT_ID });

    expect(result.success).toBe(true);
    // All 3 individual inserts should succeed
    expect(result.transactionsAdded).toBe(3);

    // createMany was attempted first
    expect(uow.transactions.createMany).toHaveBeenCalledTimes(1);

    // Fallback: individual create called once per transaction
    expect(uow.transactions.create).toHaveBeenCalledTimes(3);
  });

  it("skips individual duplicates during fallback without failing", async () => {
    const batchDuplicateError = Object.assign(new Error("duplicate key value"), { code: "23505" });
    const individualDuplicateError = Object.assign(new Error("duplicate key value"), { code: "23505" });

    const createMock = vi.fn()
      .mockResolvedValueOnce({ id: "txn-1" })        // first succeeds
      .mockRejectedValueOnce(individualDuplicateError) // second is duplicate
      .mockResolvedValueOnce({ id: "txn-3" });        // third succeeds

    const { caller, uow } = setupCtx({
      transactions: {
        createMany: vi.fn().mockRejectedValue(batchDuplicateError),
        create: createMock,
        findRecentByAccount: vi.fn().mockResolvedValue([]),
        findUncategorizedByAccount: vi.fn().mockResolvedValue([]),
      },
    });

    const result = await caller.banking.syncAccount({ accountId: ACCOUNT_ID });

    expect(result.success).toBe(true);
    // Only 2 counted (the duplicate was skipped)
    expect(result.transactionsAdded).toBe(2);
    expect(uow.transactions.create).toHaveBeenCalledTimes(3);
  });

  it("re-throws non-duplicate errors from createMany", async () => {
    const connectionError = new Error("connection refused");

    const { caller, uow } = setupCtx({
      transactions: {
        createMany: vi.fn().mockRejectedValue(connectionError),
        create: vi.fn(),
        findRecentByAccount: vi.fn().mockResolvedValue([]),
        findUncategorizedByAccount: vi.fn().mockResolvedValue([]),
      },
    });

    // The error propagates and is caught by the outer try/catch in syncAccount,
    // which wraps it in a TRPCError INTERNAL_SERVER_ERROR
    await expect(
      caller.banking.syncAccount({ accountId: ACCOUNT_ID })
    ).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      message: expect.stringContaining("connection refused"),
    });

    // createMany was attempted but individual create was NOT (not a duplicate error)
    expect(uow.transactions.createMany).toHaveBeenCalledTimes(1);
    expect(uow.transactions.create).not.toHaveBeenCalled();
  });

  it("re-throws non-duplicate errors during individual fallback inserts", async () => {
    const batchDuplicateError = Object.assign(new Error("duplicate key value"), { code: "23505" });
    const connectionError = new Error("connection lost mid-insert");

    const createMock = vi.fn()
      .mockResolvedValueOnce({ id: "txn-1" })   // first succeeds
      .mockRejectedValueOnce(connectionError);    // second fails with non-duplicate

    const { caller, uow } = setupCtx({
      transactions: {
        createMany: vi.fn().mockRejectedValue(batchDuplicateError),
        create: createMock,
        findRecentByAccount: vi.fn().mockResolvedValue([]),
        findUncategorizedByAccount: vi.fn().mockResolvedValue([]),
      },
    });

    await expect(
      caller.banking.syncAccount({ accountId: ACCOUNT_ID })
    ).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      message: expect.stringContaining("connection lost mid-insert"),
    });

    // Fallback started but stopped at the connection error
    expect(uow.transactions.create).toHaveBeenCalledTimes(2);
  });
});
