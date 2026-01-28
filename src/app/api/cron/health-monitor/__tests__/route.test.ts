import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSendAlert = vi.fn();
vi.mock("@/lib/monitoring", () => ({
  sendAlert: (...args: unknown[]) => mockSendAlert(...args),
}));

vi.mock("@/lib/cron-auth", () => ({
  verifyCronRequest: () => true,
  unauthorizedResponse: () =>
    new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
}));

const mockExecute = vi.fn();

vi.mock("@/server/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        execute: (...args: unknown[]) => mockExecute(...args),
      }),
    }),
  },
}));

import { GET } from "../route";

function makeRequest() {
  return new Request("http://localhost/api/cron/health-monitor", {
    headers: { Authorization: "Bearer test-secret" },
  });
}

describe("GET /api/cron/health-monitor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendAlert.mockResolvedValue(undefined);
  });

  it("reports all healthy when heartbeats are fresh", async () => {
    mockExecute.mockResolvedValue([
      {
        cronName: "sync-banks",
        lastRunAt: new Date(),
        status: "success",
      },
      {
        cronName: "valuations",
        lastRunAt: new Date(),
        status: "success",
      },
    ]);

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(body.allHealthy).toBe(true);
    expect(mockSendAlert).not.toHaveBeenCalled();
  });

  it("alerts for stale sync-banks heartbeat", async () => {
    const staleTime = new Date(Date.now() - 30 * 60 * 60 * 1000); // 30 hours ago
    mockExecute.mockResolvedValue([
      {
        cronName: "sync-banks",
        lastRunAt: staleTime,
        status: "success",
      },
      {
        cronName: "valuations",
        lastRunAt: new Date(),
        status: "success",
      },
    ]);

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(body.allHealthy).toBe(false);
    expect(mockSendAlert).toHaveBeenCalledWith(
      expect.stringContaining("sync-banks"),
      expect.any(String),
      "high"
    );
  });

  it("alerts for missing heartbeat (no record exists)", async () => {
    mockExecute.mockResolvedValue([]);

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(body.allHealthy).toBe(false);
    expect(mockSendAlert).toHaveBeenCalled();
  });
});
