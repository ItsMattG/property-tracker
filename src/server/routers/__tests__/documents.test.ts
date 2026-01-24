import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockContext, createTestCaller } from "../../__tests__/test-utils";

// Mock supabaseAdmin
vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: {
    storage: {
      from: vi.fn().mockReturnValue({
        createSignedUploadUrl: vi.fn(),
        createSignedUrl: vi.fn(),
        remove: vi.fn(),
      }),
    },
  },
}));

import { supabaseAdmin } from "@/lib/supabase/server";

describe("documents router", () => {
  const mockUser = {
    id: "user-1",
    clerkId: "clerk_123",
    email: "test@example.com",
    name: "Test User",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockProperty = {
    id: "550e8400-e29b-41d4-a716-446655440000",
    userId: "user-1",
    address: "123 Main St",
    suburb: "Sydney",
    state: "NSW",
  };

  const mockTransaction = {
    id: "660e8400-e29b-41d4-a716-446655440001",
    userId: "user-1",
    description: "Test transaction",
    amount: "100",
  };

  const mockDocument = {
    id: "770e8400-e29b-41d4-a716-446655440002",
    userId: "user-1",
    propertyId: "550e8400-e29b-41d4-a716-446655440000",
    transactionId: null,
    fileName: "receipt.pdf",
    fileType: "application/pdf",
    fileSize: "1024",
    storagePath: "user-1/550e8400-e29b-41d4-a716-446655440000/1234-receipt.pdf",
    category: "receipt",
    description: "Test receipt",
    createdAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getUploadUrl", () => {
    it("returns signed upload URL for property document", async () => {
      const ctx = createMockContext({ clerkId: "clerk_123", user: mockUser });

      ctx.db = {
        query: {
          users: { findFirst: vi.fn().mockResolvedValue(mockUser) },
          properties: { findFirst: vi.fn().mockResolvedValue(mockProperty) },
        },
      };

      const mockFrom = vi.mocked(supabaseAdmin.storage.from);
      mockFrom.mockReturnValue({
        createSignedUploadUrl: vi.fn().mockResolvedValue({
          data: { signedUrl: "https://example.com/upload", token: "token123" },
          error: null,
        }),
      } as unknown as ReturnType<typeof supabaseAdmin.storage.from>);

      const caller = createTestCaller(ctx);
      const result = await caller.documents.getUploadUrl({
        fileName: "receipt.pdf",
        fileType: "application/pdf",
        fileSize: 1024,
        propertyId: "550e8400-e29b-41d4-a716-446655440000",
      });

      expect(result.signedUrl).toBe("https://example.com/upload");
      expect(result.storagePath).toContain("user-1");
      expect(result.storagePath).toContain("550e8400-e29b-41d4-a716-446655440000");
    });

    it("rejects when neither propertyId nor transactionId provided", async () => {
      const ctx = createMockContext({ clerkId: "clerk_123", user: mockUser });

      ctx.db = {
        query: {
          users: { findFirst: vi.fn().mockResolvedValue(mockUser) },
        },
      };

      const caller = createTestCaller(ctx);

      await expect(
        caller.documents.getUploadUrl({
          fileName: "receipt.pdf",
          fileType: "application/pdf",
          fileSize: 1024,
        })
      ).rejects.toThrow("Exactly one of propertyId or transactionId must be provided");
    });

    it("rejects when both propertyId and transactionId provided", async () => {
      const ctx = createMockContext({ clerkId: "clerk_123", user: mockUser });

      ctx.db = {
        query: {
          users: { findFirst: vi.fn().mockResolvedValue(mockUser) },
        },
      };

      const caller = createTestCaller(ctx);

      await expect(
        caller.documents.getUploadUrl({
          fileName: "receipt.pdf",
          fileType: "application/pdf",
          fileSize: 1024,
          propertyId: "550e8400-e29b-41d4-a716-446655440000",
          transactionId: "660e8400-e29b-41d4-a716-446655440001",
        })
      ).rejects.toThrow("Exactly one of propertyId or transactionId must be provided");
    });

    it("rejects non-existent property", async () => {
      const ctx = createMockContext({ clerkId: "clerk_123", user: mockUser });

      ctx.db = {
        query: {
          users: { findFirst: vi.fn().mockResolvedValue(mockUser) },
          properties: { findFirst: vi.fn().mockResolvedValue(null) },
        },
      };

      const caller = createTestCaller(ctx);

      await expect(
        caller.documents.getUploadUrl({
          fileName: "receipt.pdf",
          fileType: "application/pdf",
          fileSize: 1024,
          propertyId: "550e8400-e29b-41d4-a716-446655440000",
        })
      ).rejects.toThrow("Property not found");
    });
  });

  describe("create", () => {
    it("creates document record for property", async () => {
      const ctx = createMockContext({ clerkId: "clerk_123", user: mockUser });

      const insertMock = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockDocument]),
        }),
      });

      ctx.db = {
        query: {
          users: { findFirst: vi.fn().mockResolvedValue(mockUser) },
          properties: { findFirst: vi.fn().mockResolvedValue(mockProperty) },
        },
        insert: insertMock,
      };

      const caller = createTestCaller(ctx);
      const result = await caller.documents.create({
        storagePath: "user-1/550e8400-e29b-41d4-a716-446655440000/1234-receipt.pdf",
        fileName: "receipt.pdf",
        fileType: "application/pdf",
        fileSize: 1024,
        propertyId: "550e8400-e29b-41d4-a716-446655440000",
        category: "receipt",
      });

      expect(result.id).toBe(mockDocument.id);
      expect(insertMock).toHaveBeenCalled();
    });
  });

  describe("list", () => {
    it("returns documents for property with signed URLs", async () => {
      const ctx = createMockContext({ clerkId: "clerk_123", user: mockUser });

      ctx.db = {
        query: {
          users: { findFirst: vi.fn().mockResolvedValue(mockUser) },
          documents: { findMany: vi.fn().mockResolvedValue([mockDocument]) },
        },
      };

      const mockFrom = vi.mocked(supabaseAdmin.storage.from);
      mockFrom.mockReturnValue({
        createSignedUrl: vi.fn().mockResolvedValue({
          data: { signedUrl: "https://example.com/view" },
          error: null,
        }),
      } as unknown as ReturnType<typeof supabaseAdmin.storage.from>);

      const caller = createTestCaller(ctx);
      const result = await caller.documents.list({
        propertyId: "550e8400-e29b-41d4-a716-446655440000",
      });

      expect(result).toHaveLength(1);
      expect(result[0].signedUrl).toBe("https://example.com/view");
      expect(result[0].fileSize).toBe(1024);
    });
  });

  describe("delete", () => {
    it("deletes document from storage and database", async () => {
      const ctx = createMockContext({ clerkId: "clerk_123", user: mockUser });

      const deleteMock = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });

      ctx.db = {
        query: {
          users: { findFirst: vi.fn().mockResolvedValue(mockUser) },
          documents: { findFirst: vi.fn().mockResolvedValue(mockDocument) },
        },
        delete: deleteMock,
      };

      const mockFrom = vi.mocked(supabaseAdmin.storage.from);
      mockFrom.mockReturnValue({
        remove: vi.fn().mockResolvedValue({ error: null }),
      } as unknown as ReturnType<typeof supabaseAdmin.storage.from>);

      const caller = createTestCaller(ctx);
      const result = await caller.documents.delete({
        id: "770e8400-e29b-41d4-a716-446655440002",
      });

      expect(result.success).toBe(true);
      expect(deleteMock).toHaveBeenCalled();
    });

    it("rejects non-existent document", async () => {
      const ctx = createMockContext({ clerkId: "clerk_123", user: mockUser });

      ctx.db = {
        query: {
          users: { findFirst: vi.fn().mockResolvedValue(mockUser) },
          documents: { findFirst: vi.fn().mockResolvedValue(null) },
        },
      };

      const caller = createTestCaller(ctx);

      await expect(
        caller.documents.delete({
          id: "770e8400-e29b-41d4-a716-446655440002",
        })
      ).rejects.toThrow("Document not found");
    });
  });
});
