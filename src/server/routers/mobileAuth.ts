import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure } from "../trpc";
import { users, pushTokens } from "../db/schema";
import { eq, and } from "drizzle-orm";
import bcrypt from "bcryptjs";
import {
  verifyMobileToken,
  signMobileToken,
  type MobileJwtPayload,
} from "../lib/mobile-jwt";

export const mobileAuthRouter = router({
  // Login with email/password
  login: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.query.users.findFirst({
        where: eq(users.email, input.email.toLowerCase().trim()),
      });

      if (!user || !user.mobilePasswordHash) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid email or password",
        });
      }

      const validPassword = await bcrypt.compare(
        input.password,
        user.mobilePasswordHash
      );

      if (!validPassword) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid email or password",
        });
      }

      const token = signMobileToken({ userId: user.id, email: user.email });

      return {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
      };
    }),

  // Register push token
  registerDevice: publicProcedure
    .input(
      z.object({
        token: z.string().min(1),
        pushToken: z.string().min(1),
        platform: z.enum(["ios", "android"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify JWT
      let payload: MobileJwtPayload;
      try {
        payload = verifyMobileToken(input.token);
      } catch {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid token",
        });
      }

      // Upsert push token
      const existing = await ctx.db.query.pushTokens.findFirst({
        where: eq(pushTokens.token, input.pushToken),
      });

      if (existing) {
        if (existing.userId !== payload.userId) {
          await ctx.db
            .update(pushTokens)
            .set({ userId: payload.userId })
            .where(eq(pushTokens.id, existing.id));
        }
        return { success: true };
      }

      await ctx.db.insert(pushTokens).values({
        userId: payload.userId,
        token: input.pushToken,
        platform: input.platform,
      });

      return { success: true };
    }),

  // Unregister push token
  unregisterDevice: publicProcedure
    .input(
      z.object({
        token: z.string().min(1),
        pushToken: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      let payload: MobileJwtPayload;
      try {
        payload = verifyMobileToken(input.token);
      } catch {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid token",
        });
      }

      await ctx.db
        .delete(pushTokens)
        .where(
          and(
            eq(pushTokens.userId, payload.userId),
            eq(pushTokens.token, input.pushToken)
          )
        );

      return { success: true };
    }),

  // Verify token is still valid
  verify: publicProcedure
    .input(z.object({ token: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      try {
        const payload = verifyMobileToken(input.token);
        const user = await ctx.db.query.users.findFirst({
          where: eq(users.id, payload.userId),
        });

        if (!user) {
          return { valid: false, user: null };
        }

        return {
          valid: true,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
          },
        };
      } catch {
        return { valid: false, user: null };
      }
    }),
});
