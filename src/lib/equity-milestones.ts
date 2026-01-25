export const LVR_MILESTONES = [80, 60, 40, 20] as const;
export const EQUITY_MILESTONES = [100000, 250000, 500000, 1000000] as const;

export function formatMilestone(type: "lvr" | "equity_amount", value: number): string {
  if (type === "lvr") {
    return `${value}% LVR`;
  }
  const formatted = value >= 1000000
    ? `$${(value / 1000000).toFixed(value % 1000000 === 0 ? 0 : 1)}M`
    : `$${(value / 1000).toFixed(0)}k`;
  return `${formatted} equity`;
}

export function getMilestoneMessage(
  type: "lvr" | "equity_amount",
  value: number,
  address: string
): { title: string; body: string } {
  if (type === "lvr") {
    return {
      title: `Milestone reached: ${value}% LVR`,
      body: `${address} has reached ${value}% LVR - you now have ${100 - value}% equity!`,
    };
  }
  const formatted = value >= 1000000
    ? `$${(value / 1000000).toFixed(0)}M`
    : `$${value.toLocaleString()}`;
  return {
    title: `Milestone reached: ${formatted} equity`,
    body: `Congratulations! ${address} has crossed ${formatted} in equity!`,
  };
}
