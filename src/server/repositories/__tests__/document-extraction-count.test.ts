import { describe, it, expect, vi, beforeEach } from "vitest";
import { DocumentRepository } from "../document.repository";
import type { DB } from "../base";

function createMockDb() {
  const chain = {
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([{ count: 0 }]),
  };
  const select = vi.fn().mockReturnValue(chain);

  const db = { select } as unknown as DB;
  return { db, select, chain };
}

describe("DocumentRepository.getMonthlyExtractionCount", () => {
  let repo: DocumentRepository;
  let mockChain: ReturnType<typeof createMockDb>["chain"];

  beforeEach(() => {
    const { db, chain } = createMockDb();
    repo = new DocumentRepository(db);
    mockChain = chain;
  });

  it("returns count when extractions exist", async () => {
    mockChain.where.mockResolvedValue([{ count: 3 }]);

    const result = await repo.getMonthlyExtractionCount("user-123");

    expect(result).toBe(3);
  });

  it("returns 0 when no extractions exist", async () => {
    mockChain.where.mockResolvedValue([{ count: 0 }]);

    const result = await repo.getMonthlyExtractionCount("user-123");

    expect(result).toBe(0);
  });

  it("returns 0 when query returns empty array", async () => {
    mockChain.where.mockResolvedValue([]);

    const result = await repo.getMonthlyExtractionCount("user-123");

    expect(result).toBe(0);
  });
});
