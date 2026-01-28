import { describe, it, expect, vi, beforeEach } from "vitest";

const mockLimit = vi.fn();

// Mock the database module before importing route
vi.mock("@/server/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: mockLimit,
        })),
      })),
    })),
  },
}));

import { GET } from "../[token]/route";

const mockShare = {
  id: "share-1",
  userId: "user-1",
  token: "abc123",
  title: "My Portfolio",
  privacyMode: "full" as const,
  snapshotData: {
    generatedAt: "2026-01-25T00:00:00Z",
    summary: {
      propertyCount: 3,
      states: ["VIC", "NSW"],
      totalValue: 2500000,
      totalDebt: 1800000,
      totalEquity: 700000,
      portfolioLVR: 72,
      cashFlow: 2500,
      averageYield: 4.2,
    },
    properties: [
      { suburb: "Richmond", state: "VIC", portfolioPercent: 34 },
      { suburb: "Bondi", state: "NSW", portfolioPercent: 66 },
    ],
  },
  expiresAt: new Date(Date.now() + 86400000), // tomorrow
  viewCount: 0,
  createdAt: new Date(),
  lastViewedAt: null,
};

describe("OG share image route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns an image response for valid token", async () => {
    mockLimit.mockResolvedValue([mockShare]);

    const request = new Request("http://localhost/api/og/share/abc123");
    const response = await GET(request, { params: Promise.resolve({ token: "abc123" }) });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("image/png");
    expect(response.headers.get("cache-control")).toContain("public");
  });

  it("redirects to fallback for invalid token", async () => {
    mockLimit.mockResolvedValue([]);

    const request = new Request("http://localhost/api/og/share/invalid");
    const response = await GET(request, { params: Promise.resolve({ token: "invalid" }) });

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("/og-image.svg");
  });

  it("redirects to fallback for expired share", async () => {
    const expiredShare = {
      ...mockShare,
      expiresAt: new Date(Date.now() - 86400000), // yesterday
    };
    mockLimit.mockResolvedValue([expiredShare]);

    const request = new Request("http://localhost/api/og/share/expired");
    const response = await GET(request, { params: Promise.resolve({ token: "expired" }) });

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("/og-image.svg");
  });
});
