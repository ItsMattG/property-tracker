import { z } from "zod";
import { cookies } from "next/headers";
import { router, protectedProcedure } from "../../trpc";
import { entities, entityMembers, properties } from "../../db/schema";
import { eq } from "drizzle-orm";
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
      ctx.uow.compliance.findEntitiesByUser(ctx.user.id),
      // Cross-domain: membership query spans entity + user domains; no "find all memberships for user" repo method
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
      // Cross-domain: loads entity with user details for members (members.user relation not in compliance repo)
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
      const entity = await ctx.uow.compliance.createEntity({
        userId: ctx.user.id,
        ...entityData,
      });

      // Create type-specific details
      if (input.type === "trust" && trustInput) {
        await ctx.uow.compliance.createTrustDetails({
          entityId: entity.id,
          ...trustInput,
        });
      }

      if (input.type === "smsf" && smsfInput) {
        await ctx.uow.compliance.createSmsfDetails({
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
      const entity = await ctx.uow.compliance.findEntityById(entityId, ctx.user.id);

      if (!entity) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Entity not found or you do not have permission",
        });
      }

      return ctx.uow.compliance.updateEntity(entityId, ctx.user.id, {
        ...updateData,
        updatedAt: new Date(),
      });
    }),

  delete: protectedProcedure
    .input(z.object({ entityId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const entity = await ctx.uow.compliance.findEntityById(input.entityId, ctx.user.id);

      if (!entity) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Entity not found or you do not have permission",
        });
      }

      // Cross-domain: check property references before deleting entity
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

      await ctx.uow.compliance.deleteEntity(input.entityId, ctx.user.id);

      return { success: true };
    }),

  getActive: protectedProcedure.query(async ({ ctx }) => {
    // Get from cookie or return first owned entity
    const cookieStore = await cookies();
    const activeEntityId = cookieStore.get("active_entity_id")?.value;

    if (activeEntityId) {
      // Try ownership first via repo (scoped by userId)
      const ownedEntity = await ctx.uow.compliance.findEntityById(activeEntityId, ctx.user.id);
      if (ownedEntity) return ownedEntity;

      // Cross-domain: entity access check spans ownership + membership
      const membership = await ctx.uow.compliance.findEntityMemberByUser(activeEntityId, ctx.user.id);
      if (membership?.joinedAt) {
        // User is a member — load entity without user scoping via ctx.db
        const entity = await ctx.db.query.entities.findFirst({
          where: eq(entities.id, activeEntityId),
          with: {
            trustDetails: true,
            smsfDetails: true,
          },
        });
        if (entity) return entity;
      }
    }

    // Return first owned entity or null
    const ownedEntities = await ctx.uow.compliance.findEntitiesByUser(ctx.user.id);
    return ownedEntities[0] || null;
  }),
});
