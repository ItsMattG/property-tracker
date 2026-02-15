import { z } from "zod";
import { cookies } from "next/headers";
import { router, protectedProcedure } from "../../trpc";
import {
  entities,
  trustDetails,
  smsfDetails,
  entityMembers,
  properties,
} from "../../db/schema";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

const createEntitySchema = z.object({
  type: z.enum(["personal", "trust", "smsf", "company"]),
  name: z.string().min(1, "Name is required"),
  abn: z.string().optional(),
  tfn: z.string().optional(),
  trustDetails: z
    .object({
      trusteeType: z.enum(["individual", "corporate"]),
      trusteeName: z.string().min(1),
      settlementDate: z.string().optional(),
      trustDeedDate: z.string().optional(),
    })
    .optional(),
  smsfDetails: z
    .object({
      fundName: z.string().min(1),
      fundAbn: z.string().optional(),
      establishmentDate: z.string().optional(),
      auditorName: z.string().optional(),
      auditorContact: z.string().optional(),
    })
    .optional(),
});

export const entityRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    // Get entities user owns + memberships in parallel
    const [ownedEntities, memberships] = await Promise.all([
      ctx.db.query.entities.findMany({
        where: eq(entities.userId, ctx.user.id),
        with: {
          trustDetails: true,
          smsfDetails: true,
        },
      }),
      ctx.db.query.entityMembers.findMany({
        where: eq(entityMembers.userId, ctx.user.id),
        with: {
          entity: {
            with: {
              trustDetails: true,
              smsfDetails: true,
            },
          },
        },
      }),
    ]);

    const memberEntities = memberships
      .filter((m) => m.joinedAt !== null)
      .map((m) => ({ ...m.entity, role: m.role }));

    return [
      ...ownedEntities.map((e) => ({ ...e, role: "owner" as const })),
      ...memberEntities,
    ];
  }),

  get: protectedProcedure
    .input(z.object({ entityId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const entity = await ctx.db.query.entities.findFirst({
        where: eq(entities.id, input.entityId),
        with: {
          trustDetails: true,
          smsfDetails: true,
          members: {
            with: {
              user: true,
            },
          },
        },
      });

      if (!entity) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Entity not found",
        });
      }

      // Check access
      const isOwner = entity.userId === ctx.user.id;
      const membership = entity.members.find((m) => m.userId === ctx.user.id);

      if (!isOwner && (!membership || !membership.joinedAt)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have access to this entity",
        });
      }

      return entity;
    }),

  create: protectedProcedure
    .input(createEntitySchema)
    .mutation(async ({ ctx, input }) => {
      const {
        trustDetails: trustInput,
        smsfDetails: smsfInput,
        ...entityData
      } = input;

      // Validate type-specific details
      if (input.type === "trust" && !trustInput) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Trust details required for trust entities",
        });
      }

      if (input.type === "smsf" && !smsfInput) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "SMSF details required for SMSF entities",
        });
      }

      // Create entity
      const [entity] = await ctx.db
        .insert(entities)
        .values({
          userId: ctx.user.id,
          ...entityData,
        })
        .returning();

      // Create type-specific details
      if (input.type === "trust" && trustInput) {
        await ctx.db.insert(trustDetails).values({
          entityId: entity.id,
          ...trustInput,
        });
      }

      if (input.type === "smsf" && smsfInput) {
        await ctx.db.insert(smsfDetails).values({
          entityId: entity.id,
          ...smsfInput,
        });
      }

      return entity;
    }),

  update: protectedProcedure
    .input(
      z.object({
        entityId: z.string().uuid(),
        name: z.string().min(1).optional(),
        abn: z.string().optional(),
        tfn: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { entityId, ...updateData } = input;

      // Verify ownership
      const entity = await ctx.db.query.entities.findFirst({
        where: and(eq(entities.id, entityId), eq(entities.userId, ctx.user.id)),
      });

      if (!entity) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Entity not found or you do not have permission",
        });
      }

      const [updated] = await ctx.db
        .update(entities)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .where(eq(entities.id, entityId))
        .returning();

      return updated;
    }),

  delete: protectedProcedure
    .input(z.object({ entityId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const entity = await ctx.db.query.entities.findFirst({
        where: and(
          eq(entities.id, input.entityId),
          eq(entities.userId, ctx.user.id)
        ),
      });

      if (!entity) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Entity not found or you do not have permission",
        });
      }

      // Check for properties
      const propertyCount = await ctx.db.query.properties.findMany({
        where: eq(properties.entityId, input.entityId),
      });

      if (propertyCount.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Cannot delete entity with properties. Transfer or delete properties first.",
        });
      }

      await ctx.db.delete(entities).where(eq(entities.id, input.entityId));

      return { success: true };
    }),

  getActive: protectedProcedure.query(async ({ ctx }) => {
    // Get from cookie or return first owned entity
    const cookieStore = await cookies();
    const activeEntityId = cookieStore.get("active_entity_id")?.value;

    if (activeEntityId) {
      const entity = await ctx.db.query.entities.findFirst({
        where: eq(entities.id, activeEntityId),
        with: {
          trustDetails: true,
          smsfDetails: true,
        },
      });

      if (entity) {
        // Verify access
        const isOwner = entity.userId === ctx.user.id;
        if (isOwner) return entity;

        const membership = await ctx.db.query.entityMembers.findFirst({
          where: and(
            eq(entityMembers.entityId, activeEntityId),
            eq(entityMembers.userId, ctx.user.id)
          ),
        });

        if (membership?.joinedAt) return entity;
      }
    }

    // Return first owned entity or null
    const firstEntity = await ctx.db.query.entities.findFirst({
      where: eq(entities.userId, ctx.user.id),
      with: {
        trustDetails: true,
        smsfDetails: true,
      },
    });

    return firstEntity || null;
  }),
});
