import type { FactorType } from "./factor-schemas";

interface PropertyRef {
  id: string;
  address: string;
}

function findPropertyName(id: string, properties: PropertyRef[]): string {
  return properties.find((p) => p.id === id)?.address ?? "Unknown property";
}

function formatPercent(value: number): string {
  return value >= 0 ? `+${value}%` : `${value}%`;
}

export function formatFactorDescription(
  factorType: FactorType,
  config: Record<string, unknown>,
  properties: PropertyRef[]
): string {
  switch (factorType) {
    case "interest_rate": {
      const change = config.changePercent as number;
      const target =
        config.applyTo === "all"
          ? "all properties"
          : findPropertyName(config.applyTo as string, properties);
      return `Interest rate ${formatPercent(change)} on ${target}`;
    }
    case "vacancy": {
      const months = config.months as number;
      const name = findPropertyName(config.propertyId as string, properties);
      return `${months} months vacancy on ${name}`;
    }
    case "rent_change": {
      const change = config.changePercent as number;
      const target = config.propertyId
        ? findPropertyName(config.propertyId as string, properties)
        : "all properties";
      return `Rent ${formatPercent(change)} on ${target}`;
    }
    case "expense_change": {
      const change = config.changePercent as number;
      const target = config.category
        ? (config.category as string)
        : "all categories";
      return `Expenses ${formatPercent(change)} on ${target}`;
    }
    case "sell_property": {
      const name = findPropertyName(config.propertyId as string, properties);
      const price = (config.salePrice as number).toLocaleString("en-AU");
      return `Sell ${name} for $${price}`;
    }
    case "buy_property": {
      const price = (config.purchasePrice as number).toLocaleString("en-AU");
      const loan = (config.loanAmount as number).toLocaleString("en-AU");
      const rate = config.interestRate as number;
      return `Buy property for $${price} (loan $${loan} @ ${rate}%)`;
    }
    default:
      return "Unknown factor";
  }
}
