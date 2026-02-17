import { router } from "../trpc";
// property domain
import {
  propertyRouter,
  propertyValueRouter,
  propertyManagerRouter,
  cgtRouter,
  settlementRouter,
  rentalYieldRouter,
  similarPropertiesRouter,
} from "./property";
// banking domain
import {
  bankingRouter,
  transactionRouter,
  categorizationRouter,
  recurringRouter,
  anomalyRouter,
  auditChecksRouter,
  categorizationRulesRouter,
} from "./banking";
// lending domain
import {
  loanRouter,
  loanComparisonRouter,
  loanPackRouter,
  brokerRouter,
  forecastRouter,
  cashFlowCalendarRouter,
} from "./lending";
// tax domain
import {
  taxPositionRouter,
  taxForecastRouter,
  taxOptimizationRouter,
  mytaxRouter,
  yoyComparisonRouter,
} from "./tax";
// analytics domain
import {
  statsRouter,
  benchmarkingRouter,
  performanceBenchmarkingRouter,
  dashboardRouter,
  reportsRouter,
  accountantPackRouter,
} from "./analytics";
// compliance domain
import {
  complianceRouter,
  smsfComplianceRouter,
  trustComplianceRouter,
  entityRouter,
} from "./compliance";
// communication domain
import {
  emailRouter,
  emailConnectionRouter,
  emailSenderRouter,
  chatRouter,
  notificationRouter,
} from "./communication";
// portfolio domain
import {
  portfolioRouter,
  teamRouter,
  shareRouter,
} from "./portfolio";
// documents domain
import {
  documentsRouter,
  documentExtractionRouter,
} from "./documents";
// scenario domain
import { scenarioRouter } from "./scenario";
// user domain
import {
  userRouter,
  mobileAuthRouter,
  billingRouter,
  onboardingRouter,
  milestonePreferencesRouter,
  referralRouter,
  activityRouter,
} from "./user";
// feedback domain
import {
  feedbackRouter,
  supportTicketsRouter,
  changelogRouter,
  blogRouter,
  taskRouter,
} from "./feedback";
// budget domain
import { budgetRouter } from "./budget";

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
  emailConnection: emailConnectionRouter,
  emailSender: emailSenderRouter,
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
  dashboard: dashboardRouter,
  activity: activityRouter,
  cashFlowCalendar: cashFlowCalendarRouter,
  budget: budgetRouter,
  categorizationRules: categorizationRulesRouter,
  accountantPack: accountantPackRouter,
});

export type AppRouter = typeof appRouter;
