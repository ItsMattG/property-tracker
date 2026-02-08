import { z } from "zod";
import { router, protectedProcedure, writeProcedure } from "../trpc";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

export const userRouter = router({
  // Check if user has mobile password set
  hasMobilePassword: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.db.query.users.findFirst({
      where: eq(users.id, ctx.user.id),
      columns: { mobilePasswordHash: true },
    });
    return !!user?.mobilePasswordHash;
  }),

  // Set or update mobile password
  setMobilePassword: writeProcedure
    .input(z.object({ password: z.string().min(8) }))
    .mutation(async ({ ctx, input }) => {
      const hash = await bcrypt.hash(input.password, 12);
      await ctx.db
        .update(users)
        .set({ mobilePasswordHash: hash })
        .where(eq(users.id, ctx.user.id));
      return { success: true };
    }),

  // Set user theme preference
  setTheme: protectedProcedure
    .input(z.object({
      theme: z.enum(["forest", "clean", "dark", "friendly", "bold", "ocean"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(users)
        .set({ theme: input.theme })
        .where(eq(users.id, ctx.user.id))
        .returning({ theme: users.theme });
      return { theme: updated.theme };
    }),
});
