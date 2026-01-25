import { Badge } from "@/components/ui/badge";
import type { RiskLevel } from "@/types/climate-risk";
import { cn } from "@/lib/utils";

interface ClimateRiskBadgeProps {
  level: RiskLevel;
  showLow?: boolean;
  className?: string;
}

const riskConfig: Record<RiskLevel, { label: string; className: string }> = {
  low: {
    label: "Low",
    className: "bg-green-100 text-green-800 hover:bg-green-100",
  },
  medium: {
    label: "Medium",
    className: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100",
  },
  high: {
    label: "High",
    className: "bg-orange-100 text-orange-800 hover:bg-orange-100",
  },
  extreme: {
    label: "Extreme",
    className: "bg-red-100 text-red-800 hover:bg-red-100",
  },
};

export function ClimateRiskBadge({
  level,
  showLow = false,
  className,
}: ClimateRiskBadgeProps) {
  // Don't show badge for low risk unless explicitly requested
  if (level === "low" && !showLow) {
    return null;
  }

  const config = riskConfig[level];

  return (
    <Badge variant="secondary" className={cn(config.className, className)}>
      {config.label} Risk
    </Badge>
  );
}
