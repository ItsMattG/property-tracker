"use client";

import { useState, useMemo, useCallback } from "react";
import {
  type ParsedCSVRow,
  matchCategory,
  matchTransactionType,
} from "@/server/services/banking/csv-import";
import { categories } from "@/lib/categories";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, AlertTriangle, CheckCircle2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { QuickCreatePropertyDialog } from "./QuickCreatePropertyDialog";

// --- Types ---

type RowStatus = "ready" | "warning" | "error";

interface PreviewRow extends ParsedCSVRow {
  status: RowStatus;
  issues: string[];
  resolvedCategory: string | null;
  resolvedType: string | null;
  resolvedPropertyId: string | null;
  resolvedDeductible: boolean;
  resolvedInvoicePresent: boolean;
}

interface Property {
  id: string;
  address: string;
  suburb: string;
}

export interface ImportReadyRow {
  date: string;
  description: string;
  amount: number;
  propertyId: string | null;
  category: string;
  transactionType: string;
  isDeductible: boolean;
  notes: string | null;
  invoiceUrl: string | null;
  invoicePresent: boolean;
}

interface PreviewStepProps {
  parsedRows: ParsedCSVRow[];
  properties: Property[];
  fallbackPropertyId: string;
  onImport: (rows: ImportReadyRow[]) => void;
  onBack: () => void;
  isImporting: boolean;
}

// --- Property matching ---

function matchProperty(
  rawProperty: string | null,
  properties: Property[],
  fallbackPropertyId: string
): string | null {
  if (!rawProperty) return fallbackPropertyId || null;

  const lower = rawProperty.trim().toLowerCase();
  if (!lower) return fallbackPropertyId || null;

  // Try matching against address or suburb (case-insensitive partial)
  const match = properties.find(
    (p) =>
      p.address.toLowerCase().includes(lower) ||
      lower.includes(p.address.toLowerCase()) ||
      p.suburb.toLowerCase().includes(lower) ||
      lower.includes(p.suburb.toLowerCase())
  );

  if (match) return match.id;

  // Fall back to fallbackPropertyId
  return fallbackPropertyId || null;
}

// --- Row building ---

function buildPreviewRow(
  row: ParsedCSVRow,
  properties: Property[],
  fallbackPropertyId: string
): PreviewRow {
  const issues: string[] = [];

  // Required fields
  if (!row.date) issues.push("Missing date");
  if (!row.description) issues.push("Missing description");
  if (!row.amount) issues.push("Missing amount");

  // Property matching
  const resolvedPropertyId = matchProperty(
    row.property,
    properties,
    fallbackPropertyId
  );
  if (!resolvedPropertyId) {
    issues.push("No property assigned");
  }

  // Category matching
  let resolvedCategory: string | null = null;
  if (row.category) {
    resolvedCategory = matchCategory(row.category);
    if (!resolvedCategory) {
      issues.push(`Unmatched category: "${row.category}"`);
      resolvedCategory = "uncategorized";
    }
  } else {
    resolvedCategory = "uncategorized";
  }

  // Type matching
  let resolvedType: string | null = null;
  if (row.transactionType) {
    resolvedType = matchTransactionType(row.transactionType);
    if (!resolvedType) {
      // Infer from amount sign
      const amt = parseFloat(row.amount ?? "0");
      resolvedType = amt >= 0 ? "income" : "expense";
    }
  } else {
    // Infer from amount sign
    const amt = parseFloat(row.amount ?? "0");
    resolvedType = amt >= 0 ? "income" : "expense";
  }

  // Deductible / invoice present defaults
  const resolvedDeductible = row.isDeductible ?? false;
  const resolvedInvoicePresent = row.invoicePresent ?? false;

  // Determine status
  const hasErrors = !row.date || !row.description || !row.amount;
  const hasWarnings = issues.length > 0 && !hasErrors;

  const status: RowStatus = hasErrors
    ? "error"
    : hasWarnings
      ? "warning"
      : "ready";

  return {
    ...row,
    status,
    issues,
    resolvedCategory,
    resolvedType,
    resolvedPropertyId,
    resolvedDeductible,
    resolvedInvoicePresent,
  };
}

function recalculateStatus(row: PreviewRow): PreviewRow {
  const issues: string[] = [];

  if (!row.date) issues.push("Missing date");
  if (!row.description) issues.push("Missing description");
  if (!row.amount) issues.push("Missing amount");
  if (!row.resolvedPropertyId) issues.push("No property assigned");

  const hasErrors = !row.date || !row.description || !row.amount;
  const hasWarnings = issues.length > 0 && !hasErrors;

  return {
    ...row,
    issues,
    status: hasErrors ? "error" : hasWarnings ? "warning" : "ready",
  };
}

// --- Status icon ---

function StatusIcon({ status }: { status: RowStatus }) {
  switch (status) {
    case "ready":
      return <CheckCircle2 className="size-4 text-green-500 shrink-0" />;
    case "warning":
      return <AlertTriangle className="size-4 text-yellow-500 shrink-0" />;
    case "error":
      return <AlertCircle className="size-4 text-destructive shrink-0" />;
  }
}

// --- Transaction type options ---

const TRANSACTION_TYPES = [
  { value: "income", label: "Income" },
  { value: "expense", label: "Expense" },
  { value: "capital", label: "Capital" },
  { value: "transfer", label: "Transfer" },
  { value: "personal", label: "Personal" },
] as const;

// --- Main component ---

export function PreviewStep({
  parsedRows,
  properties,
  fallbackPropertyId,
  onImport,
  onBack,
  isImporting,
}: PreviewStepProps) {
  const [rows, setRows] = useState<PreviewRow[]>(() =>
    parsedRows.map((r) => buildPreviewRow(r, properties, fallbackPropertyId))
  );

  const updateRow = useCallback(
    (index: number, updates: Partial<PreviewRow>) => {
      setRows((prev) => {
        const next = [...prev];
        const updated = { ...next[index], ...updates };
        next[index] = recalculateStatus(updated);
        return next;
      });
    },
    []
  );

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createDialogRowIndex, setCreateDialogRowIndex] = useState<number | null>(null);
  const [localProperties, setLocalProperties] = useState<Property[]>(properties);

  const onPropertyCreated = useCallback(
    (newProperty: Property) => {
      setLocalProperties((prev) => [...prev, newProperty]);

      setRows((prev) =>
        prev.map((row, idx) => {
          if (row.resolvedPropertyId) return row;

          // Force-assign to the row that triggered the dialog
          if (idx === createDialogRowIndex) {
            return recalculateStatus({ ...row, resolvedPropertyId: newProperty.id });
          }

          // Try matching the new property against the row's raw property text
          const matched = matchProperty(row.property, [newProperty], "");
          if (matched) {
            return recalculateStatus({ ...row, resolvedPropertyId: matched });
          }

          return row;
        })
      );
      setCreateDialogRowIndex(null);
    },
    [createDialogRowIndex]
  );

  const [filter, setFilter] = useState<"all" | "ready" | "warning" | "error">("all");

  const stats = useMemo(() => {
    let ready = 0;
    let warnings = 0;
    let errors = 0;
    for (const row of rows) {
      if (row.status === "ready") ready++;
      else if (row.status === "warning") warnings++;
      else errors++;
    }
    return { ready, warnings, errors };
  }, [rows]);

  const filteredRows = useMemo(() => {
    if (filter === "all") return rows.map((row, idx) => ({ row, originalIndex: idx }));
    return rows
      .map((row, idx) => ({ row, originalIndex: idx }))
      .filter((entry) => entry.row.status === filter);
  }, [rows, filter]);

  const rowsWithIssues = useMemo(
    () => rows.filter((r) => r.issues.length > 0).slice(0, 10),
    [rows]
  );

  const unassignedCount = useMemo(
    () => rows.filter((r) => !r.resolvedPropertyId && r.status !== "error").length,
    [rows]
  );

  const importableCount = rows.length - stats.errors;

  const handleImport = useCallback(() => {
    const importRows: ImportReadyRow[] = rows
      .filter((r) => r.status !== "error")
      .map((r) => ({
        date: r.date!,
        description: r.description!,
        amount: parseFloat(r.amount!),
        propertyId: r.resolvedPropertyId ?? null,
        category: r.resolvedCategory ?? "uncategorized",
        transactionType: r.resolvedType ?? "expense",
        isDeductible: r.resolvedDeductible,
        notes: r.notes,
        invoiceUrl: r.invoiceUrl,
        invoicePresent: r.resolvedInvoicePresent,
      }));

    onImport(importRows);
  }, [rows, onImport]);

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
        <div className="flex items-center justify-between">
          <TabsList variant="line">
            <TabsTrigger value="all">All ({rows.length})</TabsTrigger>
            <TabsTrigger value="ready">Ready ({stats.ready})</TabsTrigger>
            {stats.warnings > 0 && (
              <TabsTrigger value="warning">Warnings ({stats.warnings})</TabsTrigger>
            )}
            {stats.errors > 0 && (
              <TabsTrigger value="error">Errors ({stats.errors})</TabsTrigger>
            )}
          </TabsList>
        </div>
      </Tabs>

      {/* Unassigned warning */}
      {unassignedCount > 0 && (
        <div className="rounded-md border border-yellow-500/20 bg-yellow-500/5 px-3 py-2">
          <p className="text-xs text-yellow-700 dark:text-yellow-400">
            {unassignedCount} row{unassignedCount !== 1 ? "s" : ""} {unassignedCount !== 1 ? "have" : "has"} no property assigned.
            Use the property dropdown or create a new property to assign {unassignedCount !== 1 ? "them" : "it"}.
          </p>
        </div>
      )}

      {/* Preview table */}
      <div className="max-h-[400px] overflow-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow className="text-xs">
              <TableHead className="w-8" />
              <TableHead className="w-10 text-xs">Row</TableHead>
              <TableHead className="text-xs">Date</TableHead>
              <TableHead className="text-xs">Description</TableHead>
              <TableHead className="text-xs text-right">Amount</TableHead>
              <TableHead className="text-xs w-[140px]">Property</TableHead>
              <TableHead className="text-xs w-[140px]">Category</TableHead>
              <TableHead className="text-xs w-[100px]">Type</TableHead>
              <TableHead className="text-xs w-10">Ded.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRows.map(({ row, originalIndex }) => (
              <TableRow
                key={row.rowNumber}
                className={
                  row.status === "error"
                    ? "bg-destructive/5"
                    : row.status === "warning"
                      ? "bg-yellow-500/5"
                      : ""
                }
              >
                {/* Status icon */}
                <TableCell className="px-2 py-1">
                  <StatusIcon status={row.status} />
                </TableCell>

                {/* Row number */}
                <TableCell className="text-xs text-muted-foreground px-2 py-1">
                  {row.rowNumber}
                </TableCell>

                {/* Date */}
                <TableCell className="text-xs px-2 py-1 whitespace-nowrap">
                  {row.date ?? (
                    <span className="text-destructive italic">missing</span>
                  )}
                </TableCell>

                {/* Description */}
                <TableCell
                  className="text-xs px-2 py-1 max-w-[200px] truncate"
                  title={row.description ?? undefined}
                >
                  {row.description ?? (
                    <span className="text-destructive italic">missing</span>
                  )}
                </TableCell>

                {/* Amount */}
                <TableCell className="text-xs px-2 py-1 text-right whitespace-nowrap tabular-nums">
                  {row.amount != null ? (
                    <span
                      className={
                        parseFloat(row.amount) >= 0
                          ? "text-green-600 dark:text-green-400"
                          : "text-red-600 dark:text-red-400"
                      }
                    >
                      ${Math.abs(parseFloat(row.amount)).toFixed(2)}
                    </span>
                  ) : (
                    <span className="text-destructive italic">missing</span>
                  )}
                </TableCell>

                {/* Property select */}
                <TableCell className="px-1 py-1">
                  <Select
                    value={row.resolvedPropertyId ?? "__unassigned__"}
                    onValueChange={(val) => {
                      if (val === "__create_new__") {
                        setCreateDialogRowIndex(originalIndex);
                        setCreateDialogOpen(true);
                        return;
                      }
                      if (val === "__unassigned__") {
                        updateRow(originalIndex, { resolvedPropertyId: null });
                        return;
                      }
                      updateRow(originalIndex, { resolvedPropertyId: val });
                    }}
                  >
                    <SelectTrigger
                      size="sm"
                      className={cn(
                        "h-7 text-xs w-[140px]",
                        !row.resolvedPropertyId && "border-yellow-500/50 text-yellow-600 dark:text-yellow-400"
                      )}
                    >
                      <SelectValue placeholder="Unassigned" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__unassigned__" className="text-xs text-muted-foreground italic">
                        Unassigned
                      </SelectItem>
                      {localProperties.map((p) => (
                        <SelectItem key={p.id} value={p.id} className="text-xs">
                          {p.address}
                        </SelectItem>
                      ))}
                      <SelectSeparator />
                      <SelectItem value="__create_new__" className="text-xs text-primary">
                        <Plus className="size-3 mr-1 inline" />
                        Create property
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>

                {/* Category select */}
                <TableCell className="px-1 py-1">
                  <Select
                    value={row.resolvedCategory ?? "uncategorized"}
                    onValueChange={(val) =>
                      updateRow(originalIndex, { resolvedCategory: val })
                    }
                  >
                    <SelectTrigger
                      size="sm"
                      className="h-7 text-xs w-[140px]"
                    >
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem
                          key={c.value}
                          value={c.value}
                          className="text-xs"
                        >
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>

                {/* Type select */}
                <TableCell className="px-1 py-1">
                  <Select
                    value={row.resolvedType ?? "expense"}
                    onValueChange={(val) =>
                      updateRow(originalIndex, { resolvedType: val })
                    }
                  >
                    <SelectTrigger
                      size="sm"
                      className="h-7 text-xs w-[100px]"
                    >
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      {TRANSACTION_TYPES.map((t) => (
                        <SelectItem
                          key={t.value}
                          value={t.value}
                          className="text-xs"
                        >
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>

                {/* Deductible checkbox */}
                <TableCell className="px-2 py-1 text-center">
                  <Checkbox
                    checked={row.resolvedDeductible}
                    onCheckedChange={(checked) =>
                      updateRow(originalIndex, {
                        resolvedDeductible: checked === true,
                      })
                    }
                    className="size-3.5"
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Issue summary */}
      {rowsWithIssues.length > 0 && (
        <div className="rounded-md border border-yellow-500/20 bg-yellow-500/5 p-3 space-y-1">
          <p className="text-xs font-medium text-yellow-700 dark:text-yellow-400">
            Issues found:
          </p>
          {rowsWithIssues.map((row) => (
            <p
              key={row.rowNumber}
              className="text-xs text-muted-foreground"
            >
              <span className="font-medium">Row {row.rowNumber}:</span>{" "}
              {row.issues.join(", ")}
            </p>
          ))}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center justify-between pt-2">
        <Button variant="outline" size="sm" onClick={onBack}>
          Back
        </Button>
        <Button
          size="sm"
          onClick={handleImport}
          disabled={importableCount === 0 || isImporting}
        >
          {isImporting
            ? "Importing..."
            : `Import ${importableCount} Transaction${importableCount !== 1 ? "s" : ""}`}
        </Button>
      </div>

      {/* Quick create property dialog */}
      <QuickCreatePropertyDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onCreated={onPropertyCreated}
        prefillAddress={
          createDialogRowIndex !== null
            ? rows[createDialogRowIndex]?.property ?? undefined
            : undefined
        }
      />
    </div>
  );
}
