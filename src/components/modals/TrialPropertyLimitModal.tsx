"use client";

import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface TrialPropertyLimitModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  trialEndsAt: Date;
  isLoading?: boolean;
  firstPropertyAddress?: string;
}

export function TrialPropertyLimitModal({
  open,
  onOpenChange,
  onConfirm,
  trialEndsAt,
  isLoading,
  firstPropertyAddress,
}: TrialPropertyLimitModalProps) {
  const trialEndDate = format(trialEndsAt, "MMMM d, yyyy");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adding your 2nd property</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-3 pt-2">
              <p>
                Great news - your Pro trial lets you track unlimited properties!
              </p>
              <p>
                Just a heads up: after your trial ends on{" "}
                <strong>{trialEndDate}</strong>, only{" "}
                <strong>{firstPropertyAddress ?? "your first property"}</strong>{" "}
                stays active. The rest become dormant (data preserved, just view-only).
              </p>
              <p>You can upgrade anytime to keep everything active.</p>
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" asChild>
            <Link href="/settings/billing" target="_blank">
              View Pro pricing
            </Link>
          </Button>
          <Button onClick={onConfirm} disabled={isLoading}>
            {isLoading ? "Adding..." : "Got it, add property"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
