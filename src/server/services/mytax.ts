import { db } from "@/server/db";
import { properties, taxProfiles, depreciationSchedules } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { categories } from "@/lib/categories";
import {
  getFinancialYearRange,
  getFinancialYearTransactions,
  calculateCategoryTotals,
} from "./reports";
import { calculateTaxPosition } from "./tax-position";

// --- Types ---

export interface MyTaxLineItem {
  label: string;
  atoCode: string;
  category: string;
  amount: number;
  transactionCount: number;
}

export interface MyTaxPropertyReport {
  propertyId: string;
  address: string;
  suburb: string;
  state: string;
  entityName: string;
  income: MyTaxLineItem[];
  deductions: MyTaxLineItem[];
  depreciation: {
    capitalWorks: number;
    plantEquipment: number;
  };
  totalIncome: number;
  totalDeductions: number;
  netResult: number;
}

export interface MyTaxPersonalSummary {
  grossSalary: number;
  paygWithheld: number;
  otherDeductions: number;
  hasHecsDebt: boolean;
  hasPrivateHealth: boolean;
  taxPosition: {
    taxableIncome: number;
    baseTax: number;
    medicareLevy: number;
    medicareLevySurcharge: number;
    hecsRepayment: number;
    totalTaxLiability: number;
    refundOrOwing: number;
    isRefund: boolean;
  } | null;
}

export interface MyTaxReport {
  financialYear: string;
  fyNumber: number;
  startDate: string;
  endDate: string;
  properties: MyTaxPropertyReport[];
  personalSummary: MyTaxPersonalSummary | null;
  totalIncome: number;
  totalDeductions: number;
  netRentalResult: number;
  generatedAt: string;
}

// --- Helpers ---

const incomeCategories = categories.filter((c) => c.type === "income");
const deductibleCategories = categories.filter((c) => c.isDeductible);

function buildLineItems(
  categoryList: typeof categories,
  totals: Map<string, number>,
  txns: Array<{ category: string }>
): MyTaxLineItem[] {
  return categoryList
    .map((cat) => ({
      label: cat.label,
      atoCode: cat.atoReference || "",
      category: cat.value,
      amount: Math.abs(totals.get(cat.value) || 0),
      transactionCount: txns.filter((t) => t.category === cat.value).length,
    }))
    .filter((item) => item.amount > 0);
}

// --- Main ---

export async function buildMyTaxReport(
  userId: string,
  year: number
): Promise<MyTaxReport> {
  const { startDate, endDate, label } = getFinancialYearRange(year);

  // Fetch all data in parallel
  const [userProperties, allTxns, taxProfile, depreciation] = await Promise.all([
    db.query.properties.findMany({
      where: eq(properties.userId, userId),
    }),
    getFinancialYearTransactions(userId, year),
    db.query.taxProfiles.findFirst({
      where: and(
        eq(taxProfiles.userId, userId),
        eq(taxProfiles.financialYear, year)
      ),
    }),
    db.query.depreciationSchedules.findMany({
      where: eq(depreciationSchedules.userId, userId),
      with: { assets: true },
    }),
  ]);

  // Group transactions by property
  const txnsByProperty = new Map<string, typeof allTxns>();
  for (const t of allTxns) {
    if (t.propertyId) {
      const existing = txnsByProperty.get(t.propertyId) || [];
      existing.push(t);
      txnsByProperty.set(t.propertyId, existing);
    }
  }

  // Build depreciation lookup by property
  const depByProperty = new Map<string, { capitalWorks: number; plantEquipment: number }>();
  for (const schedule of depreciation) {
    const assets = (schedule as any).assets || [];
    let cw = 0;
    let pe = 0;
    for (const asset of assets) {
      const deduction = Number(asset.yearlyDeduction) || 0;
      if (asset.category === "capital_works") {
        cw += deduction;
      } else {
        pe += deduction;
      }
    }
    const existing = depByProperty.get(schedule.propertyId) || { capitalWorks: 0, plantEquipment: 0 };
    depByProperty.set(schedule.propertyId, {
      capitalWorks: existing.capitalWorks + cw,
      plantEquipment: existing.plantEquipment + pe,
    });
  }

  // Build per-property reports
  const propertyReports: MyTaxPropertyReport[] = userProperties.map((prop) => {
    const propTxns = txnsByProperty.get(prop.id) || [];
    const catTotals = calculateCategoryTotals(propTxns as any);
    const dep = depByProperty.get(prop.id) || { capitalWorks: 0, plantEquipment: 0 };

    const income = buildLineItems(incomeCategories, catTotals, propTxns as any);
    const deductions = buildLineItems(deductibleCategories, catTotals, propTxns as any);

    const totalIncome = income.reduce((s, i) => s + i.amount, 0);
    const totalDeductions =
      deductions.reduce((s, d) => s + d.amount, 0) +
      dep.capitalWorks +
      dep.plantEquipment;

    return {
      propertyId: prop.id,
      address: prop.address,
      suburb: prop.suburb || "",
      state: prop.state || "",
      entityName: prop.entityName || "Personal",
      income,
      deductions,
      depreciation: dep,
      totalIncome,
      totalDeductions,
      netResult: totalIncome - totalDeductions,
    };
  });

  // Portfolio totals
  const totalIncome = propertyReports.reduce((s, p) => s + p.totalIncome, 0);
  const totalDeductions = propertyReports.reduce((s, p) => s + p.totalDeductions, 0);
  const netRentalResult = totalIncome - totalDeductions;

  // Personal summary from tax profile
  let personalSummary: MyTaxPersonalSummary | null = null;
  if (taxProfile) {
    const grossSalary = Number(taxProfile.grossSalary) || 0;
    const paygWithheld = Number(taxProfile.paygWithheld) || 0;
    const otherDeductions = Number(taxProfile.otherDeductions) || 0;

    let taxPosition: MyTaxPersonalSummary["taxPosition"] = null;
    try {
      const result = calculateTaxPosition({
        financialYear: year,
        grossSalary,
        paygWithheld,
        rentalNetResult: netRentalResult,
        otherDeductions,
        hasHecsDebt: taxProfile.hasHecsDebt,
        hasPrivateHealth: taxProfile.hasPrivateHealth,
        familyStatus: taxProfile.familyStatus as "single" | "couple" | "family",
        dependentChildren: taxProfile.dependentChildren,
        partnerIncome: Number(taxProfile.partnerIncome) || 0,
      });
      taxPosition = {
        taxableIncome: result.taxableIncome,
        baseTax: result.baseTax,
        medicareLevy: result.medicareLevy,
        medicareLevySurcharge: result.medicareLevySurcharge,
        hecsRepayment: result.hecsRepayment,
        totalTaxLiability: result.totalTaxLiability,
        refundOrOwing: result.refundOrOwing,
        isRefund: result.isRefund,
      };
    } catch {
      // Tax tables might not be available for this FY
    }

    personalSummary = {
      grossSalary,
      paygWithheld,
      otherDeductions,
      hasHecsDebt: taxProfile.hasHecsDebt,
      hasPrivateHealth: taxProfile.hasPrivateHealth,
      taxPosition,
    };
  }

  return {
    financialYear: label,
    fyNumber: year,
    startDate,
    endDate,
    properties: propertyReports,
    personalSummary,
    totalIncome,
    totalDeductions,
    netRentalResult,
    generatedAt: new Date().toISOString(),
  };
}
