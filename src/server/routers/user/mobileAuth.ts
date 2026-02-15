import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure } from "../../trpc";
import { users, pushTokens } from "../../db/schema";
import { eq, and } from "drizzle-orm";
import bcrypt from "bcryptjs";
import {
  verifyMobileToken,
  signMobileToken,
  getPasswordVersion,
  type MobileJwtPayload,
} from "../../lib/mobile-jwt";
import { authRateLimiter } from "../../middleware/rate-limit";

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
      // Rate limit login attempts by email to prevent brute-force
      const rateLimitKey = `login:${input.email.toLowerCase().trim()}`;
      const rateCheck = await authRateLimiter.check(rateLimitKey);
      if (!rateCheck.allowed) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Too many login attempts. Please try again later.",
        });
      }

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

      const token = signMobileToken({
        userId: user.id,
        email: user.email,
        pwv: getPasswordVersion(user.mobilePasswordHash),
      });

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

        // Check password version — reject if password was changed since token was issued
        if (payload.pwv && user.mobilePasswordHash) {
          const currentPwv = getPasswordVersion(user.mobilePasswordHash);
          if (payload.pwv !== currentPwv) {
            return { valid: false, user: null };
          }
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
