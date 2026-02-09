"use client";

import { Badge } from "@/components/ui/badge";
import { classifyProperty, getPerformanceBadgeConfig } from "@/lib/property-classification";
import type { ClassificationInput } from "@/lib/property-classification";

interface PerformanceBadgeProps {
  metrics: ClassificationInput;
}

export function PerformanceBadge({ metrics }: PerformanceBadgeProps) {
  const classification = classifyProperty(metrics);
  if (!classification) return null;

  const config = getPerformanceBadgeConfig(classification);

  return (
    <Badge
      variant={config.variant}
      className={config.className}
      data-testid="performance-badge"
    >
      {config.label}
    </Badge>
  );
}
