import { z } from "zod";
import { router, protectedProcedure, writeProcedure } from "../../trpc";
import bcrypt from "bcryptjs";

export const userRouter = router({
  // Check if user has mobile password set
  hasMobilePassword: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.uow.user.findById(ctx.user.id, {
      mobilePasswordHash: true,
    });
    return !!user?.mobilePasswordHash;
  }),

  // Set or update mobile password
  setMobilePassword: writeProcedure
    .input(z.object({ password: z.string().min(8) }))
    .mutation(async ({ ctx, input }) => {
      const hash = await bcrypt.hash(input.password, 12);
      await ctx.uow.user.update(ctx.user.id, { mobilePasswordHash: hash });
      return { success: true };
    }),

  // Set user theme preference
  setTheme: protectedProcedure
    .input(z.object({
      theme: z.enum(["forest", "dark", "system"]),
    }))
    .mutation(async ({ ctx, input }) => {
      await ctx.uow.user.update(ctx.user.id, { theme: input.theme });
      return { theme: input.theme };
    }),
});
