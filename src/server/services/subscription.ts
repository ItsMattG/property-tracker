export type Plan = "free" | "pro" | "team";

const PLAN_RANK: Record<Plan, number> = {
  free: 0,
  pro: 1,
  team: 2,
};

export const PLAN_LIMITS = {
  free: {
    maxProperties: 1,
    bankFeeds: false,
    export: false,
    emailForwarding: false,
    aiChat: false,
    teamMembers: false,
    advisorAccess: false,
    auditLog: false,
  },
  pro: {
    maxProperties: Infinity,
    bankFeeds: true,
    export: true,
    emailForwarding: true,
    aiChat: true,
    teamMembers: false,
    advisorAccess: false,
    auditLog: false,
  },
  team: {
    maxProperties: Infinity,
    bankFeeds: true,
    export: true,
    emailForwarding: true,
    aiChat: true,
    teamMembers: true,
    advisorAccess: true,
    auditLog: true,
  },
} as const;

interface SubscriptionInfo {
  plan: Plan;
  status: string;
  currentPeriodEnd: Date | null;
}

export function getPlanFromSubscription(sub: SubscriptionInfo | null): Plan {
  if (!sub) return "free";

  // Canceled but still within paid period
  if (sub.status === "canceled") {
    if (sub.currentPeriodEnd && sub.currentPeriodEnd > new Date()) {
      return sub.plan;
    }
    return "free";
  }

  if (sub.status === "active" || sub.status === "trialing") {
    return sub.plan;
  }

  return "free";
}

export function isPlanSufficient(
  currentPlan: Plan,
  requiredPlan: Plan
): boolean {
  return PLAN_RANK[currentPlan] >= PLAN_RANK[requiredPlan];
}
