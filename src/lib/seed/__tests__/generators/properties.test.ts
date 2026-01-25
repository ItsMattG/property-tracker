import { describe, it, expect } from "vitest";
import { generateProperty, generatePropertySale } from "../../generators/properties";

describe("generateProperty", () => {
  it("creates a property with required fields", () => {
    const property = generateProperty({
      userId: "user-123",
      address: "42 Oxford Street",
      suburb: "Paddington",
      state: "NSW",
      postcode: "2021",
      purchasePrice: 850000,
      purchaseDate: new Date("2020-01-15"),
    });

    expect(property.id).toBeDefined();
    expect(property.userId).toBe("user-123");
    expect(property.address).toBe("42 Oxford Street");
    expect(property.suburb).toBe("Paddington");
    expect(property.state).toBe("NSW");
    expect(property.postcode).toBe("2021");
    expect(property.purchasePrice).toBe("850000.00");
    expect(property.purchaseDate).toBe("2020-01-15");
    expect(property.status).toBe("active");
    expect(property.climateRisk).toBeDefined();
  });

  it("creates a sold property with sale date", () => {
    const property = generateProperty({
      userId: "user-123",
      address: "23 King Street",
      suburb: "Newtown",
      state: "NSW",
      postcode: "2042",
      purchasePrice: 680000,
      purchaseDate: new Date("2020-02-01"),
      status: "sold",
      soldAt: new Date("2024-10-15"),
    });

    expect(property.status).toBe("sold");
    expect(property.soldAt).toBe("2024-10-15");
  });
});

describe("generatePropertySale", () => {
  it("creates a property sale record with CGT calculation", () => {
    const sale = generatePropertySale({
      propertyId: "prop-123",
      userId: "user-123",
      purchasePrice: 680000,
      purchaseDate: new Date("2020-02-01"),
      salePrice: 850000,
      settlementDate: new Date("2024-10-15"),
      agentCommission: 17000,
      legalFees: 2000,
    });

    expect(sale.propertyId).toBe("prop-123");
    expect(sale.salePrice).toBe("850000.00");
    expect(sale.agentCommission).toBe("17000.00");
    expect(sale.heldOverTwelveMonths).toBe(true);
    expect(parseFloat(sale.capitalGain)).toBeGreaterThan(0);
  });
});
