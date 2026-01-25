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
import { teamRouter } from "./team";
import { categorizationRouter } from "./categorization";
import { taxOptimizationRouter } from "./taxOptimization";
import { loanComparisonRouter } from "./loanComparison";
import { documentExtractionRouter } from "./documentExtraction";
import { propertyManagerRouter } from "./propertyManager";
import { scenarioRouter } from "./scenario";
import { shareRouter } from "./share";
import { complianceRouter } from "./compliance";
import { loanPackRouter } from "./loanPack";

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
  team: teamRouter,
  categorization: categorizationRouter,
  taxOptimization: taxOptimizationRouter,
  loanComparison: loanComparisonRouter,
  documentExtraction: documentExtractionRouter,
  propertyManager: propertyManagerRouter,
  scenario: scenarioRouter,
  share: shareRouter,
  compliance: complianceRouter,
  loanPack: loanPackRouter,
});

export type AppRouter = typeof appRouter;
