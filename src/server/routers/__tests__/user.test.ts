import { describe, it, expect, vi } from "vitest";
import {
  createAuthenticatedContext,
  createTestCaller,
} from "../../__tests__/test-utils";

describe("user router", () => {
  describe("setTheme", () => {
    it("updates the user theme in the database", async () => {
      const ctx = createAuthenticatedContext();
      const whereMock = vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ theme: "ocean" }]),
      });
      const setMock = vi.fn().mockReturnValue({ where: whereMock });
      ctx.db.update = vi.fn().mockReturnValue({ set: setMock });

      const caller = createTestCaller(ctx);
      const result = await caller.user.setTheme({ theme: "ocean" });

      expect(result).toEqual({ theme: "ocean" });
      expect(ctx.db.update).toHaveBeenCalled();
      expect(setMock).toHaveBeenCalledWith(
        expect.objectContaining({ theme: "ocean" })
      );
    });

    it("rejects invalid theme values", async () => {
      const ctx = createAuthenticatedContext();
      const caller = createTestCaller(ctx);

      await expect(
        caller.user.setTheme({ theme: "invalid" as any })
      ).rejects.toThrow();
    });
  });
});
