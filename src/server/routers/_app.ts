import { router } from "../trpc";
import { propertyRouter } from "./property";
import { transactionRouter } from "./transaction";
import { bankingRouter } from "./banking";
import { statsRouter } from "./stats";

export const appRouter = router({
  property: propertyRouter,
  transaction: transactionRouter,
  banking: bankingRouter,
  stats: statsRouter,
});

export type AppRouter = typeof appRouter;
