import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { router, protectedProcedure, writeProcedure } from "../../trpc";
import { documentExtractions, transactions, properties } from "../../db/schema";
import { extractDocument, matchPropertyByAddress } from "../../services/property-analysis";

export const documentExtractionRouter = router({
  /**
   * Triggers extraction for a document (creates extraction record, runs async)
   */
  extract: writeProcedure
    .input(z.object({ documentId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Verify document exists and belongs to user
      const document = await ctx.uow.document.findById(input.documentId, ctx.portfolio.ownerId);

      if (!document) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Document not found" });
      }

      // Check for existing extraction
      const existing = await ctx.uow.document.findExtractionByDocumentId(input.documentId);

      if (existing) {
        return existing;
      }

      // Create extraction record
      const extraction = await ctx.uow.document.createExtraction({
        documentId: input.documentId,
        status: "processing",
      });

      // Service-layer: captured db ref for background extraction job
      const db = ctx.db;
      const ownerId = ctx.portfolio.ownerId;

      // Run extraction async (fire and forget)
      void (async () => {
        try {
          const result = await extractDocument(document.storagePath, document.fileType);

          if (!result.success || !result.data) {
            await db.update(documentExtractions)
              .set({
                status: "failed",
                error: result.error || "Extraction failed",
                completedAt: new Date(),
              })
              .where(eq(documentExtractions.id, extraction.id));
            return;
          }

          let matchedPropertyId: string | null = null;
          let propertyMatchConfidence: number | null = null;

          // Try to match property by address
          if (result.data.propertyAddress) {
            const userProperties = await db.query.properties.findMany({
              where: eq(properties.userId, ownerId),
            });
            const match = matchPropertyByAddress(result.data.propertyAddress, userProperties);
            if (match.propertyId && match.confidence > 0.5) {
              matchedPropertyId = match.propertyId;
              propertyMatchConfidence = match.confidence;
            }
          }

          // Create draft transaction if amount was extracted
          let draftTransactionId: string | null = null;
          if (result.data.amount) {
            const [draftTx] = await db.insert(transactions).values({
              userId: ownerId,
              propertyId: matchedPropertyId,
              date: result.data.date || new Date().toISOString().split("T")[0],
              description: result.data.vendor || "Extracted from document",
              amount: String(result.data.amount * -1), // Expenses are negative
              category: (result.data.category as typeof transactions.category.enumValues[number]) || "uncategorized",
              transactionType: "expense",
              status: "pending_review",
            }).returning();
            draftTransactionId = draftTx.id;
          }

          // Update extraction with results
          await db.update(documentExtractions).set({
            status: "completed",
            documentType: result.data.documentType,
            extractedData: JSON.stringify(result.data),
            confidence: String(result.data.confidence),
            matchedPropertyId,
            propertyMatchConfidence: propertyMatchConfidence ? String(propertyMatchConfidence) : null,
            draftTransactionId,
            completedAt: new Date(),
          }).where(eq(documentExtractions.id, extraction.id));
        } catch (error) {
          console.error("Document extraction failed for extraction", extraction.id, error);
          try {
            await db.update(documentExtractions)
              .set({
                status: "failed",
                error: error instanceof Error ? error.message : "Unknown error",
                completedAt: new Date(),
              })
              .where(eq(documentExtractions.id, extraction.id));
          } catch (dbError) {
            console.error("Failed to update extraction status to failed for extraction", extraction.id, dbError);
          }
        }
      })();

      return extraction;
    }),

  /**
   * Gets extraction result for a document
   */
  getExtraction: protectedProcedure
    .input(z.object({ documentId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const extraction = await ctx.uow.document.findExtractionByDocumentId(
        input.documentId,
        { withRelations: true }
      );

      if (!extraction) return null;

      return {
        ...extraction,
        extractedData: extraction.extractedData ? JSON.parse(extraction.extractedData) : null,
      };
    }),

  /**
   * Lists extractions with pending_review transactions
   */
  listPendingReviews: protectedProcedure.query(async ({ ctx }) => {
    const extractions = await ctx.uow.document.findCompletedExtractionsWithRelations();

    return extractions
      .filter((e) => e.draftTransaction?.status === "pending_review")
      .map((e) => ({
        ...e,
        extractedData: e.extractedData ? JSON.parse(e.extractedData) : null,
      }));
  }),

  /**
   * Confirms draft transaction with optional edits
   */
  confirmTransaction: writeProcedure
    .input(z.object({
      extractionId: z.string().uuid(),
      propertyId: z.string().uuid().optional(),
      category: z.string().optional(),
      amount: z.number().optional(),
      date: z.string().optional(),
      description: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const extraction = await ctx.uow.document.findExtractionById(
        input.extractionId,
        { withRelations: true }
      );

      if (!extraction?.draftTransaction) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Extraction or draft transaction not found",
        });
      }

      // Cross-domain: confirms draft transaction from extraction context
      await ctx.db.update(transactions).set({
        status: "confirmed",
        propertyId: input.propertyId ?? extraction.draftTransaction.propertyId,
        category: (input.category as typeof transactions.category.enumValues[number]) ?? extraction.draftTransaction.category,
        amount: input.amount ? String(input.amount) : extraction.draftTransaction.amount,
        date: input.date ?? extraction.draftTransaction.date,
        description: input.description ?? extraction.draftTransaction.description,
      }).where(eq(transactions.id, extraction.draftTransaction.id));

      return { success: true };
    }),

  /**
   * Deletes extraction and draft transaction
   */
  discardExtraction: writeProcedure
    .input(z.object({ extractionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const extraction = await ctx.uow.document.findExtractionById(input.extractionId);

      if (!extraction) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Extraction not found",
        });
      }

      // Cross-domain: deletes draft transaction from extraction context
      if (extraction.draftTransactionId) {
        await ctx.db.delete(transactions).where(eq(transactions.id, extraction.draftTransactionId));
      }

      // Delete extraction
      await ctx.uow.document.deleteExtraction(input.extractionId);

      return { success: true };
    }),
});
