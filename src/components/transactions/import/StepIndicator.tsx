"use client";

import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Step {
  key: string;
  label: string;
}

interface StepIndicatorProps {
  steps: Step[];
  currentIndex: number;
}

export function StepIndicator({ steps, currentIndex }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-center gap-1">
      {steps.map((step, i) => (
        <div key={step.key} className="flex items-center gap-1">
          <div className="flex items-center gap-1.5">
            {i < currentIndex ? (
              <CheckCircle2 className="size-4 text-green-600 dark:text-green-500" />
            ) : (
              <div
                className={cn(
                  "size-2.5 rounded-full transition-colors",
                  i === currentIndex
                    ? "bg-primary"
                    : "bg-muted-foreground/30"
                )}
              />
            )}
            <span
              className={cn(
                "text-xs transition-colors",
                i === currentIndex
                  ? "font-medium text-foreground"
                  : i < currentIndex
                    ? "text-green-700 dark:text-green-400"
                    : "text-muted-foreground"
              )}
            >
              {step.label}
            </span>
          </div>

          {i < steps.length - 1 && (
            <div
              className={cn(
                "mx-2 h-px w-8 transition-colors",
                i < currentIndex
                  ? "bg-green-500/50"
                  : "bg-muted-foreground/20"
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}
