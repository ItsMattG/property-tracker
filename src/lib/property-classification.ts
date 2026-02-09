export type PerformanceClass =
  | "top-performer"
  | "growth-asset"
  | "performing"
  | "monitoring"
  | "underperforming";

export interface ClassificationInput {
  grossYield: number | null;
  cashFlow: number;
  capitalGrowthPercent: number;
  lvr: number | null;
  hasValue: boolean;
  annualIncome: number;
}

/**
 * Classify a property's performance based on financial metrics.
 * Returns null when there is insufficient data to classify.
 *
 * Priority order (first match wins):
 * 1. null — insufficient data
 * 2. underperforming — negative cash flow AND high leverage
 * 3. top-performer — strong yield AND positive cash flow
 * 4. growth-asset — significant capital appreciation
 * 5. monitoring — negative cash flow OR high leverage
 * 6. performing — everything else
 */
export function classifyProperty(m: ClassificationInput): PerformanceClass | null {
  if (!m.hasValue && m.annualIncome === 0) return null;

  if (m.cashFlow < 0 && m.lvr !== null && m.lvr > 80) return "underperforming";
  if (m.grossYield !== null && m.grossYield >= 5 && m.cashFlow >= 0) return "top-performer";
  if (m.capitalGrowthPercent >= 10) return "growth-asset";
  if (m.cashFlow < 0 || (m.lvr !== null && m.lvr > 80)) return "monitoring";

  return "performing";
}

interface BadgeConfig {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline" | "warning";
  className?: string;
}

export function getPerformanceBadgeConfig(classification: PerformanceClass): BadgeConfig {
  switch (classification) {
    case "top-performer":
      return {
        label: "Top Performer",
        variant: "default",
        className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-transparent",
      };
    case "growth-asset":
      return {
        label: "Growth Asset",
        variant: "default",
        className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-transparent",
      };
    case "performing":
      return {
        label: "Performing",
        variant: "secondary",
      };
    case "monitoring":
      return {
        label: "Monitoring",
        variant: "warning",
      };
    case "underperforming":
      return {
        label: "Underperforming",
        variant: "destructive",
      };
  }
}
