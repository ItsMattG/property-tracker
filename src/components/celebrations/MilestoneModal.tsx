"use client";

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
import type { MilestoneDefinition } from "@/server/services/milestone/types";

interface MilestoneModalProps {
  milestone: MilestoneDefinition | null;
  onDismiss: () => void;
}

export function MilestoneModal({ milestone, onDismiss }: MilestoneModalProps) {
  return (
    <>
      <ConfettiCelebration active={!!milestone} />
      <Dialog open={!!milestone} onOpenChange={(open) => !open && onDismiss()}>
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
          <Button onClick={onDismiss} className="mt-4">
            Continue
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
