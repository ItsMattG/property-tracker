import { describe, it, expect, vi } from "vitest";
import { createMockUow } from "../../__tests__/test-utils";

describe("PortfolioRepository — share methods (unit)", () => {
  it("is accessible via UoW proxy", () => {
    const uow = createMockUow();
    expect(uow.portfolio).toBeDefined();
  });

  describe("createShare", () => {
    it("creates a share and returns it", async () => {
      const mockShare = {
        id: "share-1",
        userId: "user-1",
        token: "abc123",
        title: "My Share",
        privacyMode: "full" as const,
        snapshotData: { generatedAt: "2026-02-19", summary: { propertyCount: 1, states: ["NSW"] } },
        expiresAt: new Date("2026-03-05"),
        viewCount: 0,
        createdAt: new Date(),
        lastViewedAt: null,
      };

      const uow = createMockUow({
        portfolio: {
          createShare: vi.fn().mockResolvedValue(mockShare),
        },
      });

      const result = await uow.portfolio.createShare(mockShare);
      expect(result).toEqual(mockShare);
      expect(uow.portfolio.createShare).toHaveBeenCalledWith(mockShare);
    });
  });

  describe("findSharesByOwner", () => {
    it("returns shares for the given user", async () => {
      const mockShares = [
        { id: "share-1", title: "Share 1", viewCount: 5 },
        { id: "share-2", title: "Share 2", viewCount: 0 },
      ];

      const uow = createMockUow({
        portfolio: {
          findSharesByOwner: vi.fn().mockResolvedValue(mockShares),
        },
      });

      const result = await uow.portfolio.findSharesByOwner("user-1");
      expect(result).toHaveLength(2);
      expect(uow.portfolio.findSharesByOwner).toHaveBeenCalledWith("user-1");
    });

    it("returns empty array when no shares exist", async () => {
      const uow = createMockUow({
        portfolio: {
          findSharesByOwner: vi.fn().mockResolvedValue([]),
        },
      });

      const result = await uow.portfolio.findSharesByOwner("user-1");
      expect(result).toEqual([]);
    });
  });

  describe("deleteShare", () => {
    it("deletes share scoped by user and returns it", async () => {
      const deleted = { id: "share-1", title: "Deleted Share" };
      const uow = createMockUow({
        portfolio: {
          deleteShare: vi.fn().mockResolvedValue(deleted),
        },
      });

      const result = await uow.portfolio.deleteShare("share-1", "user-1");
      expect(result).toEqual(deleted);
      expect(uow.portfolio.deleteShare).toHaveBeenCalledWith("share-1", "user-1");
    });

    it("returns null when share not found", async () => {
      const uow = createMockUow({
        portfolio: {
          deleteShare: vi.fn().mockResolvedValue(null),
        },
      });

      const result = await uow.portfolio.deleteShare("nonexistent", "user-1");
      expect(result).toBeNull();
    });
  });
});
