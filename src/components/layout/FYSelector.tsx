"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFinancialYear } from "@/providers/FinancialYearProvider";
import { Calendar } from "lucide-react";

export function FYSelector() {
  const { selectedYear, setSelectedYear, fy, availableYears } = useFinancialYear();

  return (
    <Select
      value={String(selectedYear)}
      onValueChange={(val) => setSelectedYear(parseInt(val, 10))}
    >
      <SelectTrigger
        className="h-8 w-[130px] text-xs gap-1.5"
        aria-label="Financial year"
      >
        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
        <SelectValue>{fy.label}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {availableYears.map((fyOption) => (
          <SelectItem key={fyOption.year} value={String(fyOption.year)}>
            {fyOption.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
