import { MILESTONES, type MilestoneContext, type MilestoneDefinition } from "./types";

/**
 * Compare current user context against all milestone definitions.
 * Returns only milestones that are newly achieved (not in previouslyAchieved).
 */
export function detectNewMilestones(
  context: MilestoneContext,
  previouslyAchieved: string[],
): MilestoneDefinition[] {
  const achievedSet = new Set(previouslyAchieved);
  return MILESTONES.filter(
    (m) => !achievedSet.has(m.id) && m.check(context),
  );
}
