/**
 * Compliance requirements configuration for Australian rental properties.
 * State-specific requirements for recurring inspections.
 */

export type AustralianState = "VIC" | "NSW" | "QLD" | "SA" | "WA" | "TAS" | "NT" | "ACT";

export interface ComplianceRequirement {
  id: string;
  name: string;
  description: string;
  frequencyMonths: number;
  legislationUrl?: string;
}

/**
 * All unique compliance requirements across Australian states.
 */
export const ALL_REQUIREMENTS: ComplianceRequirement[] = [
  {
    id: "smoke_alarm",
    name: "Smoke Alarm Check",
    description:
      "Annual inspection and testing of smoke alarms to ensure they are functional and compliant with current regulations.",
    frequencyMonths: 12,
    legislationUrl: "https://www.fire.nsw.gov.au/page.php?id=293",
  },
  {
    id: "gas_safety",
    name: "Gas Safety Check",
    description:
      "Inspection of gas appliances and installations by a licensed gas fitter to ensure safety compliance.",
    frequencyMonths: 24,
    legislationUrl: "https://www.esv.vic.gov.au/gas-safety-checks",
  },
  {
    id: "electrical_safety",
    name: "Electrical Safety Check",
    description:
      "Inspection of electrical installations by a licensed electrician to identify potential hazards.",
    frequencyMonths: 24,
    legislationUrl:
      "https://www.qld.gov.au/housing/renting/renting-a-property-in-queensland/tenant-and-landlord-responsibilities/electrical-safety",
  },
  {
    id: "pool_safety",
    name: "Pool Safety Certificate",
    description:
      "Inspection of pool barriers and safety features to ensure compliance with pool safety standards.",
    frequencyMonths: 12,
    legislationUrl: "https://www.qbcc.qld.gov.au/homeowners/pool-safety",
  },
];

/**
 * State-specific compliance requirements mapping.
 * Each state has different legislative requirements for rental properties.
 */
const STATE_REQUIREMENTS: Record<AustralianState, string[]> = {
  VIC: ["smoke_alarm", "gas_safety", "electrical_safety", "pool_safety"],
  NSW: ["smoke_alarm", "pool_safety"],
  QLD: ["smoke_alarm", "electrical_safety", "pool_safety"],
  SA: ["smoke_alarm"],
  WA: ["smoke_alarm", "pool_safety"],
  TAS: ["smoke_alarm"],
  NT: ["smoke_alarm"],
  ACT: ["smoke_alarm"],
};

/**
 * State-specific frequency overrides where different from the default.
 * Key format: `${state}_${requirementId}`
 */
const FREQUENCY_OVERRIDES: Record<string, number> = {
  // VIC uses defaults (smoke: 12, gas: 24, electrical: 24, pool: 36)
  VIC_pool_safety: 36,
  // NSW uses defaults (smoke: 12, pool: 36)
  NSW_pool_safety: 36,
  // QLD has stricter pool safety (every 12 months) - already default
  // WA has longer pool safety interval (48 months)
  WA_pool_safety: 48,
};

/**
 * Get compliance requirements for a specific Australian state.
 * Returns requirements with state-specific frequency adjustments where applicable.
 */
export function getRequirementsForState(state: AustralianState): ComplianceRequirement[] {
  const requirementIds = STATE_REQUIREMENTS[state];

  return requirementIds
    .map((id) => {
      const requirement = ALL_REQUIREMENTS.find((r) => r.id === id);
      if (!requirement) return null;

      // Check for state-specific frequency override
      const overrideKey = `${state}_${id}`;
      const frequencyOverride = FREQUENCY_OVERRIDES[overrideKey];

      if (frequencyOverride !== undefined) {
        return {
          ...requirement,
          frequencyMonths: frequencyOverride,
        };
      }

      return requirement;
    })
    .filter((r): r is ComplianceRequirement => r !== null);
}

/**
 * Get a specific requirement by its ID.
 * Returns undefined if the requirement doesn't exist.
 */
export function getRequirementById(id: string): ComplianceRequirement | undefined {
  return ALL_REQUIREMENTS.find((r) => r.id === id);
}
