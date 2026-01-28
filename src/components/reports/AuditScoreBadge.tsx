"use client";

import { cn } from "@/lib/utils";

interface AuditScoreBadgeProps {
  score: number;
  size?: "sm" | "lg";
}

export function AuditScoreBadge({ score, size = "sm" }: AuditScoreBadgeProps) {
  const colorClass =
    score >= 80
      ? "bg-green-100 text-green-800 border-green-300"
      : score >= 50
        ? "bg-amber-100 text-amber-800 border-amber-300"
        : "bg-red-100 text-red-800 border-red-300";

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full border font-bold",
        colorClass,
        size === "lg" ? "h-16 w-16 text-2xl" : "h-8 w-8 text-xs",
      )}
    >
      {score}
    </span>
  );
}
