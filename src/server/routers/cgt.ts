import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import { properties, transactions, propertySales } from "../db/schema";
import { eq, and } from "drizzle-orm";
import {
  calculateCostBase,
  calculateCapitalGain,
  CAPITAL_CATEGORIES,
} from "../services/cgt";

export const cgtRouter = router({
  /**
   * Get cost base breakdown for a property
   */
  getCostBase: protectedProcedure
    .input(z.object({ propertyId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { propertyId } = input;

      // Validate property ownership
      const property = await ctx.db.query.properties.findFirst({
        where: and(
          eq(properties.id, propertyId),
          eq(properties.userId, ctx.user.id)
        ),
      });

      if (!property) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Property not found",
        });
      }

      // Get capital transactions
      const allTxns = await ctx.db.query.transactions.findMany({
        where: and(
          eq(transactions.propertyId, propertyId),
          eq(transactions.userId, ctx.user.id)
        ),
      });

      const capitalTxns = allTxns.filter((t) =>
        CAPITAL_CATEGORIES.includes(t.category)
      );

      // Calculate cost base
      const totalCostBase = calculateCostBase(property.purchasePrice, capitalTxns);

      // Build breakdown
      const breakdown = capitalTxns.map((t) => ({
        category: t.category,
        description: t.description,
        amount: Math.abs(Number(t.amount)),
        date: t.date,
      }));

      return {
        propertyId,
        purchasePrice: Number(property.purchasePrice),
        purchaseDate: property.purchaseDate,
        acquisitionCosts: breakdown,
        totalAcquisitionCosts: breakdown.reduce((sum, b) => sum + b.amount, 0),
        totalCostBase,
      };
    }),

  /**
   * Get CGT summary for all user properties
   */
  getSummary: protectedProcedure
    .input(
      z.object({
        status: z.enum(["active", "sold", "all"]).default("all"),
      })
    )
    .query(async ({ ctx, input }) => {
      const { status } = input;

      // Get all properties
      let userProperties = await ctx.db.query.properties.findMany({
        where: eq(properties.userId, ctx.user.id),
        with: {
          sales: true,
        },
      });

      // Filter by status if needed
      if (status === "active") {
        userProperties = userProperties.filter((p) => p.status === "active");
      } else if (status === "sold") {
        userProperties = userProperties.filter((p) => p.status === "sold");
      }

      // Get all capital transactions for the user
      const allTxns = await ctx.db.query.transactions.findMany({
        where: eq(transactions.userId, ctx.user.id),
      });

      // Build summary for each property
      const propertySummaries = userProperties.map((property) => {
        const propertyCapitalTxns = allTxns.filter(
          (t) =>
            t.propertyId === property.id &&
            CAPITAL_CATEGORIES.includes(t.category)
        );

        const costBase = calculateCostBase(
          property.purchasePrice,
          propertyCapitalTxns
        );

        const sale = property.sales?.[0];

        return {
          id: property.id,
          address: property.address,
          suburb: property.suburb,
          state: property.state,
          status: property.status,
          purchasePrice: Number(property.purchasePrice),
          purchaseDate: property.purchaseDate,
          costBase,
          sale: sale
            ? {
                salePrice: Number(sale.salePrice),
                settlementDate: sale.settlementDate,
                capitalGain: Number(sale.capitalGain),
                discountedGain: sale.discountedGain
                  ? Number(sale.discountedGain)
                  : null,
                heldOverTwelveMonths: sale.heldOverTwelveMonths,
              }
            : null,
        };
      });

      return {
        properties: propertySummaries,
        totals: {
          activeCount: propertySummaries.filter((p) => p.status === "active").length,
          soldCount: propertySummaries.filter((p) => p.status === "sold").length,
          totalCostBase: propertySummaries
            .filter((p) => p.status === "active")
            .reduce((sum, p) => sum + p.costBase, 0),
        },
      };
    }),

  /**
   * Record a property sale and archive the property
   */
  recordSale: protectedProcedure
    .input(
      z.object({
        propertyId: z.string().uuid(),
        salePrice: z.string().regex(/^\d+\.?\d*$/, "Invalid sale price"),
        settlementDate: z.string(),
        contractDate: z.string().optional(),
        agentCommission: z.string().regex(/^\d+\.?\d*$/).default("0"),
        legalFees: z.string().regex(/^\d+\.?\d*$/).default("0"),
        marketingCosts: z.string().regex(/^\d+\.?\d*$/).default("0"),
        otherSellingCosts: z.string().regex(/^\d+\.?\d*$/).default("0"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { propertyId, salePrice, settlementDate, contractDate, ...costs } = input;

      // Validate property ownership
      const property = await ctx.db.query.properties.findFirst({
        where: and(
          eq(properties.id, propertyId),
          eq(properties.userId, ctx.user.id)
        ),
      });

      if (!property) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Property not found",
        });
      }

      // Check property is not already sold
      if (property.status === "sold") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Property is already sold",
        });
      }

      // Validate settlement date is after purchase date
      if (new Date(settlementDate) <= new Date(property.purchaseDate)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Settlement date must be after purchase date",
        });
      }

      // Get capital transactions for cost base
      const allTxns = await ctx.db.query.transactions.findMany({
        where: and(
          eq(transactions.propertyId, propertyId),
          eq(transactions.userId, ctx.user.id)
        ),
      });

      const capitalTxns = allTxns.filter((t) =>
        CAPITAL_CATEGORIES.includes(t.category)
      );

      // Calculate cost base
      const costBase = calculateCostBase(property.purchasePrice, capitalTxns);

      // Calculate capital gain
      const cgtResult = calculateCapitalGain({
        costBase,
        salePrice: Number(salePrice),
        sellingCosts: {
          agentCommission: Number(costs.agentCommission),
          legalFees: Number(costs.legalFees),
          marketingCosts: Number(costs.marketingCosts),
          otherSellingCosts: Number(costs.otherSellingCosts),
        },
        purchaseDate: property.purchaseDate,
        settlementDate,
      });

      // Create sale record
      const [sale] = await ctx.db
        .insert(propertySales)
        .values({
          propertyId,
          userId: ctx.user.id,
          salePrice,
          settlementDate,
          contractDate,
          agentCommission: costs.agentCommission,
          legalFees: costs.legalFees,
          marketingCosts: costs.marketingCosts,
          otherSellingCosts: costs.otherSellingCosts,
          costBase: String(costBase),
          capitalGain: String(cgtResult.capitalGain),
          discountedGain: String(cgtResult.discountedGain),
          heldOverTwelveMonths: cgtResult.heldOverTwelveMonths,
        })
        .returning();

      // Archive the property
      await ctx.db
        .update(properties)
        .set({
          status: "sold",
          soldAt: settlementDate,
          updatedAt: new Date(),
        })
        .where(eq(properties.id, propertyId));

      return {
        sale,
        cgtResult,
      };
    }),

  /**
   * Get sale details for a sold property
   */
  getSaleDetails: protectedProcedure
    .input(z.object({ propertyId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const sale = await ctx.db.query.propertySales.findFirst({
        where: and(
          eq(propertySales.propertyId, input.propertyId),
          eq(propertySales.userId, ctx.user.id)
        ),
        with: {
          property: true,
        },
      });

      if (!sale) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Sale record not found",
        });
      }

      return {
        property: {
          id: sale.property.id,
          address: sale.property.address,
          suburb: sale.property.suburb,
          state: sale.property.state,
          purchasePrice: Number(sale.property.purchasePrice),
          purchaseDate: sale.property.purchaseDate,
        },
        sale: {
          salePrice: Number(sale.salePrice),
          settlementDate: sale.settlementDate,
          contractDate: sale.contractDate,
          agentCommission: Number(sale.agentCommission),
          legalFees: Number(sale.legalFees),
          marketingCosts: Number(sale.marketingCosts),
          otherSellingCosts: Number(sale.otherSellingCosts),
          costBase: Number(sale.costBase),
          capitalGain: Number(sale.capitalGain),
          discountedGain: sale.discountedGain ? Number(sale.discountedGain) : null,
          heldOverTwelveMonths: sale.heldOverTwelveMonths,
        },
      };
    }),

  /**
   * Get potential selling costs from transactions (for auto-fill)
   */
  getSellingCosts: protectedProcedure
    .input(z.object({ propertyId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // Validate property ownership
      const property = await ctx.db.query.properties.findFirst({
        where: and(
          eq(properties.id, input.propertyId),
          eq(properties.userId, ctx.user.id)
        ),
      });

      if (!property) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Property not found",
        });
      }

      // Look for transactions that might be selling costs
      const potentialCosts = await ctx.db.query.transactions.findMany({
        where: and(
          eq(transactions.propertyId, input.propertyId),
          eq(transactions.userId, ctx.user.id)
        ),
        orderBy: (t, { desc }) => [desc(t.date)],
      });

      // Filter to likely selling cost categories
      const sellingCostCategories = ["property_agent_fees", "legal_expenses"];
      const sellingCosts = potentialCosts.filter((t) =>
        sellingCostCategories.includes(t.category)
      );

      return {
        transactions: sellingCosts.map((t) => ({
          id: t.id,
          category: t.category,
          description: t.description,
          amount: Math.abs(Number(t.amount)),
          date: t.date,
        })),
      };
    }),
});
