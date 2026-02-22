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

// Mock the PropertyMe provider
vi.mock("../../../services/property-manager/propertyme", () => ({
  getPropertyMeProvider: vi.fn().mockReturnValue({
    getProperties: vi.fn(),
  }),
}));

// Mock encryption
vi.mock("@/lib/encryption", () => ({
  decrypt: vi.fn((val: string) => `decrypted-${val}`),
}));

import { getPropertyMeProvider } from "../../../services/property-manager/propertyme";

const CONNECTION_ID = "550e8400-e29b-41d4-a716-446655440000";

const mockConnection = {
  id: CONNECTION_ID,
  userId: mockUser.id,
  provider: "propertyme" as const,
  status: "active" as const,
  accessToken: "encrypted-token",
  refreshToken: "encrypted-refresh",
  lastSyncAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  providerUserId: "pm-user-1",
  tokenExpiresAt: new Date(Date.now() + 3600_000),
};

const providerProperties = [
  { id: "pm-prop-1", address: "1 Test St, Sydney NSW 2000", status: "active" },
  { id: "pm-prop-2", address: "2 Test Ave, Melbourne VIC 3000", status: "active" },
  { id: "pm-prop-3", address: "3 Test Rd, Brisbane QLD 4000", status: "active" },
];

function setupCtx(overrides: Record<string, Record<string, unknown>> = {}) {
  const uow = createMockUow({
    propertyManager: {
      findById: vi.fn().mockResolvedValue(mockConnection),
      findMappingsByConnection: vi.fn().mockResolvedValue([]),
      createMappings: vi.fn().mockResolvedValue(
        providerProperties.map((p) => ({
          id: `mapping-${p.id}`,
          connectionId: CONNECTION_ID,
          providerPropertyId: p.id,
          providerPropertyAddress: p.address,
          propertyId: null,
          autoSync: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        }))
      ),
      ...overrides.propertyManager,
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

describe("propertyManager.fetchProviderProperties — batch mapping insert", () => {
  const mockedProvider = vi.mocked(getPropertyMeProvider);

  beforeEach(() => {
    vi.clearAllMocks();
    mockedProvider.mockReturnValue({
      getProperties: vi.fn().mockResolvedValue(providerProperties),
    } as never);
  });

  it("batch-inserts all new mappings when none exist yet", async () => {
    const { caller, uow } = setupCtx();

    const result = await caller.propertyManager.fetchProviderProperties({
      connectionId: CONNECTION_ID,
    });

    expect(result.count).toBe(3);

    // Should fetch existing mappings in a single query
    expect(uow.propertyManager.findMappingsByConnection).toHaveBeenCalledTimes(1);
    expect(uow.propertyManager.findMappingsByConnection).toHaveBeenCalledWith(CONNECTION_ID);

    // Should batch-insert all 3 new mappings in a single query
    expect(uow.propertyManager.createMappings).toHaveBeenCalledTimes(1);
    expect(uow.propertyManager.createMappings).toHaveBeenCalledWith([
      { connectionId: CONNECTION_ID, providerPropertyId: "pm-prop-1", providerPropertyAddress: "1 Test St, Sydney NSW 2000" },
      { connectionId: CONNECTION_ID, providerPropertyId: "pm-prop-2", providerPropertyAddress: "2 Test Ave, Melbourne VIC 3000" },
      { connectionId: CONNECTION_ID, providerPropertyId: "pm-prop-3", providerPropertyAddress: "3 Test Rd, Brisbane QLD 4000" },
    ]);

    // Old N+1 methods should NOT be called
    expect(uow.propertyManager.findMappingByProvider).not.toHaveBeenCalled();
    expect(uow.propertyManager.createMapping).not.toHaveBeenCalled();
  });

  it("skips insert when all mappings already exist", async () => {
    const existingMappings = providerProperties.map((p) => ({
      id: `mapping-${p.id}`,
      connectionId: CONNECTION_ID,
      providerPropertyId: p.id,
      providerPropertyAddress: p.address,
      propertyId: null,
      autoSync: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    const { caller, uow } = setupCtx({
      propertyManager: {
        findById: vi.fn().mockResolvedValue(mockConnection),
        findMappingsByConnection: vi.fn().mockResolvedValue(existingMappings),
        createMappings: vi.fn(),
      },
    });

    const result = await caller.propertyManager.fetchProviderProperties({
      connectionId: CONNECTION_ID,
    });

    expect(result.count).toBe(3);

    // Should still fetch existing mappings
    expect(uow.propertyManager.findMappingsByConnection).toHaveBeenCalledTimes(1);

    // Should NOT call createMappings (all already exist)
    expect(uow.propertyManager.createMappings).not.toHaveBeenCalled();
  });

  it("only inserts mappings for new provider properties (partial overlap)", async () => {
    // Only pm-prop-1 already exists
    const existingMappings = [
      {
        id: "mapping-pm-prop-1",
        connectionId: CONNECTION_ID,
        providerPropertyId: "pm-prop-1",
        providerPropertyAddress: "1 Test St, Sydney NSW 2000",
        propertyId: null,
        autoSync: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const { caller, uow } = setupCtx({
      propertyManager: {
        findById: vi.fn().mockResolvedValue(mockConnection),
        findMappingsByConnection: vi.fn().mockResolvedValue(existingMappings),
        createMappings: vi.fn().mockResolvedValue([]),
      },
    });

    const result = await caller.propertyManager.fetchProviderProperties({
      connectionId: CONNECTION_ID,
    });

    expect(result.count).toBe(3);

    // Should batch-insert only the 2 new mappings
    expect(uow.propertyManager.createMappings).toHaveBeenCalledTimes(1);
    expect(uow.propertyManager.createMappings).toHaveBeenCalledWith([
      { connectionId: CONNECTION_ID, providerPropertyId: "pm-prop-2", providerPropertyAddress: "2 Test Ave, Melbourne VIC 3000" },
      { connectionId: CONNECTION_ID, providerPropertyId: "pm-prop-3", providerPropertyAddress: "3 Test Rd, Brisbane QLD 4000" },
    ]);
  });

  it("handles empty provider properties list", async () => {
    mockedProvider.mockReturnValue({
      getProperties: vi.fn().mockResolvedValue([]),
    } as never);

    const { caller, uow } = setupCtx();

    const result = await caller.propertyManager.fetchProviderProperties({
      connectionId: CONNECTION_ID,
    });

    expect(result.count).toBe(0);

    // Should still fetch existing mappings (it runs before the filter)
    expect(uow.propertyManager.findMappingsByConnection).toHaveBeenCalledTimes(1);

    // No new mappings to insert
    expect(uow.propertyManager.createMappings).not.toHaveBeenCalled();
  });

  it("throws NOT_FOUND when connection does not exist", async () => {
    const { caller } = setupCtx({
      propertyManager: {
        findById: vi.fn().mockResolvedValue(null),
      },
    });

    await expect(
      caller.propertyManager.fetchProviderProperties({ connectionId: CONNECTION_ID })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Connection not found",
    });
  });
});
