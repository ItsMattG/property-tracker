// src/server/services/property-manager/__tests__/types.test.ts

import { describe, it, expect } from "vitest";
import type { PMProperty, PMRentPayment, PropertyManagerProvider } from "../types";

describe("Property Manager Types", () => {
  it("PMProperty has required fields", () => {
    const property: PMProperty = {
      id: "123",
      address: "123 Test St",
      status: "active",
    };
    expect(property.id).toBe("123");
    expect(property.status).toBe("active");
  });

  it("PMRentPayment has required fields", () => {
    const payment: PMRentPayment = {
      id: "p1",
      propertyId: "123",
      tenancyId: "t1",
      amount: 500,
      date: "2026-01-25",
      description: "Weekly rent",
    };
    expect(payment.amount).toBe(500);
  });

  it("PropertyManagerProvider interface is valid", () => {
    // Type check only - ensure interface compiles
    const checkInterface = (provider: PropertyManagerProvider) => {
      expect(provider.name).toBeDefined();
    };
    expect(checkInterface).toBeDefined();
  });
});
