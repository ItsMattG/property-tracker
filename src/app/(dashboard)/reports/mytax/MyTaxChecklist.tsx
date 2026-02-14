"use client";

import { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronRight, AlertTriangle } from "lucide-react";
import { cn, formatCurrencyWithCents } from "@/lib/utils";
import type { MyTaxReport, MyTaxPropertyReport, MyTaxLineItem } from "@/server/services/mytax";

interface MyTaxChecklistProps {
  report: MyTaxReport;
}

interface ChecklistState {
  checked: Record<string, boolean>;
}

function getStorageKey(fy: number): string {
  return `mytax-checklist-${fy}`;
}

function loadState(fy: number): ChecklistState {
  if (typeof window === "undefined") return { checked: {} };
  try {
    const raw = localStorage.getItem(getStorageKey(fy));
    return raw ? JSON.parse(raw) : { checked: {} };
  } catch {
    return { checked: {} };
  }
}

function saveState(fy: number, state: ChecklistState) {
  try {
    localStorage.setItem(getStorageKey(fy), JSON.stringify(state));
  } catch {
    // localStorage full or unavailable
  }
}

function LineItemRow({
  item,
  itemKey,
  checked,
  onToggle,
}: {
  item: MyTaxLineItem;
  itemKey: string;
  checked: boolean;
  onToggle: (key: string) => void;
}) {
  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded hover:bg-muted/50">
      <Checkbox
        checked={checked}
        onCheckedChange={() => onToggle(itemKey)}
      />
      <div className="flex-1 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {item.atoCode && (
            <Badge variant="outline" className="text-xs font-mono">
              {item.atoCode}
            </Badge>
          )}
          <span className="text-sm">{item.label}</span>
          <span className="text-xs text-muted-foreground">
            ({item.transactionCount} txn{item.transactionCount !== 1 ? "s" : ""})
          </span>
        </div>
        <span className="text-sm font-medium tabular-nums">
          {formatCurrencyWithCents(item.amount)}
        </span>
      </div>
    </div>
  );
}

function PropertySection({
  prop,
  index,
  state,
  onToggle,
}: {
  prop: MyTaxPropertyReport;
  index: number;
  state: ChecklistState;
  onToggle: (key: string) => void;
}) {
  const [open, setOpen] = useState(true);

  const allKeys = [
    ...prop.income.map((_, i) => `p${index}-inc-${i}`),
    ...prop.deductions.map((_, i) => `p${index}-ded-${i}`),
    ...(prop.depreciation.capitalWorks > 0 ? [`p${index}-dep-cw`] : []),
    ...(prop.depreciation.plantEquipment > 0 ? [`p${index}-dep-pe`] : []),
  ];
  const checkedCount = allKeys.filter((k) => state.checked[k]).length;
  const hasWarning =
    prop.income.length === 0 && prop.deductions.length === 0;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ChevronRight
                  className={cn(
                    "w-4 h-4 transition-transform",
                    open && "rotate-90"
                  )}
                />
                <div>
                  <CardTitle className="text-base">
                    {prop.address}, {prop.suburb} {prop.state}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    {prop.entityName} · Net: {formatCurrencyWithCents(prop.netResult)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {hasWarning && (
                  <Badge variant="destructive" className="text-xs">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    No data
                  </Badge>
                )}
                <Badge variant="secondary">
                  {checkedCount}/{allKeys.length}
                </Badge>
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-4">
            {prop.income.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground mb-2">
                  Income
                </h4>
                {prop.income.map((item, i) => (
                  <LineItemRow
                    key={i}
                    item={item}
                    itemKey={`p${index}-inc-${i}`}
                    checked={!!state.checked[`p${index}-inc-${i}`]}
                    onToggle={onToggle}
                  />
                ))}
              </div>
            )}

            {prop.deductions.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground mb-2">
                  Deductions (Item 21)
                </h4>
                {prop.deductions.map((item, i) => (
                  <LineItemRow
                    key={i}
                    item={item}
                    itemKey={`p${index}-ded-${i}`}
                    checked={!!state.checked[`p${index}-ded-${i}`]}
                    onToggle={onToggle}
                  />
                ))}
              </div>
            )}

            {(prop.depreciation.capitalWorks > 0 ||
              prop.depreciation.plantEquipment > 0) && (
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground mb-2">
                  Depreciation
                </h4>
                {prop.depreciation.capitalWorks > 0 && (
                  <LineItemRow
                    item={{
                      label: "Capital Works",
                      atoCode: "D14",
                      category: "capital_works",
                      amount: prop.depreciation.capitalWorks,
                      transactionCount: 0,
                    }}
                    itemKey={`p${index}-dep-cw`}
                    checked={!!state.checked[`p${index}-dep-cw`]}
                    onToggle={onToggle}
                  />
                )}
                {prop.depreciation.plantEquipment > 0 && (
                  <LineItemRow
                    item={{
                      label: "Plant & Equipment",
                      atoCode: "",
                      category: "plant_equipment",
                      amount: prop.depreciation.plantEquipment,
                      transactionCount: 0,
                    }}
                    itemKey={`p${index}-dep-pe`}
                    checked={!!state.checked[`p${index}-dep-pe`]}
                    onToggle={onToggle}
                  />
                )}
              </div>
            )}

            <div className="pt-2 border-t flex justify-between text-sm font-medium">
              <span>Net Result</span>
              <span className={cn(prop.netResult < 0 ? "text-red-600" : "text-green-600")}>
                {formatCurrencyWithCents(prop.netResult)}
              </span>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

export function MyTaxChecklist({ report }: MyTaxChecklistProps) {
  const [state, setState] = useState<ChecklistState>(() =>
    loadState(report.fyNumber)
  );

  useEffect(() => {
    saveState(report.fyNumber, state);
  }, [state, report.fyNumber]);

  const onToggle = useCallback((key: string) => {
    setState((prev) => ({
      checked: { ...prev.checked, [key]: !prev.checked[key] },
    }));
  }, []);

  // Count total and checked items
  let totalItems = 0;
  let checkedItems = 0;
  for (const [index, prop] of report.properties.entries()) {
    const keys = [
      ...prop.income.map((_, i) => `p${index}-inc-${i}`),
      ...prop.deductions.map((_, i) => `p${index}-ded-${i}`),
      ...(prop.depreciation.capitalWorks > 0 ? [`p${index}-dep-cw`] : []),
      ...(prop.depreciation.plantEquipment > 0 ? [`p${index}-dep-pe`] : []),
    ];
    totalItems += keys.length;
    checkedItems += keys.filter((k) => state.checked[k]).length;
  }
  // Personal summary counts as 1 item
  if (report.personalSummary) {
    totalItems += 1;
    if (state.checked["personal"]) checkedItems += 1;
  }

  const progress = totalItems > 0 ? Math.round((checkedItems / totalItems) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Progress bar */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">
              {checkedItems} of {totalItems} items reviewed
            </span>
            <span className="text-sm text-muted-foreground">{progress}%</span>
          </div>
          <Progress value={progress} />
        </CardContent>
      </Card>

      {/* Portfolio summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Portfolio Summary — {report.financialYear}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold">{formatCurrencyWithCents(report.totalIncome)}</p>
              <p className="text-xs text-muted-foreground">Total Income</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{formatCurrencyWithCents(report.totalDeductions)}</p>
              <p className="text-xs text-muted-foreground">Total Deductions</p>
            </div>
            <div>
              <p className={cn("text-2xl font-bold", report.netRentalResult < 0 ? "text-red-600" : "text-green-600")}>
                {formatCurrencyWithCents(report.netRentalResult)}
              </p>
              <p className="text-xs text-muted-foreground">Net Rental Result</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Per-property sections */}
      {report.properties.map((prop, index) => (
        <PropertySection
          key={prop.propertyId}
          prop={prop}
          index={index}
          state={state}
          onToggle={onToggle}
        />
      ))}

      {/* Personal summary */}
      {report.personalSummary && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Checkbox
                checked={!!state.checked["personal"]}
                onCheckedChange={() => onToggle("personal")}
              />
              <CardTitle className="text-base">Personal Tax Summary</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Salary/Wages</span>
              <span>{formatCurrencyWithCents(report.personalSummary.grossSalary)}</span>
            </div>
            <div className="flex justify-between">
              <span>PAYG Withheld</span>
              <span>{formatCurrencyWithCents(report.personalSummary.paygWithheld)}</span>
            </div>
            <div className="flex justify-between">
              <span>Net Rental Result</span>
              <span className={cn(report.netRentalResult < 0 ? "text-red-600" : "text-green-600")}>
                {formatCurrencyWithCents(report.netRentalResult)}
              </span>
            </div>
            {report.personalSummary.taxPosition && (
              <>
                <div className="border-t pt-2 mt-2">
                  <div className="flex justify-between font-medium">
                    <span>Estimated Taxable Income</span>
                    <span>{formatCurrencyWithCents(report.personalSummary.taxPosition.taxableIncome)}</span>
                  </div>
                </div>
                <div className="flex justify-between font-medium">
                  <span>
                    {report.personalSummary.taxPosition.isRefund
                      ? "Estimated Refund"
                      : "Estimated Owing"}
                  </span>
                  <span
                    className={cn(
                      report.personalSummary.taxPosition.isRefund
                        ? "text-green-600"
                        : "text-red-600"
                    )}
                  >
                    {formatCurrencyWithCents(
                      Math.abs(report.personalSummary.taxPosition.refundOrOwing)
                    )}
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
