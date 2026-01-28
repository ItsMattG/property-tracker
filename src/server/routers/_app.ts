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
import { performanceBenchmarkingRouter } from "./performanceBenchmarking";
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
import { brokerRouter } from "./broker";
import { benchmarkingRouter } from "./benchmarking";
import { entityRouter } from "./entity";
import { smsfComplianceRouter } from "./smsfCompliance";
import { trustComplianceRouter } from "./trustCompliance";
import { mobileAuthRouter } from "./mobileAuth";
import { userRouter } from "./user";
import { milestonePreferencesRouter } from "./milestonePreferences";
import { taxPositionRouter } from "./taxPosition";
import { similarPropertiesRouter } from "./similarProperties";
import { feedbackRouter } from "./feedback";
import { changelogRouter } from "./changelog";
import { blogRouter } from "./blog";
import { emailRouter } from "./email";
import { taskRouter } from "./task";
import { chatRouter } from "./chat";
import { mytaxRouter } from "./mytax";
import { taxForecastRouter } from "./taxForecast";
import { yoyComparisonRouter } from "./yoyComparison";
import { auditChecksRouter } from "./auditChecks";
import { supportTicketsRouter } from "./supportTickets";
import { referralRouter } from "./referral";
import { billingRouter } from "./billing";
import { rentalYieldRouter } from "./rentalYield";
import { settlementRouter } from "./settlement";

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
  performanceBenchmarking: performanceBenchmarkingRouter,
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
  broker: brokerRouter,
  benchmarking: benchmarkingRouter,
  entity: entityRouter,
  smsfCompliance: smsfComplianceRouter,
  trustCompliance: trustComplianceRouter,
  mobileAuth: mobileAuthRouter,
  user: userRouter,
  milestonePreferences: milestonePreferencesRouter,
  taxPosition: taxPositionRouter,
  similarProperties: similarPropertiesRouter,
  feedback: feedbackRouter,
  changelog: changelogRouter,
  blog: blogRouter,
  email: emailRouter,
  task: taskRouter,
  chat: chatRouter,
  mytax: mytaxRouter,
  taxForecast: taxForecastRouter,
  yoyComparison: yoyComparisonRouter,
  auditChecks: auditChecksRouter,
  supportTickets: supportTicketsRouter,
  referral: referralRouter,
  billing: billingRouter,
  rentalYield: rentalYieldRouter,
  settlement: settlementRouter,
});

export type AppRouter = typeof appRouter;
