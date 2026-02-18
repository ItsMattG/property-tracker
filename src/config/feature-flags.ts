/**
 * Feature flags for MVP release.
 *
 * Set a flag to `true` to enable the feature in the sidebar and allow
 * direct URL access.  Set to `false` to hide from the UI and redirect
 * any direct navigation to /dashboard.
 */
export const featureFlags = {
  // ── Main navigation ───────────────────────────────────────────────
  discover: false,
  alerts: false,
  portfolio: false,
  forecast: false,
  cashFlow: true,
  portfolioShares: false,
  compliance: false,
  brokerPortal: false,
  mytaxExport: false,
  loans: true,
  compareLoans: true,
  export: true,
  emails: false,
  tasks: false,

  // ── Settings ──────────────────────────────────────────────────────
  propertyGroups: true,
  notifications: false,
  integrations: false,
  loanPacks: false,
  featureRequests: false,
  advisors: false,
  referrals: false,
  refinanceAlerts: false,
  emailConnections: false,
  mobileApp: false,
  team: false,
  auditLog: false,
  supportAdmin: false,
  bugReports: false,
  support: false,

  // ── Property detail sections ────────────────────────────────────
  valuation: true,
  climateRisk: false,
  milestones: true,
  performanceBenchmark: false,
  similarProperties: true,

  // ── Property features ──────────────────────────────────────────────
  documents: true,

  // ── Other UI ──────────────────────────────────────────────────────
  fySelector: false,
  aiAssistant: true,
  whatsNew: false,
  helpMenu: false,
  quickAdd: false,
} as const;

export type FeatureFlag = keyof typeof featureFlags;

/** Map of route prefixes to their feature flag. */
export const routeToFlag: Record<string, FeatureFlag> = {
  "/discover": "discover",
  "/alerts": "alerts",
  "/portfolio": "portfolio",
  "/reports/forecast": "forecast",
  "/reports/share": "portfolioShares",
  "/reports/compliance": "compliance",
  "/reports/brokers": "brokerPortal",
  "/reports/mytax": "mytaxExport",
  "/loans": "loans",
  "/export": "export",
  "/emails": "emails",
  "/tasks": "tasks",
  "/cash-flow": "cashFlow",
  "/settings/property-groups": "propertyGroups",
  "/settings/notifications": "notifications",
  "/settings/integrations": "integrations",
  "/settings/loan-packs": "loanPacks",
  "/settings/feature-requests": "featureRequests",
  "/settings/advisors": "advisors",
  "/settings/referrals": "referrals",
  "/settings/refinance-alerts": "refinanceAlerts",
  "/settings/email-connections": "emailConnections",
  "/settings/mobile": "mobileApp",
  "/settings/team": "team",
  "/settings/audit-log": "auditLog",
  "/settings/support-admin": "supportAdmin",
  "/settings/bug-reports": "bugReports",
  "/settings/support": "support",
};

/**
 * Returns true if the given pathname is gated behind a disabled feature flag.
 * Checks route prefixes so /loans/compare is caught by the "/loans" prefix.
 */
export function isRouteGated(pathname: string): boolean {
  // Sort by longest prefix first so /reports/share matches before /reports
  const prefixes = Object.keys(routeToFlag).sort(
    (a, b) => b.length - a.length
  );
  for (const prefix of prefixes) {
    if (pathname === prefix || pathname.startsWith(prefix + "/")) {
      const flag = routeToFlag[prefix];
      return !featureFlags[flag];
    }
  }
  return false;
}
