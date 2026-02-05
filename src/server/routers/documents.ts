import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, writeProcedure } from "../trpc";
import {
  documents,
  properties,
  transactions,
  documentExtractions,
} from "../db/schema";
import { eq, and, or } from "drizzle-orm";
import { supabaseAdmin } from "@/lib/supabase/server";
import { extractDocument } from "../services/document-extraction";
import { matchPropertyByAddress } from "../services/property-matcher";

const ALLOWED_FILE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/heic",
  "application/pdf",
] as const;

const MAX_FILE_SIZE = 10485760; // 10MB in bytes

export const documentsRouter = router({
  /**
   * Get a signed upload URL for direct upload to Supabase Storage
   */
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
      const { fileName, fileType, fileSize, propertyId, transactionId } = input;

      // Validate XOR constraint
      if ((!propertyId && !transactionId) || (propertyId && transactionId)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Exactly one of propertyId or transactionId must be provided",
        });
      }

      // Validate ownership of property or transaction
      if (propertyId) {
        const property = await ctx.db.query.properties.findFirst({
          where: and(
            eq(properties.id, propertyId),
            eq(properties.userId, ctx.portfolio.ownerId)
          ),
        });

        if (!property) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Property not found",
          });
        }
      }

      if (transactionId) {
        const transaction = await ctx.db.query.transactions.findFirst({
          where: and(
            eq(transactions.id, transactionId),
            eq(transactions.userId, ctx.portfolio.ownerId)
          ),
        });

        if (!transaction) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Transaction not found",
          });
        }
      }

      // Generate storage path
      const entityId = propertyId || transactionId;
      const timestamp = Date.now();
      const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
      const storagePath = `${ctx.portfolio.ownerId}/${entityId}/${timestamp}-${sanitizedFileName}`;

      // Create signed upload URL
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

  /**
   * Create document record after successful upload
   */
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

      // Validate XOR constraint
      if ((!propertyId && !transactionId) || (propertyId && transactionId)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Exactly one of propertyId or transactionId must be provided",
        });
      }

      // Validate ownership
      if (propertyId) {
        const property = await ctx.db.query.properties.findFirst({
          where: and(
            eq(properties.id, propertyId),
            eq(properties.userId, ctx.portfolio.ownerId)
          ),
        });

        if (!property) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Property not found",
          });
        }
      }

      if (transactionId) {
        const transaction = await ctx.db.query.transactions.findFirst({
          where: and(
            eq(transactions.id, transactionId),
            eq(transactions.userId, ctx.portfolio.ownerId)
          ),
        });

        if (!transaction) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Transaction not found",
          });
        }
      }

      // Create document record
      const [document] = await ctx.db
        .insert(documents)
        .values({
          userId: ctx.portfolio.ownerId,
          propertyId,
          transactionId,
          fileName,
          fileType,
          fileSize: String(fileSize),
          storagePath,
          category,
          description,
        })
        .returning();

      // Trigger extraction for supported file types
      const extractableTypes = ["image/jpeg", "image/png", "application/pdf"];
      if (extractableTypes.includes(fileType)) {
        // Create extraction record
        const [extraction] = await ctx.db
          .insert(documentExtractions)
          .values({
            documentId: document.id,
            status: "processing",
          })
          .returning();

        // Run extraction asynchronously (don't await)
        const ownerId = ctx.portfolio.ownerId;
        const db = ctx.db;

        void (async () => {
          try {
            const result = await extractDocument(storagePath, fileType);

            if (!result.success || !result.data) {
              await db
                .update(documentExtractions)
                .set({
                  status: "failed",
                  error: result.error || "Extraction failed",
                  completedAt: new Date(),
                })
                .where(eq(documentExtractions.id, extraction.id));
              return;
            }

            // Match property if address found
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

            // Create draft transaction if amount found
            let draftTransactionId: string | null = null;

            if (result.data.amount) {
              const [draftTx] = await db
                .insert(transactions)
                .values({
                  userId: ownerId,
                  propertyId: matchedPropertyId,
                  date: result.data.date || new Date().toISOString().split("T")[0],
                  description: result.data.vendor || "Extracted from document",
                  amount: String(result.data.amount * -1), // Expenses are negative
                  category: (result.data.category as typeof transactions.$inferInsert.category) || "uncategorized",
                  transactionType: "expense",
                  status: "pending_review",
                })
                .returning();

              draftTransactionId = draftTx.id;
            }

            // Update extraction record
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
            console.error("Document extraction failed for extraction", extraction.id, error);
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
              console.error("Failed to update extraction status to failed for extraction", extraction.id, dbError);
            }
          }
        })();
      }

      return document;
    }),

  /**
   * List documents for a property or transaction
   */
  list: protectedProcedure
    .input(
      z.object({
        propertyId: z.string().uuid().optional(),
        transactionId: z.string().uuid().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { propertyId, transactionId } = input;

      // Build where clause
      let whereClause;
      if (propertyId && transactionId) {
        whereClause = and(
          eq(documents.userId, ctx.portfolio.ownerId),
          or(
            eq(documents.propertyId, propertyId),
            eq(documents.transactionId, transactionId)
          )
        );
      } else if (propertyId) {
        whereClause = and(
          eq(documents.userId, ctx.portfolio.ownerId),
          eq(documents.propertyId, propertyId)
        );
      } else if (transactionId) {
        whereClause = and(
          eq(documents.userId, ctx.portfolio.ownerId),
          eq(documents.transactionId, transactionId)
        );
      } else {
        // Return all user documents
        whereClause = eq(documents.userId, ctx.portfolio.ownerId);
      }

      const docs = await ctx.db.query.documents.findMany({
        where: whereClause,
        orderBy: (d, { desc }) => [desc(d.createdAt)],
      });

      // Generate signed URLs for viewing
      const docsWithUrls = await Promise.all(
        docs.map(async (doc) => {
          const { data } = await supabaseAdmin.storage
            .from("documents")
            .createSignedUrl(doc.storagePath, 3600); // 1 hour

          return {
            ...doc,
            fileSize: Number(doc.fileSize),
            signedUrl: data?.signedUrl || null,
          };
        })
      );

      return docsWithUrls;
    }),

  /**
   * Delete a document (removes from storage + database)
   */
  delete: writeProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Find document and verify ownership
      const document = await ctx.db.query.documents.findFirst({
        where: and(
          eq(documents.id, input.id),
          eq(documents.userId, ctx.portfolio.ownerId)
        ),
      });

      if (!document) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Document not found",
        });
      }

      // Delete from storage
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

      // Delete from database
      await ctx.db.delete(documents).where(eq(documents.id, input.id));

      return { success: true };
    }),

  /**
   * Get a single document with signed URL
   */
  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const document = await ctx.db.query.documents.findFirst({
        where: and(
          eq(documents.id, input.id),
          eq(documents.userId, ctx.portfolio.ownerId)
        ),
      });

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
