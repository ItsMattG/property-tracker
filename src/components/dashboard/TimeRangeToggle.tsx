"use client";

import { cn } from "@/lib/utils";

const TIME_RANGES = [
  { label: "6M", months: 6 },
  { label: "12M", months: 12 },
  { label: "18M", months: 18 },
  { label: "24M", months: 24 },
] as const;

interface TimeRangeToggleProps {
  value: number;
  onChange: (months: number) => void;
}

export function TimeRangeToggle({ value, onChange }: TimeRangeToggleProps) {
  return (
    <div className="flex items-center gap-1 rounded-lg bg-muted p-0.5">
      {TIME_RANGES.map(({ label, months }) => (
        <button
          key={months}
          onClick={() => onChange(months)}
          className={cn(
            "px-2.5 py-1 text-xs font-medium rounded-md transition-all",
            value === months
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
