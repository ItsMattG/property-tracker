import { z } from "zod";

export const FACTOR_TYPES = [
  "interest_rate",
  "vacancy",
  "rent_change",
  "expense_change",
  "sell_property",
  "buy_property",
] as const;

export type FactorType = (typeof FACTOR_TYPES)[number];

export const interestRateConfigSchema = z.object({
  changePercent: z.number().min(-3).max(5),
  applyTo: z.string().min(1),
});

export const vacancyConfigSchema = z.object({
  propertyId: z.string().min(1),
  months: z.number().int().min(1).max(24),
});

export const rentChangeConfigSchema = z.object({
  changePercent: z.number().min(-20).max(20),
  propertyId: z.string().optional(),
});

export const expenseChangeConfigSchema = z.object({
  changePercent: z.number().min(-20).max(20),
  category: z.string().optional(),
});

export const sellPropertyConfigSchema = z.object({
  propertyId: z.string().min(1),
  salePrice: z.number().min(0),
  sellingCosts: z.number().min(0),
  settlementMonth: z.number().int().min(1),
});

export const buyPropertyConfigSchema = z.object({
  purchasePrice: z.number().min(0),
  deposit: z.number().min(0),
  loanAmount: z.number().min(0),
  interestRate: z.number().min(0).max(20),
  expectedRent: z.number().min(0),
  expectedExpenses: z.number().min(0),
  purchaseMonth: z.number().int().min(0),
});

export type InterestRateConfig = z.infer<typeof interestRateConfigSchema>;
export type VacancyConfig = z.infer<typeof vacancyConfigSchema>;
export type RentChangeConfig = z.infer<typeof rentChangeConfigSchema>;
export type ExpenseChangeConfig = z.infer<typeof expenseChangeConfigSchema>;
export type SellPropertyConfig = z.infer<typeof sellPropertyConfigSchema>;
export type BuyPropertyConfig = z.infer<typeof buyPropertyConfigSchema>;

export const CONFIG_SCHEMAS: Record<FactorType, z.ZodType> = {
  interest_rate: interestRateConfigSchema,
  vacancy: vacancyConfigSchema,
  rent_change: rentChangeConfigSchema,
  expense_change: expenseChangeConfigSchema,
  sell_property: sellPropertyConfigSchema,
  buy_property: buyPropertyConfigSchema,
};

export const factorFormSchema = z.object({
  factorType: z.enum(FACTOR_TYPES),
  config: z.record(z.string(), z.unknown()),
  startMonth: z.number().int().min(0).default(0),
  durationMonths: z.number().int().min(1).optional(),
});

export type FactorFormValues = z.infer<typeof factorFormSchema>;
