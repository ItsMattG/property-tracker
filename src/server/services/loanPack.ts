import { randomBytes } from "crypto";
import { db } from "@/server/db";
import {
  properties,
  propertyValues,
  loans,
  transactions,
  complianceRecords,
  equityMilestones,
  users,
} from "@/server/db/schema";
import { eq, and, desc, gte, lte, inArray } from "drizzle-orm";
import { getRequirementsForState, type AustralianState } from "@/lib/compliance-requirements";
import { calculateComplianceStatus } from "./compliance";
import { formatMilestone } from "@/lib/equity-milestones";

export interface LoanPackSnapshot {
  generatedAt: string;
  userName: string;

  portfolio: {
    properties: PropertyData[];
    totals: {
      totalValue: number;
      totalDebt: number;
      totalEquity: number;
      avgLvr: number;
    };
  };

  income: {
    monthlyRent: number;
    annualRent: number;
    byProperty: Array<{ address: string; monthlyRent: number }>;
  };

  expenses: {
    categories: Array<{ name: string; monthlyAvg: number; annual: number }>;
    totalMonthly: number;
    totalAnnual: number;
  };

  compliance: {
    items: Array<{ property: string; type: string; status: string; dueDate: string | null }>;
    summary: { compliant: number; overdue: number; upcoming: number };
  };

  milestones: Array<{
    property: string;
    type: "lvr" | "equity_amount";
    value: number;
    formattedValue: string;
    achievedAt: string;
  }>;

  cashFlow: {
    monthlyNet: number;
    annualNet: number;
  };
}

interface PropertyData {
  address: string;
  suburb: string;
  state: string;
  postcode: string;
  purchasePrice: number;
  purchaseDate: string;
  currentValue: number;
  valuationDate: string;
  valuationSource: string;
  loans: Array<{ lender: string; balance: number; rate: number; type: string }>;
  lvr: number;
  equity: number;
}

export function generateLoanPackToken(): string {
  return randomBytes(16).toString("base64url");
}

export async function generateLoanPackSnapshot(userId: string): Promise<LoanPackSnapshot> {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) throw new Error("User not found");

  const userProperties = await db.query.properties.findMany({
    where: and(eq(properties.userId, userId), eq(properties.status, "active")),
  });
  if (userProperties.length === 0) throw new Error("No properties found");

  const propertyIds = userProperties.map((p) => p.id);

  // Get valuations
  const allValues = await db.query.propertyValues.findMany({
    where: and(eq(propertyValues.userId, userId), inArray(propertyValues.propertyId, propertyIds)),
    orderBy: [desc(propertyValues.valueDate)],
  });

  const latestValuesByProperty = new Map<string, { value: number; date: string; source: string }>();
  for (const v of allValues) {
    if (!latestValuesByProperty.has(v.propertyId)) {
      latestValuesByProperty.set(v.propertyId, {
        value: Number(v.estimatedValue),
        date: v.valueDate,
        source: v.source,
      });
    }
  }

  // Get loans
  const allLoans = await db.query.loans.findMany({
    where: and(eq(loans.userId, userId), inArray(loans.propertyId, propertyIds)),
  });

  const loansByProperty = new Map<string, Array<{ lender: string; balance: number; rate: number; type: string }>>();
  for (const loan of allLoans) {
    const list = loansByProperty.get(loan.propertyId) || [];
    list.push({
      lender: loan.lender,
      balance: Number(loan.currentBalance),
      rate: Number(loan.interestRate),
      type: loan.loanType,
    });
    loansByProperty.set(loan.propertyId, list);
  }

  // Get transactions (last 12 months)
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const startDateStr = oneYearAgo.toISOString().split("T")[0];
  const endDateStr = new Date().toISOString().split("T")[0];

  const yearTransactions = await db.query.transactions.findMany({
    where: and(
      eq(transactions.userId, userId),
      gte(transactions.date, startDateStr),
      lte(transactions.date, endDateStr)
    ),
  });

  // Calculate income
  const incomeByProperty = new Map<string, number>();
  let totalIncome = 0;
  for (const t of yearTransactions) {
    if (t.transactionType === "income" && t.propertyId) {
      const current = incomeByProperty.get(t.propertyId) || 0;
      incomeByProperty.set(t.propertyId, current + Number(t.amount));
      totalIncome += Number(t.amount);
    }
  }

  // Calculate expenses
  const expensesByCategory = new Map<string, number>();
  let totalExpenses = 0;
  for (const t of yearTransactions) {
    if (t.transactionType === "expense") {
      const current = expensesByCategory.get(t.category) || 0;
      const amount = Math.abs(Number(t.amount));
      expensesByCategory.set(t.category, current + amount);
      totalExpenses += amount;
    }
  }

  // Get compliance
  const allComplianceRecords = await db.query.complianceRecords.findMany({
    where: eq(complianceRecords.userId, userId),
  });

  const complianceItems: LoanPackSnapshot["compliance"]["items"] = [];
  let compliantCount = 0, overdueCount = 0, upcomingCount = 0;

  for (const property of userProperties) {
    const requirements = getRequirementsForState(property.state as AustralianState);
    const propertyRecords = allComplianceRecords.filter((r) => r.propertyId === property.id);

    for (const req of requirements) {
      const record = propertyRecords.find((r) => r.requirementId === req.id);
      if (record) {
        const nextDue = new Date(record.nextDueAt);
        const status = calculateComplianceStatus(nextDue);
        complianceItems.push({ property: property.address, type: req.name, status, dueDate: record.nextDueAt });
        if (status === "compliant") compliantCount++;
        else if (status === "overdue") overdueCount++;
        else upcomingCount++;
      }
    }
  }

  // Get milestones
  const allMilestones = await db.query.equityMilestones.findMany({
    where: and(eq(equityMilestones.userId, userId), inArray(equityMilestones.propertyId, propertyIds)),
    orderBy: [desc(equityMilestones.achievedAt)],
  });

  const milestonesData = allMilestones.map((m) => {
    const property = userProperties.find((p) => p.id === m.propertyId);
    return {
      property: property?.address || "Unknown",
      type: m.milestoneType as "lvr" | "equity_amount",
      value: Number(m.milestoneValue),
      formattedValue: formatMilestone(m.milestoneType as "lvr" | "equity_amount", Number(m.milestoneValue)),
      achievedAt: m.achievedAt.toISOString(),
    };
  });

  // Build property data
  let totalValue = 0, totalDebt = 0;

  const propertiesData: PropertyData[] = userProperties.map((property) => {
    const valuation = latestValuesByProperty.get(property.id);
    const propertyLoans = loansByProperty.get(property.id) || [];
    const propertyDebt = propertyLoans.reduce((sum, l) => sum + l.balance, 0);
    const value = valuation?.value || 0;
    const equity = value - propertyDebt;
    const lvr = value > 0 ? (propertyDebt / value) * 100 : 0;

    totalValue += value;
    totalDebt += propertyDebt;

    return {
      address: property.address,
      suburb: property.suburb,
      state: property.state,
      postcode: property.postcode,
      purchasePrice: Number(property.purchasePrice),
      purchaseDate: property.purchaseDate,
      currentValue: value,
      valuationDate: valuation?.date || property.purchaseDate,
      valuationSource: valuation?.source || "purchase_price",
      loans: propertyLoans,
      lvr,
      equity,
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    userName: user.name || user.email,
    portfolio: {
      properties: propertiesData,
      totals: { totalValue, totalDebt, totalEquity: totalValue - totalDebt, avgLvr: totalValue > 0 ? (totalDebt / totalValue) * 100 : 0 },
    },
    income: {
      monthlyRent: totalIncome / 12,
      annualRent: totalIncome,
      byProperty: userProperties.map((p) => ({ address: p.address, monthlyRent: (incomeByProperty.get(p.id) || 0) / 12 })),
    },
    expenses: {
      categories: Array.from(expensesByCategory.entries()).map(([name, annual]) => ({
        name: name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        monthlyAvg: annual / 12,
        annual,
      })),
      totalMonthly: totalExpenses / 12,
      totalAnnual: totalExpenses,
    },
    compliance: { items: complianceItems, summary: { compliant: compliantCount, overdue: overdueCount, upcoming: upcomingCount } },
    milestones: milestonesData,
    cashFlow: { monthlyNet: totalIncome / 12 - totalExpenses / 12, annualNet: totalIncome - totalExpenses },
  };
}
