import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ConfidenceBadgeProps {
  confidence: number;
  showValue?: boolean;
  size?: "sm" | "md";
}

export function ConfidenceBadge({
  confidence,
  showValue = false,
  size = "md",
}: ConfidenceBadgeProps) {
  const getColor = () => {
    if (confidence >= 85) return "bg-green-500";
    if (confidence >= 60) return "bg-yellow-500";
    return "bg-red-500";
  };

  const getLabel = () => {
    if (confidence >= 85) return "High confidence";
    if (confidence >= 60) return "Medium confidence";
    return "Low confidence";
  };

  const dotSize = size === "sm" ? "w-2 h-2" : "w-3 h-3";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-2 cursor-default" aria-label={getLabel()}>
          <span className={cn("rounded-full", dotSize, getColor())} />
          {showValue && (
            <span className="text-xs text-muted-foreground">{confidence.toFixed(0)}%</span>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent>{getLabel()} — {confidence.toFixed(0)}% sure</TooltipContent>
    </Tooltip>
  );
}
