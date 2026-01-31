import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("mobile-jwt", () => {
  const originalEnv = process.env.JWT_SECRET;

  beforeEach(() => {
    // Reset modules before each test to allow fresh imports
    vi.resetModules();
  });

  afterEach(() => {
    // Restore original environment
    if (originalEnv !== undefined) {
      process.env.JWT_SECRET = originalEnv;
    } else {
      delete process.env.JWT_SECRET;
    }
  });

  describe("JWT_SECRET validation", () => {
    it("should throw an error when JWT_SECRET is not set", async () => {
      // Arrange: Remove JWT_SECRET from environment
      delete process.env.JWT_SECRET;

      // Act & Assert: Dynamic import should throw
      await expect(
        import("../mobile-jwt")
      ).rejects.toThrow("JWT_SECRET environment variable is required");
    });

    it("should throw an error when JWT_SECRET is empty string", async () => {
      // Arrange: Set JWT_SECRET to empty string
      process.env.JWT_SECRET = "";

      // Act & Assert: Dynamic import should throw
      await expect(
        import("../mobile-jwt")
      ).rejects.toThrow("JWT_SECRET environment variable is required");
    });
  });

  describe("when JWT_SECRET is set", () => {
    const TEST_SECRET = "test-secret-for-jwt-testing-minimum-32-chars";

    beforeEach(() => {
      process.env.JWT_SECRET = TEST_SECRET;
    });

    it("should export JWT_SECRET correctly", async () => {
      const { JWT_SECRET } = await import("../mobile-jwt");
      expect(JWT_SECRET).toBe(TEST_SECRET);
    });

    it("should export JWT_EXPIRES_IN as 30d", async () => {
      const { JWT_EXPIRES_IN } = await import("../mobile-jwt");
      expect(JWT_EXPIRES_IN).toBe("30d");
    });

    it("should sign and verify tokens correctly", async () => {
      const { signMobileToken, verifyMobileToken } = await import("../mobile-jwt");

      const payload = {
        userId: "user-123",
        email: "test@example.com",
      };

      // Sign a token
      const token = signMobileToken(payload);
      expect(token).toBeDefined();
      expect(typeof token).toBe("string");

      // Verify the token
      const decoded = verifyMobileToken(token);
      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.email).toBe(payload.email);
    });

    it("should throw when verifying an invalid token", async () => {
      const { verifyMobileToken } = await import("../mobile-jwt");

      expect(() => verifyMobileToken("invalid-token")).toThrow();
    });

    it("should throw when verifying a token signed with different secret", async () => {
      // First, sign a token with the current secret
      const { signMobileToken } = await import("../mobile-jwt");
      const token = signMobileToken({
        userId: "user-123",
        email: "test@example.com",
      });

      // Reset modules and change secret
      vi.resetModules();
      process.env.JWT_SECRET = "different-secret-for-testing-minimum-32-chars";

      // Try to verify with different secret
      const { verifyMobileToken } = await import("../mobile-jwt");
      expect(() => verifyMobileToken(token)).toThrow();
    });
  });
});
