import { describe, it, expect, vi } from "vitest";
import { createMockUow } from "../../__tests__/test-utils";

describe("DepreciationRepository (via UoW mock)", () => {
  it("findSchedulesByProperty returns schedules with nested assets and claims", async () => {
    const mockSchedule = {
      id: "s1",
      propertyId: "p1",
      userId: "u1",
      effectiveDate: "2025-07-01",
      totalValue: "50000.00",
      createdAt: new Date(),
      documentId: null,
      assets: [
        {
          id: "a1",
          scheduleId: "s1",
          assetName: "Carpet",
          category: "plant_equipment" as const,
          originalCost: "3000.00",
          effectiveLife: "8.00",
          method: "diminishing_value" as const,
          purchaseDate: null,
          poolType: "individual" as const,
          openingWrittenDownValue: null,
          yearlyDeduction: "375.00",
          remainingValue: "2625.00",
          createdAt: new Date(),
          claims: [],
        },
      ],
    };

    const uow = createMockUow({
      depreciation: {
        findSchedulesByProperty: vi.fn().mockResolvedValue([mockSchedule]),
      },
    });

    const result = await uow.depreciation.findSchedulesByProperty("p1", "u1");
    expect(result).toHaveLength(1);
    expect(result[0].assets[0].assetName).toBe("Carpet");
    expect(result[0].assets[0].claims).toEqual([]);
  });

  it("findAssetById returns asset when owned, null otherwise", async () => {
    const mockAsset = {
      id: "a1",
      scheduleId: "s1",
      assetName: "Hot Water System",
      category: "plant_equipment" as const,
      originalCost: "2500.00",
      effectiveLife: "12.00",
      method: "prime_cost" as const,
      purchaseDate: null,
      poolType: "individual" as const,
      openingWrittenDownValue: null,
      yearlyDeduction: "208.33",
      remainingValue: "2291.67",
      createdAt: new Date(),
    };

    const uow = createMockUow({
      depreciation: {
        findAssetById: vi.fn()
          .mockResolvedValueOnce(mockAsset)
          .mockResolvedValueOnce(null),
      },
    });

    const found = await uow.depreciation.findAssetById("a1", "u1");
    expect(found).not.toBeNull();
    expect(found!.assetName).toBe("Hot Water System");

    const notFound = await uow.depreciation.findAssetById("a1", "u2");
    expect(notFound).toBeNull();
  });

  it("createAsset returns created asset", async () => {
    const created = {
      id: "a2",
      scheduleId: "s1",
      assetName: "Hot Water System",
      category: "plant_equipment" as const,
      originalCost: "2500.00",
      effectiveLife: "12.00",
      method: "prime_cost" as const,
      purchaseDate: null,
      poolType: "individual" as const,
      openingWrittenDownValue: null,
      yearlyDeduction: "208.33",
      remainingValue: "2291.67",
      createdAt: new Date(),
    };

    const uow = createMockUow({
      depreciation: {
        createAsset: vi.fn().mockResolvedValue(created),
      },
    });

    const result = await uow.depreciation.createAsset({
      scheduleId: "s1",
      assetName: "Hot Water System",
      category: "plant_equipment",
      originalCost: "2500.00",
      effectiveLife: "12.00",
      method: "prime_cost",
      yearlyDeduction: "208.33",
      remainingValue: "2291.67",
    });
    expect(result.assetName).toBe("Hot Water System");
    expect(result.id).toBe("a2");
  });

  it("updateAsset returns updated asset or null", async () => {
    const updated = {
      id: "a1",
      scheduleId: "s1",
      assetName: "Updated Carpet",
      category: "plant_equipment" as const,
      originalCost: "3500.00",
      effectiveLife: "8.00",
      method: "diminishing_value" as const,
      purchaseDate: null,
      poolType: "individual" as const,
      openingWrittenDownValue: null,
      yearlyDeduction: "437.50",
      remainingValue: "3062.50",
      createdAt: new Date(),
    };

    const uow = createMockUow({
      depreciation: {
        updateAsset: vi.fn()
          .mockResolvedValueOnce(updated)
          .mockResolvedValueOnce(null),
      },
    });

    const result = await uow.depreciation.updateAsset("a1", "u1", { assetName: "Updated Carpet" });
    expect(result).not.toBeNull();
    expect(result!.assetName).toBe("Updated Carpet");

    const notOwned = await uow.depreciation.updateAsset("a1", "u2", { assetName: "Nope" });
    expect(notOwned).toBeNull();
  });

  it("deleteAsset calls without error", async () => {
    const deleteFn = vi.fn().mockResolvedValue(undefined);
    const uow = createMockUow({
      depreciation: { deleteAsset: deleteFn },
    });

    await uow.depreciation.deleteAsset("a1", "u1");
    expect(deleteFn).toHaveBeenCalledWith("a1", "u1");
  });

  it("createCapitalWork returns created item", async () => {
    const created = {
      id: "cw1",
      propertyId: "p1",
      userId: "u1",
      description: "Bathroom renovation",
      constructionDate: "2024-03-15",
      constructionCost: "45000.00",
      claimStartDate: "2024-04-01",
      createdAt: new Date(),
    };

    const uow = createMockUow({
      depreciation: {
        createCapitalWork: vi.fn().mockResolvedValue(created),
      },
    });

    const result = await uow.depreciation.createCapitalWork({
      propertyId: "p1",
      userId: "u1",
      description: "Bathroom renovation",
      constructionDate: "2024-03-15",
      constructionCost: "45000.00",
      claimStartDate: "2024-04-01",
    });
    expect(result.description).toBe("Bathroom renovation");
    expect(result.id).toBe("cw1");
  });

  it("findCapitalWorksByProperty returns ordered results", async () => {
    const works = [
      { id: "cw2", description: "Kitchen update", createdAt: new Date("2025-06-01") },
      { id: "cw1", description: "Bathroom renovation", createdAt: new Date("2025-01-01") },
    ];

    const uow = createMockUow({
      depreciation: {
        findCapitalWorksByProperty: vi.fn().mockResolvedValue(works),
      },
    });

    const result = await uow.depreciation.findCapitalWorksByProperty("p1", "u1");
    expect(result).toHaveLength(2);
    expect(result[0].description).toBe("Kitchen update");
  });

  it("updateCapitalWork scopes by userId", async () => {
    const updated = {
      id: "cw1",
      propertyId: "p1",
      userId: "u1",
      description: "Updated renovation",
      constructionDate: "2024-03-15",
      constructionCost: "50000.00",
      claimStartDate: "2024-04-01",
      createdAt: new Date(),
    };

    const uow = createMockUow({
      depreciation: {
        updateCapitalWork: vi.fn()
          .mockResolvedValueOnce(updated)
          .mockResolvedValueOnce(null),
      },
    });

    const result = await uow.depreciation.updateCapitalWork("cw1", "u1", { description: "Updated renovation" });
    expect(result).not.toBeNull();
    expect(result!.description).toBe("Updated renovation");

    const notOwned = await uow.depreciation.updateCapitalWork("cw1", "u2", { description: "Nope" });
    expect(notOwned).toBeNull();
  });

  it("deleteCapitalWork calls without error", async () => {
    const deleteFn = vi.fn().mockResolvedValue(undefined);
    const uow = createMockUow({
      depreciation: { deleteCapitalWork: deleteFn },
    });

    await uow.depreciation.deleteCapitalWork("cw1", "u1");
    expect(deleteFn).toHaveBeenCalledWith("cw1", "u1");
  });

  it("findClaimsByFY returns claims for schedule and year", async () => {
    const claims = [
      {
        id: "cl1",
        assetId: "a1",
        scheduleId: "s1",
        financialYear: 2026,
        amount: "5000.00",
        claimedAt: new Date(),
      },
      {
        id: "cl2",
        assetId: "a2",
        scheduleId: "s1",
        financialYear: 2026,
        amount: "3000.00",
        claimedAt: new Date(),
      },
    ];

    const uow = createMockUow({
      depreciation: {
        findClaimsByFY: vi.fn().mockResolvedValue(claims),
      },
    });

    const result = await uow.depreciation.findClaimsByFY("s1", 2026);
    expect(result).toHaveLength(2);
    expect(result[0].amount).toBe("5000.00");
    expect(result[1].scheduleId).toBe("s1");
  });

  it("createClaim returns created claim", async () => {
    const claim = {
      id: "cl3",
      assetId: "a1",
      scheduleId: "s1",
      financialYear: 2026,
      amount: "1500.00",
      claimedAt: new Date(),
    };

    const uow = createMockUow({
      depreciation: {
        createClaim: vi.fn().mockResolvedValue(claim),
      },
    });

    const result = await uow.depreciation.createClaim({
      scheduleId: "s1",
      financialYear: 2026,
      amount: "1500.00",
    });
    expect(result.amount).toBe("1500.00");
    expect(result.financialYear).toBe(2026);
  });

  it("deleteClaimsByFY deletes by schedule and year", async () => {
    const deleteFn = vi.fn().mockResolvedValue(undefined);
    const uow = createMockUow({
      depreciation: { deleteClaimsByFY: deleteFn },
    });

    await uow.depreciation.deleteClaimsByFY("s1", 2025);
    expect(deleteFn).toHaveBeenCalledWith("s1", 2025);
  });
});
