// src/server/services/property-manager/__tests__/propertyme.test.ts

import { describe, it, expect, vi, beforeEach } from "vitest";
import { PropertyMeProvider } from "../propertyme";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("PropertyMeProvider", () => {
  let provider: PropertyMeProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new PropertyMeProvider({
      clientId: "test-client-id",
      clientSecret: "test-client-secret",
    });
  });

  describe("getAuthUrl", () => {
    it("returns valid OAuth URL", () => {
      const url = provider.getAuthUrl("http://localhost/callback", "state123");
      expect(url).toContain("oauth.propertyme.com");
      expect(url).toContain("client_id=test-client-id");
      expect(url).toContain("state=state123");
    });
  });

  describe("getProperties", () => {
    it("fetches and transforms properties", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              Id: "lot-1",
              Address: { FullAddress: "123 Test St, Sydney NSW 2000" },
              Status: "Active",
            },
          ],
        }),
      });

      const properties = await provider.getProperties("access-token");

      expect(properties).toHaveLength(1);
      expect(properties[0].id).toBe("lot-1");
      expect(properties[0].address).toBe("123 Test St, Sydney NSW 2000");
      expect(properties[0].status).toBe("active");
    });
  });

  describe("getRentPayments", () => {
    it("fetches and transforms rent payments", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              Id: "payment-1",
              LotId: "lot-1",
              TenancyId: "tenancy-1",
              Amount: 500.0,
              Date: "2026-01-25",
              Description: "Rent payment",
            },
          ],
        }),
      });

      const payments = await provider.getRentPayments("access-token");

      expect(payments).toHaveLength(1);
      expect(payments[0].id).toBe("payment-1");
      expect(payments[0].amount).toBe(500);
    });
  });

  describe("getMaintenanceJobs", () => {
    it("fetches and transforms maintenance jobs", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              Id: "job-1",
              LotId: "lot-1",
              Description: "Fix leaking tap",
              Amount: 150.0,
              Date: "2026-01-20",
              SupplierName: "ABC Plumbing",
              Status: "Completed",
            },
          ],
        }),
      });

      const jobs = await provider.getMaintenanceJobs("access-token");

      expect(jobs).toHaveLength(1);
      expect(jobs[0].id).toBe("job-1");
      expect(jobs[0].status).toBe("completed");
      expect(jobs[0].supplierName).toBe("ABC Plumbing");
    });
  });

  describe("getBills", () => {
    it("fetches and transforms bills", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              Id: "bill-1",
              LotId: "lot-1",
              Description: "Council rates Q1",
              Amount: 450.0,
              Date: "2026-01-15",
              DueDate: "2026-02-15",
              Category: "Rates",
            },
          ],
        }),
      });

      const bills = await provider.getBills("access-token");

      expect(bills).toHaveLength(1);
      expect(bills[0].id).toBe("bill-1");
      expect(bills[0].amount).toBe(450);
      expect(bills[0].category).toBe("Rates");
    });
  });

  describe("exchangeCodeForTokens", () => {
    it("exchanges code for tokens", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "new-access-token",
          refresh_token: "new-refresh-token",
          expires_in: 3600,
          user_id: "user-123",
        }),
      });

      const tokens = await provider.exchangeCodeForTokens("auth-code", "http://localhost/callback");

      expect(tokens.accessToken).toBe("new-access-token");
      expect(tokens.refreshToken).toBe("new-refresh-token");
      expect(tokens.expiresIn).toBe(3600);
    });

    it("throws on failed token exchange", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: "Bad Request",
      });

      await expect(
        provider.exchangeCodeForTokens("invalid-code", "http://localhost/callback")
      ).rejects.toThrow("Token exchange failed");
    });
  });

  describe("refreshAccessToken", () => {
    it("refreshes access token", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "refreshed-access-token",
          refresh_token: "new-refresh-token",
          expires_in: 3600,
        }),
      });

      const tokens = await provider.refreshAccessToken("old-refresh-token");

      expect(tokens.accessToken).toBe("refreshed-access-token");
    });
  });
});
