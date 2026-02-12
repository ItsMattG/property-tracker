import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock BetterAuth
vi.mock("@/lib/auth", () => ({
  getAuthSession: vi.fn(),
}));

// Mock cookies
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve({
    set: vi.fn(),
  })),
}));

// Mock database
vi.mock("@/server/db", () => ({
  db: {
    query: {
      users: { findFirst: vi.fn() },
      portfolioMembers: { findFirst: vi.fn() },
    },
  },
}));

import { POST } from "../route";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/server/db";

describe("POST /api/entity/switch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(null);

    const request = new NextRequest("http://localhost/api/entity/switch", {
      method: "POST",
      body: JSON.stringify({ entityId: "some-entity-id" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it("returns 401 when user not found in database", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ user: { id: "user_123" } } as never);
    vi.mocked(db.query.users.findFirst).mockResolvedValue(undefined);

    const request = new NextRequest("http://localhost/api/entity/switch", {
      method: "POST",
      body: JSON.stringify({ entityId: "some-entity-id" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it("returns 403 when entityId does not belong to user", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ user: { id: "user-1" } } as never);
    vi.mocked(db.query.users.findFirst).mockResolvedValue({
      id: "user-1",
      email: "user1@test.com",
      name: "User 1",
    } as never);
    vi.mocked(db.query.portfolioMembers.findFirst).mockResolvedValue(undefined);

    const request = new NextRequest("http://localhost/api/entity/switch", {
      method: "POST",
      body: JSON.stringify({ entityId: "other-user-id" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(403);
  });

  it("returns 403 when user is invited but has not joined portfolio", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ user: { id: "user-1" } } as never);
    vi.mocked(db.query.users.findFirst).mockResolvedValue({
      id: "user-1",
      email: "user1@test.com",
      name: "User 1",
    } as never);
    // Membership exists but joinedAt is null (invited but not joined)
    vi.mocked(db.query.portfolioMembers.findFirst).mockResolvedValue({
      ownerId: "other-user",
      userId: "user-1",
      joinedAt: null,
    } as never);

    const request = new NextRequest("http://localhost/api/entity/switch", {
      method: "POST",
      body: JSON.stringify({ entityId: "other-user" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(403);
  });

  it("allows switching to own entity", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ user: { id: "user-1" } } as never);
    vi.mocked(db.query.users.findFirst).mockResolvedValue({
      id: "user-1",
      email: "user1@test.com",
      name: "User 1",
    } as never);

    const request = new NextRequest("http://localhost/api/entity/switch", {
      method: "POST",
      body: JSON.stringify({ entityId: "user-1" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.success).toBe(true);
  });

  it("allows switching to portfolio where user is member", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ user: { id: "user-1" } } as never);
    vi.mocked(db.query.users.findFirst).mockResolvedValue({
      id: "user-1",
      email: "user1@test.com",
      name: "User 1",
    } as never);
    vi.mocked(db.query.portfolioMembers.findFirst).mockResolvedValue({
      ownerId: "other-user",
      userId: "user-1",
      joinedAt: new Date(),
    } as never);

    const request = new NextRequest("http://localhost/api/entity/switch", {
      method: "POST",
      body: JSON.stringify({ entityId: "other-user" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.success).toBe(true);
  });
});
