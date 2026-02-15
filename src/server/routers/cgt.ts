import { z } from "zod";
import { positiveAmountSchema } from "@/lib/validation";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, writeProcedure } from "../trpc";
import {
  calculateCostBase,
  calculateCapitalGain,
  CAPITAL_CATEGORIES,
} from "../services/tax";

export const cgtRouter = router({
  /**
   * Get cost base breakdown for a property
   */
  getCostBase: protectedProcedure
    .input(z.object({ propertyId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { propertyId } = input;
      const ownerId = ctx.portfolio.ownerId;

      const property = await ctx.uow.property.findById(propertyId, ownerId);
      if (!property) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Property not found",
        });
      }

      const allTxns = await ctx.uow.transactions.findAllByOwner(ownerId, {
        propertyId,
      });

      const capitalTxns = allTxns.filter((t) =>
        CAPITAL_CATEGORIES.includes(t.category)
      );

      const totalCostBase = calculateCostBase(property.purchasePrice, capitalTxns);

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
      const ownerId = ctx.portfolio.ownerId;

      let userProperties = await ctx.uow.property.findByOwnerWithSales(ownerId);

      if (status === "active") {
        userProperties = userProperties.filter((p) => p.status === "active");
      } else if (status === "sold") {
        userProperties = userProperties.filter((p) => p.status === "sold");
      }

      // Get all transactions, filter to capital categories in JS
      const allTxns = await ctx.uow.transactions.findAllByOwner(ownerId);

      const capitalTxnsByProperty = new Map<string, typeof allTxns>();
      for (const txn of allTxns) {
        if (txn.propertyId && CAPITAL_CATEGORIES.includes(txn.category)) {
          const existing = capitalTxnsByProperty.get(txn.propertyId) ?? [];
          existing.push(txn);
          capitalTxnsByProperty.set(txn.propertyId, existing);
        }
      }

      const propertySummaries = userProperties.map((property) => {
        const propertyCapitalTxns = capitalTxnsByProperty.get(property.id) ?? [];

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
  recordSale: writeProcedure
    .input(
      z.object({
        propertyId: z.string().uuid(),
        salePrice: positiveAmountSchema,
        settlementDate: z.string(),
        contractDate: z.string().optional(),
        agentCommission: positiveAmountSchema.default("0"),
        legalFees: positiveAmountSchema.default("0"),
        marketingCosts: positiveAmountSchema.default("0"),
        otherSellingCosts: positiveAmountSchema.default("0"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { propertyId, salePrice, settlementDate, contractDate, ...costs } = input;
      const ownerId = ctx.portfolio.ownerId;

      const property = await ctx.uow.property.findById(propertyId, ownerId);
      if (!property) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Property not found",
        });
      }

      if (property.status === "sold") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Property is already sold",
        });
      }

      if (new Date(settlementDate) <= new Date(property.purchaseDate)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Settlement date must be after purchase date",
        });
      }

      const allTxns = await ctx.uow.transactions.findAllByOwner(ownerId, {
        propertyId,
      });

      const capitalTxns = allTxns.filter((t) =>
        CAPITAL_CATEGORIES.includes(t.category)
      );

      const costBase = calculateCostBase(property.purchasePrice, capitalTxns);

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

      const sale = await ctx.uow.property.createSale({
        propertyId,
        userId: ownerId,
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
      });

      await ctx.uow.property.update(propertyId, ownerId, {
        status: "sold",
        soldAt: settlementDate,
        updatedAt: new Date(),
      });

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
      const sale = await ctx.uow.property.findSaleByProperty(
        input.propertyId,
        ctx.portfolio.ownerId
      );

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
      const ownerId = ctx.portfolio.ownerId;

      const property = await ctx.uow.property.findById(input.propertyId, ownerId);
      if (!property) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Property not found",
        });
      }

      const allTxns = await ctx.uow.transactions.findAllByOwner(ownerId, {
        propertyId: input.propertyId,
      });

      const sellingCostCategories = ["property_agent_fees", "legal_expenses"];
      const sellingCosts = allTxns
        .filter((t) => sellingCostCategories.includes(t.category))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

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
