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
// remaining flat imports (to be organized in subsequent batches)
import { statsRouter } from "./stats";
import { reportsRouter } from "./reports";
import { documentsRouter } from "./documents";
import { portfolioRouter } from "./portfolio";
import { onboardingRouter } from "./onboarding";
import { performanceBenchmarkingRouter } from "./performanceBenchmarking";
import { notificationRouter } from "./notification";
import { teamRouter } from "./team";
import { documentExtractionRouter } from "./documentExtraction";
import { scenarioRouter } from "./scenario";
import { shareRouter } from "./share";
import { complianceRouter } from "./compliance";
import { benchmarkingRouter } from "./benchmarking";
import { entityRouter } from "./entity";
import { smsfComplianceRouter } from "./smsfCompliance";
import { trustComplianceRouter } from "./trustCompliance";
import { mobileAuthRouter } from "./mobileAuth";
import { userRouter } from "./user";
import { milestonePreferencesRouter } from "./milestonePreferences";
import { feedbackRouter } from "./feedback";
import { changelogRouter } from "./changelog";
import { blogRouter } from "./blog";
import { emailRouter } from "./email";
import { emailConnectionRouter } from "./emailConnection";
import { emailSenderRouter } from "./emailSender";
import { taskRouter } from "./task";
import { chatRouter } from "./chat";
import { supportTicketsRouter } from "./supportTickets";
import { referralRouter } from "./referral";
import { billingRouter } from "./billing";
import { dashboardRouter } from "./dashboard";
import { activityRouter } from "./activity";

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
});

export type AppRouter = typeof appRouter;
