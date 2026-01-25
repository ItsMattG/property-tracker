import { describe, it, expect } from "vitest";
import { generateAnomalyAlert, generateConnectionAlert } from "../../generators/alerts";

describe("generateAnomalyAlert", () => {
  it("creates a missed rent alert", () => {
    const alert = generateAnomalyAlert({
      userId: "user-123",
      propertyId: "prop-123",
      alertType: "missed_rent",
      severity: "warning",
      description: "Expected rent payment not received",
    });

    expect(alert.alertType).toBe("missed_rent");
    expect(alert.severity).toBe("warning");
    expect(alert.status).toBe("active");
  });

  it("creates an unusual amount alert", () => {
    const alert = generateAnomalyAlert({
      userId: "user-123",
      propertyId: "prop-123",
      alertType: "unusual_amount",
      severity: "info",
      description: "Plumber charge $4,500 is higher than typical $200-800",
      transactionId: "txn-123",
    });

    expect(alert.alertType).toBe("unusual_amount");
    expect(alert.transactionId).toBe("txn-123");
  });
});

describe("generateConnectionAlert", () => {
  it("creates a disconnected bank alert", () => {
    const alert = generateConnectionAlert({
      userId: "user-123",
      bankAccountId: "account-123",
      alertType: "disconnected",
      errorMessage: "Bank connection expired",
    });

    expect(alert.alertType).toBe("disconnected");
    expect(alert.status).toBe("active");
  });
});
