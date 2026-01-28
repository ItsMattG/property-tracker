import { cn } from "@/lib/utils";

type Confidence = "high" | "medium" | "low";

const config: Record<Confidence, { label: string; className: string }> = {
  high: { label: "High", className: "bg-green-100 text-green-700" },
  medium: { label: "Medium", className: "bg-amber-100 text-amber-700" },
  low: { label: "Low", className: "bg-gray-100 text-gray-600" },
};

export function ConfidenceBadge({ confidence }: { confidence: Confidence }) {
  const { label, className } = config[confidence];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", {
        "bg-green-500": confidence === "high",
        "bg-amber-500": confidence === "medium",
        "bg-gray-400": confidence === "low",
      })} />
      {label} confidence
    </span>
  );
}
