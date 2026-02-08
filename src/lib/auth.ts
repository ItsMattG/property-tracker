import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/server/db";
import { headers } from "next/headers";

export const auth = betterAuth({
  baseURL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ user, url }) => {
      console.log(`[Password Reset] User: ${user.email}, URL: ${url}`);
    },
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes
    },
  },
  user: {
    modelName: "users",
    additionalFields: {
      mobilePasswordHash: { type: "string", required: false, input: false },
      basiqUserId: { type: "string", required: false, input: false },
      pendingBankPropertyId: { type: "string", required: false, input: false },
      trialStartedAt: { type: "date", required: false, input: false },
      trialEndsAt: { type: "date", required: false, input: false },
      trialPlan: { type: "string", required: false, input: false },
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          // Set trial fields — replaces Clerk user.created webhook
          const now = new Date();
          const trialEnd = new Date(now);
          trialEnd.setDate(trialEnd.getDate() + 14);

          const { eq } = await import("drizzle-orm");
          const { users } = await import("@/server/db/schema");
          await db
            .update(users)
            .set({
              trialStartedAt: now,
              trialEndsAt: trialEnd,
              trialPlan: "pro",
            })
            .where(eq(users.id, user.id));

          // TODO: Send welcome email via sendEmailNotification()
        },
      },
    },
  },
});

export type Session = typeof auth.$Infer.Session;

/**
 * Get the current session from request headers.
 * Use in API routes and server components.
 */
export async function getAuthSession() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  return session;
}
