import { describe, it, expect } from "vitest";
import { generateDemoData } from "../profiles/demo";
import { generateDevData } from "../profiles/dev";

describe("seed integration", () => {
  describe("demo profile data generation", () => {
    it("generates complete demo data without errors", () => {
      const data = generateDemoData("test-user-123");

      // Verify all required data is present
      expect(data.properties.length).toBe(4);
      expect(data.bankAccounts.length).toBeGreaterThan(0);
      expect(data.transactions.length).toBeGreaterThan(500);
      expect(data.loans.length).toBe(3);
      expect(data.propertySales.length).toBe(1);
      expect(data.anomalyAlerts.length).toBeGreaterThan(0);
      expect(data.complianceRecords.length).toBeGreaterThan(0);
    });

    it("generates valid property references in transactions", () => {
      const data = generateDemoData("test-user-123");
      const propertyIds = new Set(data.properties.map((p) => p.id));

      for (const txn of data.transactions) {
        expect(propertyIds.has(txn.propertyId)).toBe(true);
      }
    });

    it("generates valid bank account references in transactions", () => {
      const data = generateDemoData("test-user-123");
      const accountIds = new Set(data.bankAccounts.map((a) => a.id));

      for (const txn of data.transactions) {
        expect(accountIds.has(txn.bankAccountId)).toBe(true);
      }
    });

    it("generates sold property with valid sale record", () => {
      const data = generateDemoData("test-user-123");
      const soldProperty = data.properties.find((p) => p.status === "sold");
      const sale = data.propertySales[0];

      expect(soldProperty).toBeDefined();
      expect(sale.propertyId).toBe(soldProperty!.id);
      expect(sale.heldOverTwelveMonths).toBe(true);
    });
  });

  describe("dev profile data generation", () => {
    it("generates complete dev data without errors", () => {
      const data = generateDevData("test-user-123");

      expect(data.properties.length).toBe(2);
      expect(data.bankAccounts.length).toBeGreaterThan(0);
      expect(data.transactions.length).toBeGreaterThan(50);
      expect(data.loans.length).toBe(2);
    });

    it("uses fake addresses", () => {
      const data = generateDevData("test-user-123");

      expect(data.properties[0].address).toContain("Test");
    });
  });
});
