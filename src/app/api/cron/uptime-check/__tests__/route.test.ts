import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const mockSendAlert = vi.fn();
vi.mock("@/lib/monitoring", () => ({
  sendAlert: (...args: unknown[]) => mockSendAlert(...args),
}));

vi.mock("@/lib/cron-auth", () => ({
  verifyCronRequest: () => true,
  unauthorizedResponse: () =>
    new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
}));

const mockLimit = vi.fn();
const mockUpdateExecute = vi.fn();
const mockInsertExecute = vi.fn();

vi.mock("@/server/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: (...args: unknown[]) => mockLimit(...args),
        }),
      }),
    }),
    update: () => ({
      set: () => ({
        where: () => ({
          execute: (...args: unknown[]) => mockUpdateExecute(...args),
        }),
      }),
    }),
    insert: () => ({
      values: () => ({
        execute: (...args: unknown[]) => mockInsertExecute(...args),
      }),
    }),
  },
}));

import { GET } from "../route";

function makeRequest() {
  return new Request("http://localhost/api/cron/uptime-check", {
    headers: { Authorization: "Bearer test-secret" },
  });
}

describe("GET /api/cron/uptime-check", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendAlert.mockResolvedValue(undefined);
    mockUpdateExecute.mockResolvedValue(undefined);
    mockInsertExecute.mockResolvedValue(undefined);
  });

  it("does not alert when status is healthy and was healthy before", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: "healthy" }),
    });

    mockLimit.mockResolvedValue([
      {
        id: "uptime",
        lastStatus: "healthy",
        lastCheckedAt: new Date(),
        failingSince: null,
        consecutiveFailures: 0,
      },
    ]);

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(body.status).toBe("healthy");
    expect(mockSendAlert).not.toHaveBeenCalled();
  });

  it("alerts when transitioning from healthy to unhealthy", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ status: "unhealthy" }),
    });

    mockLimit.mockResolvedValue([
      {
        id: "uptime",
        lastStatus: "healthy",
        lastCheckedAt: new Date(),
        failingSince: null,
        consecutiveFailures: 0,
      },
    ]);

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(body.status).toBe("unhealthy");
    expect(mockSendAlert).toHaveBeenCalledWith(
      expect.stringContaining("DOWN"),
      expect.any(String),
      "high"
    );
  });

  it("alerts on recovery from unhealthy to healthy", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: "healthy" }),
    });

    const failingSince = new Date(Date.now() - 600_000); // 10 min ago
    mockLimit.mockResolvedValue([
      {
        id: "uptime",
        lastStatus: "unhealthy",
        lastCheckedAt: new Date(),
        failingSince,
        consecutiveFailures: 3,
      },
    ]);

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(body.status).toBe("healthy");
    expect(mockSendAlert).toHaveBeenCalledWith(
      expect.stringContaining("recovered"),
      expect.any(String),
      "default"
    );
  });

  it("initializes state on first run when no previous state exists", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: "healthy" }),
    });

    mockLimit.mockResolvedValue([]); // no previous state

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(body.status).toBe("healthy");
    expect(mockInsertExecute).toHaveBeenCalled();
    expect(mockSendAlert).not.toHaveBeenCalled();
  });
});
