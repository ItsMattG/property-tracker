"use client";

import { useState, useMemo, useCallback } from "react";
import type { CSVColumnMap } from "@/server/services/banking";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle2, ArrowRight } from "lucide-react";

// --- BrickTrack field definitions ---

const BRICKTRACK_FIELDS = [
  { value: "date", label: "Date", required: true },
  { value: "description", label: "Description", required: true },
  { value: "amount", label: "Amount", required: true },
  { value: "debit", label: "Debit", required: false },
  { value: "credit", label: "Credit", required: false },
  { value: "property", label: "Property", required: false },
  {
    value: "transactionType",
    label: "Type (Income/Expense/Capital)",
    required: false,
  },
  { value: "category", label: "Category", required: false },
  { value: "isDeductible", label: "Deductible?", required: false },
  { value: "invoiceUrl", label: "Invoice URL", required: false },
  { value: "invoicePresent", label: "Invoice Present?", required: false },
  { value: "notes", label: "Notes", required: false },
  { value: "skip", label: "Skip this column", required: false },
] as const;

type FieldValue = (typeof BRICKTRACK_FIELDS)[number]["value"];

// --- Props ---

interface ColumnMappingStepProps {
  csvHeaders: string[];
  previewRows: string[][];
  autoDetected: CSVColumnMap;
  onConfirm: (mapping: CSVColumnMap) => void;
  onBack: () => void;
}

// --- Helpers ---

/** Invert a CSVColumnMap (field->index) into a Record<index, field>. Skips -1 entries. */
function invertColumnMap(
  map: CSVColumnMap
): Record<number, FieldValue> {
  const inverted: Record<number, FieldValue> = {};
  for (const [field, idx] of Object.entries(map)) {
    if (idx !== -1) {
      inverted[idx] = field as FieldValue;
    }
  }
  return inverted;
}

/** Build a CSVColumnMap from the inverted record. Unmapped fields get -1. */
function buildColumnMap(
  mappings: Record<number, FieldValue>
): CSVColumnMap {
  const result: CSVColumnMap = {
    date: -1,
    description: -1,
    amount: -1,
    debit: -1,
    credit: -1,
    property: -1,
    transactionType: -1,
    category: -1,
    isDeductible: -1,
    invoiceUrl: -1,
    invoicePresent: -1,
    notes: -1,
  };
  for (const [idxStr, field] of Object.entries(mappings)) {
    if (field !== "skip" && field in result) {
      result[field as keyof CSVColumnMap] = Number(idxStr);
    }
  }
  return result;
}

// --- Component ---

export function ColumnMappingStep({
  csvHeaders,
  previewRows,
  autoDetected,
  onConfirm,
  onBack,
}: ColumnMappingStepProps) {
  // State: index -> field mapping, initialised from autoDetected
  const [mappings, setMappings] = useState<Record<number, FieldValue>>(
    () => invertColumnMap(autoDetected)
  );

  // Handle a mapping change. If the chosen field is already mapped elsewhere, clear the old one.
  const handleMappingChange = useCallback(
    (colIndex: number, value: string) => {
      setMappings((prev) => {
        const next = { ...prev };

        if (value === "__unmapped__") {
          delete next[colIndex];
          return next;
        }

        const field = value as FieldValue;

        // Remove duplicate mapping (except "skip" which can appear multiple times)
        if (field !== "skip") {
          for (const [existingIdx, existingField] of Object.entries(next)) {
            if (existingField === field && Number(existingIdx) !== colIndex) {
              delete next[Number(existingIdx)];
            }
          }
        }

        next[colIndex] = field;
        return next;
      });
    },
    []
  );

  // Validation: check which required fields are missing
  const { missingFields, allRequiredMapped } = useMemo(() => {
    const columnMap = buildColumnMap(mappings);
    const missing: string[] = [];

    if (columnMap.date === -1) missing.push("Date");
    if (columnMap.description === -1) missing.push("Description");

    // Amount is satisfied by either "amount" directly, or both "debit" + "credit"
    const hasAmount = columnMap.amount !== -1;
    const hasDebitCredit =
      columnMap.debit !== -1 && columnMap.credit !== -1;
    if (!hasAmount && !hasDebitCredit) missing.push("Amount (or Debit + Credit)");

    return {
      missingFields: missing,
      allRequiredMapped: missing.length === 0,
    };
  }, [mappings]);

  const handleConfirm = useCallback(() => {
    onConfirm(buildColumnMap(mappings));
  }, [mappings, onConfirm]);

  // First preview row for inline context
  const previewRow = previewRows[0] ?? [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h3 className="text-sm font-semibold">Map Columns</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Match each CSV column to a BrickTrack field. Required fields are
          marked with *.
        </p>
      </div>

      {/* Mapping rows */}
      <div className="max-h-[400px] overflow-y-auto space-y-1.5 pr-1">
        {csvHeaders.map((header, idx) => {
          const currentMapping = mappings[idx] ?? "__unmapped__";
          const previewValue = previewRow[idx] ?? "";

          return (
            <div
              key={idx}
              className="flex items-center gap-2 rounded-lg bg-muted/50 p-2"
            >
              {/* CSV header name */}
              <span
                className="min-w-0 shrink-0 basis-[120px] truncate text-sm font-medium"
                title={header}
              >
                {header}
              </span>

              {/* Arrow */}
              <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" />

              {/* BrickTrack field select */}
              <Select
                value={currentMapping}
                onValueChange={(val) => handleMappingChange(idx, val)}
              >
                <SelectTrigger size="sm" className="w-[180px] text-xs">
                  <SelectValue placeholder="Unmapped" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__unmapped__">
                    <span className="text-muted-foreground">Unmapped</span>
                  </SelectItem>
                  {BRICKTRACK_FIELDS.map((field) => (
                    <SelectItem key={field.value} value={field.value}>
                      {field.label}
                      {field.required ? " *" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Preview value */}
              <span
                className="min-w-0 flex-1 truncate text-xs text-muted-foreground"
                title={previewValue}
              >
                {previewValue || "\u2014"}
              </span>
            </div>
          );
        })}
      </div>

      {/* Status message */}
      <div className="flex items-center gap-2 text-xs">
        {allRequiredMapped ? (
          <>
            <CheckCircle2 className="size-4 text-green-600 dark:text-green-500" />
            <span className="text-green-700 dark:text-green-400">
              All required fields mapped
            </span>
          </>
        ) : (
          <>
            <AlertCircle className="size-4 text-destructive" />
            <span className="text-destructive">
              Missing: {missingFields.join(", ")}
            </span>
          </>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-between pt-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          Back
        </Button>
        <Button
          size="sm"
          onClick={handleConfirm}
          disabled={!allRequiredMapped}
        >
          Continue to Preview
        </Button>
      </div>
    </div>
  );
}
