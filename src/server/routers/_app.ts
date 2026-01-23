import { router } from "../trpc";
import { propertyRouter } from "./property";
import { transactionRouter } from "./transaction";
import { bankingRouter } from "./banking";

export const appRouter = router({
  property: propertyRouter,
  transaction: transactionRouter,
  banking: bankingRouter,
});

export type AppRouter = typeof appRouter;
