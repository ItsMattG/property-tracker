import { router } from "../trpc";
import { propertyRouter } from "./property";
import { transactionRouter } from "./transaction";
import { bankingRouter } from "./banking";
import { statsRouter } from "./stats";
import { loanRouter } from "./loan";

export const appRouter = router({
  property: propertyRouter,
  transaction: transactionRouter,
  banking: bankingRouter,
  stats: statsRouter,
  loan: loanRouter,
});

export type AppRouter = typeof appRouter;
