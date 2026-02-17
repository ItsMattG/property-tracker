import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, writeProcedure } from "../../trpc";
import { properties, transactions, documentExtractions } from "../../db/schema";
import { eq } from "drizzle-orm";
import { supabaseAdmin } from "@/lib/supabase/server";
import { extractDocument } from "../../services/property-analysis";
import { matchPropertyByAddress } from "../../services/property-analysis";
import { logger } from "@/lib/logger";

const ALLOWED_FILE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/heic",
  "application/pdf",
] as const;

const MAX_FILE_SIZE = 10485760; // 10MB in bytes

export const documentsRouter = router({
  getUploadUrl: writeProcedure
    .input(
      z.object({
        fileName: z.string().min(1),
        fileType: z.enum(ALLOWED_FILE_TYPES),
        fileSize: z.number().max(MAX_FILE_SIZE, "File size must be under 10MB"),
        propertyId: z.string().uuid().optional(),
        transactionId: z.string().uuid().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { fileName, propertyId, transactionId } = input;

      if (propertyId && transactionId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot provide both propertyId and transactionId",
        });
      }

      if (propertyId) {
        const property = await ctx.uow.property.findById(propertyId, ctx.portfolio.ownerId);
        if (!property) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" });
        }
      }

      if (transactionId) {
        const transaction = await ctx.uow.transactions.findById(transactionId, ctx.portfolio.ownerId);
        if (!transaction) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Transaction not found" });
        }
      }

      const entityId = propertyId || transactionId || "receipts";
      const timestamp = Date.now();
      const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
      const storagePath = `${ctx.portfolio.ownerId}/${entityId}/${timestamp}-${sanitizedFileName}`;

      const { data, error } = await supabaseAdmin.storage
        .from("documents")
        .createSignedUploadUrl(storagePath);

      if (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create upload URL",
          cause: error,
        });
      }

      return {
        signedUrl: data.signedUrl,
        storagePath,
        token: data.token,
      };
    }),

  create: writeProcedure
    .input(
      z.object({
        storagePath: z.string().min(1),
        fileName: z.string().min(1),
        fileType: z.string().min(1),
        fileSize: z.number().positive(),
        propertyId: z.string().uuid().optional(),
        transactionId: z.string().uuid().optional(),
        category: z
          .enum(["receipt", "contract", "depreciation", "lease", "other"])
          .optional(),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const {
        storagePath,
        fileName,
        fileType,
        fileSize,
        propertyId,
        transactionId,
        category,
        description,
      } = input;

      if (propertyId && transactionId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot provide both propertyId and transactionId",
        });
      }

      if (propertyId) {
        const property = await ctx.uow.property.findById(propertyId, ctx.portfolio.ownerId);
        if (!property) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" });
        }
      }

      if (transactionId) {
        const transaction = await ctx.uow.transactions.findById(transactionId, ctx.portfolio.ownerId);
        if (!transaction) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Transaction not found" });
        }
      }

      const document = await ctx.uow.document.create({
        userId: ctx.portfolio.ownerId,
        propertyId,
        transactionId,
        fileName,
        fileType,
        fileSize: String(fileSize),
        storagePath,
        category,
        description,
      });

      // Trigger extraction for supported file types
      const extractableTypes = ["image/jpeg", "image/png", "application/pdf"];
      if (extractableTypes.includes(fileType)) {
        const extraction = await ctx.uow.document.createExtraction({
          documentId: document.id,
          status: "processing",
        });

        // Run extraction asynchronously (don't await)
        // Uses db directly: background closure runs outside request/UoW lifecycle
        const ownerId = ctx.portfolio.ownerId;
        const db = ctx.db;

        void (async () => {
          try {
            const result = await extractDocument(storagePath, fileType);

            if (!result.success || !result.data) {
              await ctx.uow.document.updateExtraction(extraction.id, {
                status: "failed",
                error: result.error || "Extraction failed",
                completedAt: new Date(),
              });
              return;
            }

            let matchedPropertyId: string | null = null;
            let propertyMatchConfidence: number | null = null;

            if (result.data.propertyAddress) {
              const userProperties = await db.query.properties.findMany({
                where: eq(properties.userId, ownerId),
              });

              const match = matchPropertyByAddress(
                result.data.propertyAddress,
                userProperties
              );

              if (match.propertyId && match.confidence > 0.5) {
                matchedPropertyId = match.propertyId;
                propertyMatchConfidence = match.confidence;
              }
            }

            let draftTransactionId: string | null = null;

            if (result.data.amount) {
              const [draftTx] = await db
                .insert(transactions)
                .values({
                  userId: ownerId,
                  propertyId: matchedPropertyId,
                  date: result.data.date || new Date().toISOString().split("T")[0],
                  description: result.data.vendor || "Extracted from document",
                  amount: String(result.data.amount * -1),
                  category: (result.data.category as typeof transactions.$inferInsert.category) || "uncategorized",
                  transactionType: "expense",
                  status: "pending_review",
                })
                .returning();

              draftTransactionId = draftTx.id;
            }

            await db
              .update(documentExtractions)
              .set({
                status: "completed",
                documentType: result.data.documentType,
                extractedData: JSON.stringify(result.data),
                confidence: String(result.data.confidence),
                matchedPropertyId,
                propertyMatchConfidence: propertyMatchConfidence
                  ? String(propertyMatchConfidence)
                  : null,
                draftTransactionId,
                completedAt: new Date(),
              })
              .where(eq(documentExtractions.id, extraction.id));
          } catch (error) {
            logger.error("Document extraction failed", error instanceof Error ? error : new Error(String(error)), { extractionId: extraction.id });
            try {
              await db
                .update(documentExtractions)
                .set({
                  status: "failed",
                  error: error instanceof Error ? error.message : "Unknown error",
                  completedAt: new Date(),
                })
                .where(eq(documentExtractions.id, extraction.id));
            } catch (dbError) {
              logger.error("Failed to update extraction status to failed", dbError instanceof Error ? dbError : new Error(String(dbError)), { extractionId: extraction.id });
            }
          }
        })();
      }

      return document;
    }),

  list: protectedProcedure
    .input(
      z.object({
        propertyId: z.string().uuid().optional(),
        transactionId: z.string().uuid().optional(),
        category: z.enum(["receipt", "contract", "depreciation", "lease", "other"]).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const docs = await ctx.uow.document.findByOwner(ctx.portfolio.ownerId, {
        propertyId: input.propertyId,
        transactionId: input.transactionId,
        category: input.category,
      });

      const docsWithUrls = await Promise.all(
        docs.map(async (doc) => {
          const { data } = await supabaseAdmin.storage
            .from("documents")
            .createSignedUrl(doc.storagePath, 3600);

          return {
            ...doc,
            fileSize: Number(doc.fileSize),
            signedUrl: data?.signedUrl || null,
          };
        })
      );

      return docsWithUrls;
    }),

  delete: writeProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const document = await ctx.uow.document.findById(input.id, ctx.portfolio.ownerId);

      if (!document) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Document not found",
        });
      }

      const { error: storageError } = await supabaseAdmin.storage
        .from("documents")
        .remove([document.storagePath]);

      if (storageError) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete file from storage",
          cause: storageError,
        });
      }

      await ctx.uow.document.delete(input.id, ctx.portfolio.ownerId);

      return { success: true };
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const document = await ctx.uow.document.findById(input.id, ctx.portfolio.ownerId);

      if (!document) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Document not found",
        });
      }

      const { data } = await supabaseAdmin.storage
        .from("documents")
        .createSignedUrl(document.storagePath, 3600);

      return {
        ...document,
        fileSize: Number(document.fileSize),
        signedUrl: data?.signedUrl || null,
      };
    }),
});
