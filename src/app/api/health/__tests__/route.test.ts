import { describe, it, expect, vi, beforeEach } from "vitest";

const mockExecute = vi.fn();

vi.mock("@/server/db", () => ({
  db: {
    execute: (...args: unknown[]) => mockExecute(...args),
  },
}));

import { GET } from "../route";

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with healthy status when DB is reachable", async () => {
    mockExecute.mockResolvedValue([{ "?column?": 1 }]);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("healthy");
    expect(body.checks.database).toBe("ok");
    expect(body).toHaveProperty("responseTimeMs");
    expect(body).toHaveProperty("timestamp");
  });

  it("returns 503 with unhealthy status when DB fails", async () => {
    mockExecute.mockRejectedValue(new Error("Connection refused"));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.status).toBe("unhealthy");
    expect(body.checks.database).toBe("failed");
  });
});
