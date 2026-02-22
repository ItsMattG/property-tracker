"use client";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LayoutGrid, Table2, PieChart } from "lucide-react";

type ViewMode = "cards" | "table" | "aggregate";
type Period = "monthly" | "quarterly" | "annual";
type SortBy = "cashFlow" | "equity" | "lvr" | "alphabetical";

interface PortfolioToolbarProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  period: Period;
  onPeriodChange: (period: Period) => void;
  sortBy: SortBy;
  onSortByChange: (sortBy: SortBy) => void;
  stateFilter?: string;
  onStateFilterChange: (state: string | undefined) => void;
  statusFilter?: string;
  onStatusFilterChange: (status: string | undefined) => void;
}

const states = ["NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT"];

export function PortfolioToolbar({
  viewMode,
  onViewModeChange,
  period,
  onPeriodChange,
  sortBy,
  onSortByChange,
  stateFilter,
  onStateFilterChange,
  statusFilter,
  onStatusFilterChange,
}: PortfolioToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      {/* View Mode Toggle */}
      <div className="flex items-center gap-1 border rounded-lg p-1" role="group" aria-label="View mode">
        <Button
          variant={viewMode === "cards" ? "default" : "ghost"}
          size="sm"
          onClick={() => onViewModeChange("cards")}
          aria-label="Card view"
          aria-pressed={viewMode === "cards"}
        >
          <LayoutGrid className="w-4 h-4" />
        </Button>
        <Button
          variant={viewMode === "table" ? "default" : "ghost"}
          size="sm"
          onClick={() => onViewModeChange("table")}
          aria-label="Table view"
          aria-pressed={viewMode === "table"}
        >
          <Table2 className="w-4 h-4" />
        </Button>
        <Button
          variant={viewMode === "aggregate" ? "default" : "ghost"}
          size="sm"
          onClick={() => onViewModeChange("aggregate")}
          aria-label="Aggregate view"
          aria-pressed={viewMode === "aggregate"}
        >
          <PieChart className="w-4 h-4" />
        </Button>
      </div>

      {/* Period Selector */}
      <Select value={period} onValueChange={(v) => onPeriodChange(v as Period)}>
        <SelectTrigger className="w-full sm:w-[140px]">
          <SelectValue placeholder="Period" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="monthly">Monthly</SelectItem>
          <SelectItem value="quarterly">Quarterly</SelectItem>
          <SelectItem value="annual">Annual</SelectItem>
        </SelectContent>
      </Select>

      {/* Sort By */}
      {viewMode !== "aggregate" && (
        <Select value={sortBy} onValueChange={(v) => onSortByChange(v as SortBy)}>
          <SelectTrigger className="w-full sm:w-[140px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="alphabetical">A-Z</SelectItem>
            <SelectItem value="cashFlow">Cash Flow</SelectItem>
            <SelectItem value="equity">Equity</SelectItem>
            <SelectItem value="lvr">LVR</SelectItem>
          </SelectContent>
        </Select>
      )}

      {/* State Filter */}
      <Select
        value={stateFilter || "all"}
        onValueChange={(v) => onStateFilterChange(v === "all" ? undefined : v)}
      >
        <SelectTrigger className="w-full sm:w-[120px]">
          <SelectValue placeholder="State" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All States</SelectItem>
          {states.map((state) => (
            <SelectItem key={state} value={state}>
              {state}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Status Filter */}
      <Select
        value={statusFilter || "all"}
        onValueChange={(v) => onStatusFilterChange(v === "all" ? undefined : v)}
      >
        <SelectTrigger className="w-full sm:w-[120px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="sold">Sold</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
