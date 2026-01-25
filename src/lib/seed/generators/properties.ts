import { randomUUID } from "crypto";
import type { PropertySeedConfig } from "../types";
import { getClimateRisk } from "@/server/services/climate-risk";
import { formatDate } from "../utils";

export interface GeneratedProperty {
  id: string;
  userId: string;
  address: string;
  suburb: string;
  state: "NSW" | "VIC" | "QLD" | "SA" | "WA" | "TAS" | "NT" | "ACT";
  postcode: string;
  purchasePrice: string;
  purchaseDate: string;
  entityName: string;
  status: "active" | "sold";
  soldAt: string | null;
  climateRisk: ReturnType<typeof getClimateRisk>;
  createdAt: Date;
  updatedAt: Date;
}

export function generateProperty(
  config: PropertySeedConfig & { userId: string }
): GeneratedProperty {
  const climateRisk = getClimateRisk(config.postcode);

  return {
    id: randomUUID(),
    userId: config.userId,
    address: config.address,
    suburb: config.suburb,
    state: config.state,
    postcode: config.postcode,
    purchasePrice: config.purchasePrice.toFixed(2),
    purchaseDate: formatDate(config.purchaseDate),
    entityName: config.entityName ?? "Personal",
    status: config.status ?? "active",
    soldAt: config.soldAt ? formatDate(config.soldAt) : null,
    climateRisk,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export interface PropertySaleConfig {
  propertyId: string;
  userId: string;
  purchasePrice: number;
  purchaseDate: Date;
  salePrice: number;
  settlementDate: Date;
  contractDate?: Date;
  agentCommission?: number;
  legalFees?: number;
  marketingCosts?: number;
  otherSellingCosts?: number;
}

export interface GeneratedPropertySale {
  id: string;
  propertyId: string;
  userId: string;
  salePrice: string;
  settlementDate: string;
  contractDate: string | null;
  agentCommission: string;
  legalFees: string;
  marketingCosts: string;
  otherSellingCosts: string;
  costBase: string;
  capitalGain: string;
  discountedGain: string | null;
  heldOverTwelveMonths: boolean;
  createdAt: Date;
}

export function generatePropertySale(config: PropertySaleConfig): GeneratedPropertySale {
  const agentCommission = config.agentCommission ?? 0;
  const legalFees = config.legalFees ?? 0;
  const marketingCosts = config.marketingCosts ?? 0;
  const otherSellingCosts = config.otherSellingCosts ?? 0;

  const totalSellingCosts = agentCommission + legalFees + marketingCosts + otherSellingCosts;
  const costBase = config.purchasePrice + totalSellingCosts;
  const capitalGain = config.salePrice - costBase;

  // Check if held over 12 months
  const holdingPeriodMs = config.settlementDate.getTime() - config.purchaseDate.getTime();
  const holdingPeriodMonths = holdingPeriodMs / (1000 * 60 * 60 * 24 * 30.44);
  const heldOverTwelveMonths = holdingPeriodMonths >= 12;

  // 50% CGT discount if held over 12 months and gain is positive
  const discountedGain = heldOverTwelveMonths && capitalGain > 0 ? capitalGain * 0.5 : null;

  return {
    id: randomUUID(),
    propertyId: config.propertyId,
    userId: config.userId,
    salePrice: config.salePrice.toFixed(2),
    settlementDate: formatDate(config.settlementDate),
    contractDate: config.contractDate ? formatDate(config.contractDate) : null,
    agentCommission: agentCommission.toFixed(2),
    legalFees: legalFees.toFixed(2),
    marketingCosts: marketingCosts.toFixed(2),
    otherSellingCosts: otherSellingCosts.toFixed(2),
    costBase: costBase.toFixed(2),
    capitalGain: capitalGain.toFixed(2),
    discountedGain: discountedGain !== null ? discountedGain.toFixed(2) : null,
    heldOverTwelveMonths,
    createdAt: new Date(),
  };
}
