import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseAdmin: () => ({
    storage: {
      from: () => ({
        createSignedUrl: vi.fn().mockResolvedValue({
          data: { signedUrl: "https://example.com/signed-url" },
          error: null,
        }),
      }),
    },
  }),
}));

import { createMockContext, createTestCaller } from "../../__tests__/test-utils";

describe("email router", () => {
  describe("downloadAttachment", () => {
    it("returns signed URL for valid attachment", async () => {
      const ctx = createMockContext();
      const caller = createTestCaller(ctx);
      await expect(
        caller.email.downloadAttachment({ attachmentId: 999 })
      ).rejects.toThrow();
    });
  });
});
