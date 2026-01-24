import { router } from "../trpc";
import { propertyRouter } from "./property";
import { transactionRouter } from "./transaction";
import { bankingRouter } from "./banking";
import { statsRouter } from "./stats";
import { loanRouter } from "./loan";
import { reportsRouter } from "./reports";
import { cgtRouter } from "./cgt";
import { documentsRouter } from "./documents";
import { recurringRouter } from "./recurring";
import { propertyValueRouter } from "./propertyValue";
import { portfolioRouter } from "./portfolio";
import { onboardingRouter } from "./onboarding";
import { anomalyRouter } from "./anomaly";
import { forecastRouter } from "./forecast";
import { notificationRouter } from "./notification";

export const appRouter = router({
  property: propertyRouter,
  transaction: transactionRouter,
  banking: bankingRouter,
  stats: statsRouter,
  loan: loanRouter,
  reports: reportsRouter,
  cgt: cgtRouter,
  documents: documentsRouter,
  recurring: recurringRouter,
  propertyValue: propertyValueRouter,
  portfolio: portfolioRouter,
  onboarding: onboardingRouter,
  anomaly: anomalyRouter,
  forecast: forecastRouter,
  notification: notificationRouter,
});

export type AppRouter = typeof appRouter;
