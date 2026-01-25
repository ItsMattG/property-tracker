import { describe, it, expect } from "vitest";
import { NotificationType } from "../notification";

describe("notification refinance types", () => {
  it("includes refinance_opportunity type", () => {
    const type: NotificationType = "refinance_opportunity";
    expect(type).toBe("refinance_opportunity");
  });

  it("includes cash_rate_changed type", () => {
    const type: NotificationType = "cash_rate_changed";
    expect(type).toBe("cash_rate_changed");
  });
});
