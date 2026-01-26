import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHmac } from "crypto";

// Mock db before importing route
vi.mock("@/server/db", () => ({
  db: {
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([]),
  },
}));

describe("Basiq Webhook Route", () => {
  const WEBHOOK_SECRET = "test-webhook-secret";

  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("BASIQ_WEBHOOK_SECRET", WEBHOOK_SECRET);
  });

  function signPayload(payload: string): string {
    return createHmac("sha256", WEBHOOK_SECRET).update(payload).digest("hex");
  }

  it("should reject requests without signature", async () => {
    const { POST } = await import("../route");
    const request = new Request("http://localhost/api/webhooks/basiq", {
      method: "POST",
      body: JSON.stringify({ type: "connection.created", data: {} }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request as any);
    expect(response.status).toBe(401);
  });

  it("should reject requests with invalid signature", async () => {
    const { POST } = await import("../route");
    const payload = JSON.stringify({ type: "connection.created", data: {} });
    const request = new Request("http://localhost/api/webhooks/basiq", {
      method: "POST",
      body: payload,
      headers: {
        "Content-Type": "application/json",
        "x-basiq-signature": "invalid-signature",
      },
    });

    const response = await POST(request as any);
    expect(response.status).toBe(401);
  });

  it("should accept requests with valid signature", async () => {
    const { POST } = await import("../route");
    const payload = JSON.stringify({
      type: "connection.created",
      data: { connectionId: "test-123" },
    });
    const signature = signPayload(payload);
    const request = new Request("http://localhost/api/webhooks/basiq", {
      method: "POST",
      body: payload,
      headers: {
        "Content-Type": "application/json",
        "x-basiq-signature": signature,
      },
    });

    const response = await POST(request as any);
    expect(response.status).toBe(200);
  });
});
