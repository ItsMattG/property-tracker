"use client";

import { useState, useEffect, useCallback } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Settings2 } from "lucide-react";

const STORAGE_KEY = "bricktrack:transactions:visibleColumns";

export interface ColumnDef {
  id: string;
  label: string;
  defaultVisible: boolean;
}

export const TRANSACTION_COLUMNS: ColumnDef[] = [
  { id: "date", label: "Date", defaultVisible: true },
  { id: "description", label: "Description", defaultVisible: true },
  { id: "amount", label: "Amount", defaultVisible: true },
  { id: "type", label: "Type", defaultVisible: false },
  { id: "category", label: "Category", defaultVisible: true },
  { id: "property", label: "Property", defaultVisible: true },
  { id: "deductible", label: "Deductible", defaultVisible: false },
  { id: "notes", label: "Notes", defaultVisible: true },
  { id: "invoiceUrl", label: "Invoice URL", defaultVisible: false },
  { id: "invoicePresent", label: "Invoice Present", defaultVisible: false },
  { id: "verified", label: "Verified", defaultVisible: true },
];

function getDefaultVisibility(): Record<string, boolean> {
  const defaults: Record<string, boolean> = {};
  for (const col of TRANSACTION_COLUMNS) {
    defaults[col.id] = col.defaultVisible;
  }
  return defaults;
}

export function useColumnVisibility() {
  const [visibility, setVisibility] = useState<Record<string, boolean>>(getDefaultVisibility);

  // Load from localStorage on mount (SSR-safe)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Record<string, boolean>;
        // Merge with defaults so new columns get their default value
        const merged = { ...getDefaultVisibility(), ...parsed };
        setVisibility(merged);
      }
    } catch {
      // Ignore parse errors, use defaults
    }
  }, []);

  const toggle = useCallback((columnId: string) => {
    setVisibility((prev) => {
      const next = { ...prev, [columnId]: !prev[columnId] };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  }, []);

  const resetToDefaults = useCallback(() => {
    const defaults = getDefaultVisibility();
    setVisibility(defaults);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
  }, []);

  const isVisible = useCallback(
    (columnId: string) => visibility[columnId] ?? true,
    [visibility]
  );

  return { visibility, toggle, resetToDefaults, isVisible };
}

interface ColumnVisibilityMenuProps {
  visibility: Record<string, boolean>;
  onToggle: (columnId: string) => void;
  onResetToDefaults: () => void;
}

export function ColumnVisibilityMenu({
  visibility,
  onToggle,
  onResetToDefaults,
}: ColumnVisibilityMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings2 className="w-4 h-4 mr-2" />
          Columns
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {TRANSACTION_COLUMNS.map((col) => (
          <DropdownMenuCheckboxItem
            key={col.id}
            checked={visibility[col.id] ?? col.defaultVisible}
            onCheckedChange={() => onToggle(col.id)}
            onSelect={(e) => e.preventDefault()}
          >
            {col.label}
          </DropdownMenuCheckboxItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onResetToDefaults}>
          Reset to defaults
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
