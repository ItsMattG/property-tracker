export interface OnboardingStep {
  id: string;
  label: string;
  actionLink: string;
  threshold: number;
  countKey: keyof OnboardingCounts;
}

export interface OnboardingCounts {
  propertyCount: number;
  bankAccountCount: number;
  categorizedCount: number;
  recurringCount: number;
  propertyValueCount: number;
}

export interface StepStatus {
  id: string;
  label: string;
  isComplete: boolean;
  actionLink: string;
}

export interface OnboardingProgress {
  completed: number;
  total: number;
  steps: StepStatus[];
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: "add_property",
    label: "Add a property",
    actionLink: "/properties/new",
    threshold: 1,
    countKey: "propertyCount",
  },
  {
    id: "connect_bank",
    label: "Connect your bank",
    actionLink: "/banking/connect",
    threshold: 1,
    countKey: "bankAccountCount",
  },
  {
    id: "categorize_10",
    label: "Categorize 10 transactions",
    actionLink: "/transactions",
    threshold: 10,
    countKey: "categorizedCount",
  },
  {
    id: "setup_recurring",
    label: "Set up recurring transaction",
    actionLink: "/properties",
    threshold: 1,
    countKey: "recurringCount",
  },
  {
    id: "add_property_value",
    label: "Add property value estimate",
    actionLink: "/portfolio",
    threshold: 1,
    countKey: "propertyValueCount",
  },
];

export function isStepComplete(
  stepId: string,
  counts: Partial<OnboardingCounts>
): boolean {
  const step = ONBOARDING_STEPS.find((s) => s.id === stepId);
  if (!step) return false;
  const count = counts[step.countKey] ?? 0;
  return count >= step.threshold;
}

export function getStepStatus(
  stepId: string,
  counts: Partial<OnboardingCounts>
): StepStatus {
  const step = ONBOARDING_STEPS.find((s) => s.id === stepId);
  if (!step) {
    return { id: stepId, label: "", isComplete: false, actionLink: "" };
  }
  return {
    id: step.id,
    label: step.label,
    isComplete: isStepComplete(stepId, counts),
    actionLink: step.actionLink,
  };
}

export function calculateProgress(counts: OnboardingCounts): OnboardingProgress {
  const steps = ONBOARDING_STEPS.map((step) => getStepStatus(step.id, counts));
  const completed = steps.filter((s) => s.isComplete).length;
  return {
    completed,
    total: ONBOARDING_STEPS.length,
    steps,
  };
}
