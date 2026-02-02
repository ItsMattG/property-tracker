import { z } from "zod";
import { router, proProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { db } from "../db";
import { emailApprovedSenders, properties } from "../db/schema";
import { eq, and } from "drizzle-orm";

export const emailSenderRouter = router({
  /**
   * Lists all approved senders for the current user.
   */
  list: proProcedure.query(async ({ ctx }) => {
    const senders = await db
      .select({
        id: emailApprovedSenders.id,
        emailPattern: emailApprovedSenders.emailPattern,
        label: emailApprovedSenders.label,
        defaultPropertyId: emailApprovedSenders.defaultPropertyId,
        createdAt: emailApprovedSenders.createdAt,
      })
      .from(emailApprovedSenders)
      .where(eq(emailApprovedSenders.userId, ctx.user.id));

    return senders;
  }),

  /**
   * Adds a new approved sender pattern.
   */
  create: proProcedure
    .input(
      z.object({
        emailPattern: z
          .string()
          .min(1)
          .refine(
            (val) => {
              // Valid patterns: exact email or *@domain
              const exactEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
              const wildcardDomain = /^\*@[^\s@]+\.[^\s@]+$/;
              return exactEmail.test(val) || wildcardDomain.test(val);
            },
            {
              message:
                "Must be a valid email address or wildcard pattern (e.g., *@company.com)",
            }
          ),
        label: z.string().optional(),
        defaultPropertyId: z.string().uuid().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify property belongs to user if provided
      if (input.defaultPropertyId) {
        const [property] = await db
          .select({ id: properties.id })
          .from(properties)
          .where(
            and(
              eq(properties.id, input.defaultPropertyId),
              eq(properties.userId, ctx.user.id)
            )
          );

        if (!property) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Property not found",
          });
        }
      }

      const [sender] = await db
        .insert(emailApprovedSenders)
        .values({
          userId: ctx.user.id,
          emailPattern: input.emailPattern.toLowerCase(),
          label: input.label,
          defaultPropertyId: input.defaultPropertyId,
        })
        .returning();

      return sender;
    }),

  /**
   * Updates an approved sender.
   */
  update: proProcedure
    .input(
      z.object({
        id: z.number(),
        label: z.string().optional(),
        defaultPropertyId: z.string().uuid().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [existing] = await db
        .select({ id: emailApprovedSenders.id })
        .from(emailApprovedSenders)
        .where(
          and(
            eq(emailApprovedSenders.id, input.id),
            eq(emailApprovedSenders.userId, ctx.user.id)
          )
        );

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Approved sender not found",
        });
      }

      // Verify property belongs to user if provided
      if (input.defaultPropertyId) {
        const [property] = await db
          .select({ id: properties.id })
          .from(properties)
          .where(
            and(
              eq(properties.id, input.defaultPropertyId),
              eq(properties.userId, ctx.user.id)
            )
          );

        if (!property) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Property not found",
          });
        }
      }

      const [updated] = await db
        .update(emailApprovedSenders)
        .set({
          label: input.label,
          defaultPropertyId: input.defaultPropertyId,
        })
        .where(eq(emailApprovedSenders.id, input.id))
        .returning();

      return updated;
    }),

  /**
   * Deletes an approved sender.
   */
  delete: proProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await db
        .select({ id: emailApprovedSenders.id })
        .from(emailApprovedSenders)
        .where(
          and(
            eq(emailApprovedSenders.id, input.id),
            eq(emailApprovedSenders.userId, ctx.user.id)
          )
        );

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Approved sender not found",
        });
      }

      await db
        .delete(emailApprovedSenders)
        .where(eq(emailApprovedSenders.id, input.id));

      return { success: true };
    }),
});
