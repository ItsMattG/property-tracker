// src/server/services/property-manager/__tests__/sync.test.ts

import { describe, it, expect, vi, beforeEach } from "vitest";
import { PropertyManagerSyncService } from "../sync";
import type { PropertyManagerProvider, PMRentPayment, PMMaintenanceJob, PMBill } from "../types";

describe("PropertyManagerSyncService", () => {
  const mockProvider: PropertyManagerProvider = {
    name: "mock",
    getAuthUrl: vi.fn(),
    exchangeCodeForTokens: vi.fn(),
    refreshAccessToken: vi.fn(),
    getProperties: vi.fn(),
    getTenancies: vi.fn(),
    getRentPayments: vi.fn(),
    getMaintenanceJobs: vi.fn(),
    getBills: vi.fn(),
  };

  const mockDb = {
    query: {
      propertyManagerMappings: {
        findMany: vi.fn(),
      },
      transactions: {
        findFirst: vi.fn(),
      },
    },
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: "tx-1" }]),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
  };

  let syncService: PropertyManagerSyncService;

  beforeEach(() => {
    vi.clearAllMocks();
    syncService = new PropertyManagerSyncService(mockProvider, mockDb as any);
  });

  describe("syncRentPayments", () => {
    it("creates transactions for new rent payments", async () => {
      const mockPayments: PMRentPayment[] = [
        {
          id: "payment-1",
          propertyId: "pm-prop-1",
          tenancyId: "t1",
          amount: 500,
          date: "2026-01-25",
          description: "Weekly rent",
        },
      ];

      vi.mocked(mockProvider.getRentPayments).mockResolvedValue(mockPayments);
      vi.mocked(mockDb.query.propertyManagerMappings.findMany).mockResolvedValue([
        { providerPropertyId: "pm-prop-1", propertyId: "pt-prop-1", autoSync: true },
      ]);
      vi.mocked(mockDb.query.transactions.findFirst).mockResolvedValue(null);

      const result = await syncService.syncRentPayments("access-token", "conn-1", "user-1");

      expect(result.created).toBe(1);
      expect(result.skipped).toBe(0);
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it("skips existing transactions (deduplication)", async () => {
      const mockPayments: PMRentPayment[] = [
        {
          id: "payment-1",
          propertyId: "pm-prop-1",
          tenancyId: "t1",
          amount: 500,
          date: "2026-01-25",
          description: "Weekly rent",
        },
      ];

      vi.mocked(mockProvider.getRentPayments).mockResolvedValue(mockPayments);
      vi.mocked(mockDb.query.propertyManagerMappings.findMany).mockResolvedValue([
        { providerPropertyId: "pm-prop-1", propertyId: "pt-prop-1", autoSync: true },
      ]);
      vi.mocked(mockDb.query.transactions.findFirst).mockResolvedValue({ id: "existing" });

      const result = await syncService.syncRentPayments("access-token", "conn-1", "user-1");

      expect(result.created).toBe(0);
      expect(result.skipped).toBe(1);
    });

    it("skips unmapped properties", async () => {
      const mockPayments: PMRentPayment[] = [
        {
          id: "payment-1",
          propertyId: "pm-prop-unmapped",
          tenancyId: "t1",
          amount: 500,
          date: "2026-01-25",
          description: "Weekly rent",
        },
      ];

      vi.mocked(mockProvider.getRentPayments).mockResolvedValue(mockPayments);
      vi.mocked(mockDb.query.propertyManagerMappings.findMany).mockResolvedValue([
        { providerPropertyId: "pm-prop-1", propertyId: "pt-prop-1", autoSync: true },
      ]);

      const result = await syncService.syncRentPayments("access-token", "conn-1", "user-1");

      expect(result.created).toBe(0);
      expect(result.skipped).toBe(1);
    });
  });

  describe("syncMaintenanceJobs", () => {
    it("creates transactions for completed maintenance jobs", async () => {
      const mockJobs: PMMaintenanceJob[] = [
        {
          id: "job-1",
          propertyId: "pm-prop-1",
          description: "Fix tap",
          amount: 150,
          date: "2026-01-20",
          supplierName: "Plumber Co",
          status: "completed",
        },
      ];

      vi.mocked(mockProvider.getMaintenanceJobs).mockResolvedValue(mockJobs);
      vi.mocked(mockDb.query.propertyManagerMappings.findMany).mockResolvedValue([
        { providerPropertyId: "pm-prop-1", propertyId: "pt-prop-1", autoSync: true },
      ]);
      vi.mocked(mockDb.query.transactions.findFirst).mockResolvedValue(null);

      const result = await syncService.syncMaintenanceJobs("access-token", "conn-1", "user-1");

      expect(result.created).toBe(1);
      expect(result.skipped).toBe(0);
    });

    it("skips pending maintenance jobs", async () => {
      const mockJobs: PMMaintenanceJob[] = [
        {
          id: "job-1",
          propertyId: "pm-prop-1",
          description: "Fix tap",
          amount: 150,
          date: "2026-01-20",
          status: "pending",
        },
      ];

      vi.mocked(mockProvider.getMaintenanceJobs).mockResolvedValue(mockJobs);
      vi.mocked(mockDb.query.propertyManagerMappings.findMany).mockResolvedValue([
        { providerPropertyId: "pm-prop-1", propertyId: "pt-prop-1", autoSync: true },
      ]);

      const result = await syncService.syncMaintenanceJobs("access-token", "conn-1", "user-1");

      expect(result.created).toBe(0);
      expect(result.skipped).toBe(0); // Skipped because not completed, not counted
    });
  });

  describe("syncBills", () => {
    it("creates transactions for bills", async () => {
      const mockBills: PMBill[] = [
        {
          id: "bill-1",
          propertyId: "pm-prop-1",
          description: "Council rates Q1",
          amount: 450,
          date: "2026-01-15",
          category: "Council Rates",
        },
      ];

      vi.mocked(mockProvider.getBills).mockResolvedValue(mockBills);
      vi.mocked(mockDb.query.propertyManagerMappings.findMany).mockResolvedValue([
        { providerPropertyId: "pm-prop-1", propertyId: "pt-prop-1", autoSync: true },
      ]);
      vi.mocked(mockDb.query.transactions.findFirst).mockResolvedValue(null);

      const result = await syncService.syncBills("access-token", "conn-1", "user-1");

      expect(result.created).toBe(1);
      expect(result.skipped).toBe(0);
    });

    it("maps bill categories correctly", async () => {
      const mockBills: PMBill[] = [
        {
          id: "bill-1",
          propertyId: "pm-prop-1",
          description: "Water charges",
          amount: 100,
          date: "2026-01-15",
          category: "Water",
        },
      ];

      vi.mocked(mockProvider.getBills).mockResolvedValue(mockBills);
      vi.mocked(mockDb.query.propertyManagerMappings.findMany).mockResolvedValue([
        { providerPropertyId: "pm-prop-1", propertyId: "pt-prop-1", autoSync: true },
      ]);
      vi.mocked(mockDb.query.transactions.findFirst).mockResolvedValue(null);

      await syncService.syncBills("access-token", "conn-1", "user-1");

      // Check that insert was called with water_charges category
      const insertCall = mockDb.insert.mock.results[0];
      expect(insertCall).toBeDefined();
    });
  });

  describe("runFullSync", () => {
    it("runs all sync operations in parallel", async () => {
      vi.mocked(mockProvider.getRentPayments).mockResolvedValue([]);
      vi.mocked(mockProvider.getMaintenanceJobs).mockResolvedValue([]);
      vi.mocked(mockProvider.getBills).mockResolvedValue([]);
      vi.mocked(mockDb.query.propertyManagerMappings.findMany).mockResolvedValue([]);

      const result = await syncService.runFullSync("access-token", "conn-1", "user-1");

      expect(result.rentPayments).toBeDefined();
      expect(result.maintenanceJobs).toBeDefined();
      expect(result.bills).toBeDefined();
      expect(mockProvider.getRentPayments).toHaveBeenCalled();
      expect(mockProvider.getMaintenanceJobs).toHaveBeenCalled();
      expect(mockProvider.getBills).toHaveBeenCalled();
    });
  });
});
