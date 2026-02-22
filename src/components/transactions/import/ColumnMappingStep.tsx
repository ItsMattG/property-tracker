"use client";

import { useState, useMemo, useCallback } from "react";
import { ArrowRight, CheckCircle2, AlertCircle, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CSVColumnMap } from "@/server/services/banking/csv-import";

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
  { value: "notes", label: "Details", required: false },
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

// --- Preview field config ---

const PREVIEW_FIELDS: { key: keyof CSVColumnMap; label: string }[] = [
  { key: "date", label: "Date" },
  { key: "description", label: "Description" },
  { key: "notes", label: "Details" },
  { key: "amount", label: "Amount" },
  { key: "property", label: "Property" },
  { key: "category", label: "Category" },
  { key: "transactionType", label: "Type" },
  { key: "isDeductible", label: "Deductible" },
];

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

  // Build the live preview from Row 1
  const previewData = useMemo(() => {
    const row = previewRows[0] ?? [];
    const columnMap = buildColumnMap(mappings);
    const result: Record<string, string> = {};

    for (const { key, label } of PREVIEW_FIELDS) {
      const idx = columnMap[key];
      if (idx !== -1 && row[idx]) {
        result[label] = row[idx];
      }
    }

    return result;
  }, [mappings, previewRows]);

  const handleConfirm = useCallback(() => {
    onConfirm(buildColumnMap(mappings));
  }, [mappings, onConfirm]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 pb-3">
        <h3 className="text-sm font-semibold">Map Columns</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Match each CSV column to a BrickTrack field. Required fields are
          marked with *.
        </p>
      </div>

      {/* Two-panel layout */}
      <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
        {/* Left panel: Mapping table */}
        <div className="flex min-h-0 flex-[3] flex-col">
          <div className="max-h-[50vh] overflow-y-auto pr-1">
            <div className="space-y-1.5">
              {csvHeaders.map((header, idx) => {
                const mappedField = mappings[idx];
                const selectValue = mappedField ?? "__unmapped__";
                const isMapped =
                  mappedField !== undefined && mappedField !== "skip";

                return (
                  <div
                    key={idx}
                    className="flex items-center gap-2 rounded-lg bg-muted/50 p-2"
                  >
                    {/* CSV header name */}
                    <span
                      className="shrink-0 basis-[110px] truncate text-sm font-medium"
                      title={header}
                    >
                      {header}
                    </span>

                    {/* Arrow */}
                    <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" />

                    {/* BrickTrack field select */}
                    <Select
                      value={selectValue}
                      onValueChange={(val) => handleMappingChange(idx, val)}
                    >
                      <SelectTrigger size="sm" className="w-[160px] text-xs">
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

                    {/* Status icon */}
                    {isMapped ? (
                      <CheckCircle2 className="size-4 shrink-0 text-green-600 dark:text-green-500" />
                    ) : (
                      <Minus className="size-4 shrink-0 text-muted-foreground/50" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right panel: Live preview card */}
        <div className="flex-[2] shrink-0">
          <div className="rounded-lg border bg-card p-4">
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Sample Transaction (Row 1)
            </h4>

            <div className="space-y-2">
              {PREVIEW_FIELDS.map(({ label }) => {
                const value = previewData[label];
                return (
                  <div key={label} className="flex items-baseline gap-2">
                    <span className="shrink-0 basis-[90px] text-xs text-muted-foreground">
                      {label}
                    </span>
                    <span
                      className="min-w-0 truncate text-sm font-medium"
                      title={value ?? ""}
                    >
                      {value ?? (
                        <span className="text-muted-foreground/50">&mdash;</span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Validation status */}
            <div className="mt-4 flex items-center gap-2 border-t pt-3 text-xs">
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
          </div>
        </div>
      </div>

      {/* Footer: Back + Continue buttons */}
      <div className="flex shrink-0 items-center justify-between border-t pt-4 mt-4">
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
