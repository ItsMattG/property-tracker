"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Check, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import type { StepStatus } from "@/server/services/onboarding";

interface SetupChecklistProps {
  progress: {
    completed: number;
    total: number;
    steps: StepStatus[];
  };
}

export function SetupChecklist({ progress }: SetupChecklistProps) {
  const utils = trpc.useUtils();

  const dismissChecklist = trpc.onboarding.dismissChecklist.useMutation({
    onSuccess: () => {
      utils.onboarding.getProgress.invalidate();
    },
  });

  const progressPercent = (progress.completed / progress.total) * 100;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Setup Progress</CardTitle>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => dismissChecklist.mutate()}
            aria-label="Dismiss setup checklist"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          {progress.completed} of {progress.total} complete
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <Progress value={progressPercent} className="h-2" aria-label="Setup progress" />

        <div className="space-y-2">
          {progress.steps.map((step) => (
            <ChecklistItem key={step.id} step={step} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ChecklistItem({ step }: { step: StepStatus }) {
  return (
    <Link
      href={step.actionLink}
      prefetch={false}
      className={cn(
        "flex items-center justify-between p-2 rounded-md hover:bg-muted transition-colors",
        step.isComplete && "opacity-60"
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "w-5 h-5 rounded-full border-2 flex items-center justify-center",
            step.isComplete
              ? "border-green-600 bg-green-600"
              : "border-muted-foreground"
          )}
        >
          {step.isComplete && <Check className="w-3 h-3 text-white" />}
        </div>
        <span
          className={cn(
            "text-sm",
            step.isComplete && "line-through text-muted-foreground"
          )}
        >
          {step.label}
        </span>
      </div>
      {!step.isComplete && (
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
      )}
    </Link>
  );
}
