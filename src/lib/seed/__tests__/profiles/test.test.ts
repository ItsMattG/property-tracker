import { describe, it, expect } from "vitest";
import {
  seedMinimalPortfolio,
  seedMultiPropertyPortfolio,
  seedCGTScenario,
  seedAnomalyScenario,
} from "../../profiles/test";

describe("test fixtures", () => {
  describe("seedMinimalPortfolio", () => {
    it("creates 1 property, 1 loan, and transactions", () => {
      const data = seedMinimalPortfolio("user-123");

      expect(data.properties).toHaveLength(1);
      expect(data.loans).toHaveLength(1);
      expect(data.transactions.length).toBeGreaterThan(0);
      expect(data.transactions.length).toBeLessThanOrEqual(10);
    });
  });

  describe("seedMultiPropertyPortfolio", () => {
    it("creates 3 properties for list testing", () => {
      const data = seedMultiPropertyPortfolio("user-123");

      expect(data.properties).toHaveLength(3);
    });
  });

  describe("seedCGTScenario", () => {
    it("creates a sold property with sale record", () => {
      const data = seedCGTScenario("user-123");

      expect(data.properties).toHaveLength(1);
      expect(data.properties[0].status).toBe("sold");
      expect(data.propertySales).toHaveLength(1);
    });
  });

  describe("seedAnomalyScenario", () => {
    it("creates property with various alert types", () => {
      const data = seedAnomalyScenario("user-123");

      expect(data.properties).toHaveLength(1);
      expect(data.anomalyAlerts.length).toBeGreaterThan(0);
    });
  });
});
