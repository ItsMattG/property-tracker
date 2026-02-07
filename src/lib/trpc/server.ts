import { appRouter } from "@/server/routers/_app";
import { createCallerFactory } from "@/server/trpc";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/server/db";

const createCaller = createCallerFactory(appRouter);

export async function getServerTRPC() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  return createCaller({
    db,
    userId: session?.user?.id ?? null,
    portfolioOwnerId: undefined,
    headers: undefined,
    requestId: undefined,
  });
}
