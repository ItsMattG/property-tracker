import { appRouter } from "@/server/routers/_app";
import { createCallerFactory } from "@/server/trpc";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db";

const createCaller = createCallerFactory(appRouter);

export async function getServerTRPC() {
  const { userId } = await auth();

  return createCaller({
    db,
    clerkId: userId,
    portfolioOwnerId: undefined,
    headers: undefined,
  });
}
