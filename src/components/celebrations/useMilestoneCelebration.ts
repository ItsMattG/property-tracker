"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { trpc } from "@/lib/trpc/client";
import { detectNewMilestones } from "@/server/services/milestone/detector";
import type { MilestoneContext, MilestoneDefinition } from "@/server/services/milestone/types";
import { MILESTONES } from "@/server/services/milestone/types";

interface MilestoneCelebrationResult {
  /** The milestone currently being celebrated, or null */
  currentMilestone: MilestoneDefinition | null;
  /** Dismiss the current celebration and advance to the next (or close) */
  handleDismiss: () => void;
  /** Total number of defined milestones */
  totalMilestones: number;
  /** Number of milestones the user has achieved */
  achievedCount: number;
}

/**
 * Hook that detects new milestones from dashboard context and queues celebrations.
 * Shows one milestone modal at a time; on dismiss, records it and advances.
 */
export function useMilestoneCelebration(
  context: MilestoneContext | null,
): MilestoneCelebrationResult {
  const [queue, setQueue] = useState<MilestoneDefinition[]>([]);
  const [currentMilestone, setCurrentMilestone] = useState<MilestoneDefinition | null>(null);
  const hasCheckedRef = useRef(false);

  const { data: achievedIds } = trpc.milestonePreferences.getAchievedMilestones.useQuery(
    undefined,
    { staleTime: 60_000 },
  );

  const utils = trpc.useUtils();
  const recordMutation = trpc.milestonePreferences.recordAchievedMilestones.useMutation({
    onSuccess: () => {
      utils.milestonePreferences.getAchievedMilestones.invalidate();
    },
  });

  // Detect new milestones once both context and achieved data are available
  useEffect(() => {
    if (!context || achievedIds === undefined || hasCheckedRef.current) return;
    hasCheckedRef.current = true;

    const newMilestones = detectNewMilestones(context, achievedIds);
    if (newMilestones.length > 0) {
      setQueue(newMilestones.slice(1));
      setCurrentMilestone(newMilestones[0]);
    }
  }, [context, achievedIds]);

  const handleDismiss = useCallback(() => {
    if (currentMilestone) {
      // Record this milestone as achieved
      recordMutation.mutate({ milestoneIds: [currentMilestone.id] });
    }

    if (queue.length > 0) {
      setCurrentMilestone(queue[0]);
      setQueue((prev) => prev.slice(1));
    } else {
      setCurrentMilestone(null);
    }
  }, [currentMilestone, queue, recordMutation]);

  const achievedCount = achievedIds?.length ?? 0;

  return {
    currentMilestone,
    handleDismiss,
    totalMilestones: MILESTONES.length,
    achievedCount,
  };
}
