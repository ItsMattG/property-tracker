"use client";

import { useState } from "react";
import { Trophy } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ConfettiCelebration } from "./ConfettiCelebration";
import { SharePrompt } from "@/components/referral/SharePrompt";
import type { MilestoneDefinition } from "@/server/services/milestone/types";

interface MilestoneModalProps {
  milestone: MilestoneDefinition | null;
  onDismiss: () => void;
}

export function MilestoneModal({ milestone, onDismiss }: MilestoneModalProps) {
  const [showSharePrompt, setShowSharePrompt] = useState(false);
  const [dismissedMilestoneLabel, setDismissedMilestoneLabel] = useState<
    string | null
  >(null);

  const handleDismiss = () => {
    if (milestone) {
      setDismissedMilestoneLabel(milestone.label);
      setShowSharePrompt(true);
    }
    onDismiss();
  };

  const handleShareDismiss = () => {
    setShowSharePrompt(false);
    setDismissedMilestoneLabel(null);
  };

  return (
    <>
      <ConfettiCelebration active={!!milestone} />
      <Dialog open={!!milestone} onOpenChange={(open) => !open && handleDismiss()}>
        <DialogContent className="text-center sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Trophy className="h-8 w-8 text-primary" />
            </div>
            <DialogTitle className="text-xl">
              {milestone?.label}
            </DialogTitle>
            <DialogDescription>
              {milestone?.description}
            </DialogDescription>
          </DialogHeader>
          <Button onClick={handleDismiss} className="mt-4">
            Continue
          </Button>
        </DialogContent>
      </Dialog>

      {showSharePrompt && dismissedMilestoneLabel && (
        <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-lg">
          <SharePrompt
            milestoneLabel={dismissedMilestoneLabel}
            onDismiss={handleShareDismiss}
          />
        </div>
      )}
    </>
  );
}
