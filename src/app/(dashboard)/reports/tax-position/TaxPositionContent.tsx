// src/app/(dashboard)/reports/tax-position/TaxPositionContent.tsx

"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc/client";
import { SetupWizard } from "@/components/tax-position/SetupWizard";
import { ForecastSummary } from "@/components/tax-position/ForecastSummary";
import { ForecastAnnotation } from "@/components/tax-position/ForecastAnnotation";
import {
  Home,
  AlertCircle,
  Save,
  RotateCcw,
  ExternalLink,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";

type FamilyStatus = "single" | "couple" | "family";

interface FormState {
  grossSalary: string;
  paygWithheld: string;
  rentalOverride: string | null;
  otherDeductions: string;
  hasHecsDebt: boolean;
  hasPrivateHealth: boolean;
  familyStatus: FamilyStatus;
  dependentChildren: string;
  partnerIncome: string;
}

export function TaxPositionContent() {
  const [yearOverride, setYearOverride] = useState<number | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [formEdits, setFormEdits] = useState<Partial<FormState> | null>(null);

  const { data: supportedYears } = trpc.taxPosition.getSupportedYears.useQuery();
  const { data: currentYear } = trpc.taxPosition.getCurrentYear.useQuery();

  // Use override if set, otherwise use current year
  const selectedYear = yearOverride ?? currentYear ?? null;

  const { data: profile, refetch: refetchProfile } =
    trpc.taxPosition.getProfile.useQuery(
      { financialYear: selectedYear! },
      { enabled: !!selectedYear }
    );

  const { data: rentalResult } = trpc.taxPosition.getRentalResult.useQuery(
    { financialYear: selectedYear! },
    { enabled: !!selectedYear }
  );

  const { data: forecast } = trpc.taxForecast.getForecast.useQuery(
    { financialYear: selectedYear! },
    { enabled: !!selectedYear }
  );

  // Derive form state from profile, with local edits overlaid
  const formState: FormState = useMemo(() => {
    const base: FormState = profile ? {
      grossSalary: profile.grossSalary ?? "",
      paygWithheld: profile.paygWithheld ?? "",
      rentalOverride: null,
      otherDeductions: profile.otherDeductions ?? "0",
      hasHecsDebt: profile.hasHecsDebt,
      hasPrivateHealth: profile.hasPrivateHealth,
      familyStatus: profile.familyStatus as FamilyStatus,
      dependentChildren: String(profile.dependentChildren),
      partnerIncome: profile.partnerIncome ?? "",
    } : {
      grossSalary: "",
      paygWithheld: "",
      rentalOverride: null,
      otherDeductions: "0",
      hasHecsDebt: false,
      hasPrivateHealth: true,
      familyStatus: "single" as FamilyStatus,
      dependentChildren: "0",
      partnerIncome: "",
    };
    return formEdits ? { ...base, ...formEdits } : base;
  }, [profile, formEdits]);

  const setFormState = (newState: FormState | ((prev: FormState) => FormState)) => {
    if (typeof newState === "function") {
      setFormEdits(() => {
        const updated = newState(formState);
        return updated;
      });
    } else {
      setFormEdits(newState);
    }
  };

  // Determine if wizard should show (no profile for this year)
  const shouldShowWizard = profile === null && selectedYear !== null && !showWizard;

  const saveProfile = trpc.taxPosition.saveProfile.useMutation({
    onSuccess: () => {
      toast.success("Tax profile saved");
      refetchProfile();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to save profile");
    },
  });

  // Calculate current values
  const rentalNet =
    formState.rentalOverride !== null
      ? parseFloat(formState.rentalOverride) || 0
      : rentalResult?.netResult ?? 0;

  const calculationInput = useMemo(
    () => ({
      financialYear: selectedYear ?? 2026,
      grossSalary: parseFloat(formState.grossSalary) || 0,
      paygWithheld: parseFloat(formState.paygWithheld) || 0,
      rentalNetResult: rentalNet,
      otherDeductions: parseFloat(formState.otherDeductions) || 0,
      hasHecsDebt: formState.hasHecsDebt,
      hasPrivateHealth: formState.hasPrivateHealth,
      familyStatus: formState.familyStatus,
      dependentChildren: parseInt(formState.dependentChildren) || 0,
      partnerIncome: parseFloat(formState.partnerIncome) || 0,
    }),
    [formState, rentalNet, selectedYear]
  );

  const { data: calculation } = trpc.taxPosition.calculate.useQuery(
    calculationInput,
    {
      enabled:
        !!selectedYear &&
        parseFloat(formState.grossSalary) > 0 &&
        parseFloat(formState.paygWithheld) >= 0,
    }
  );

  // Check for unsaved changes
  const hasChanges = formEdits !== null && profile !== null;

  const handleSave = () => {
    if (!selectedYear) return;
    saveProfile.mutate({
      financialYear: selectedYear,
      grossSalary: parseFloat(formState.grossSalary) || undefined,
      paygWithheld: parseFloat(formState.paygWithheld) || undefined,
      otherDeductions: parseFloat(formState.otherDeductions) || 0,
      hasHecsDebt: formState.hasHecsDebt,
      hasPrivateHealth: formState.hasPrivateHealth,
      familyStatus: formState.familyStatus,
      dependentChildren: parseInt(formState.dependentChildren) || 0,
      partnerIncome: parseFloat(formState.partnerIncome) || undefined,
      isComplete: true,
    });
  };

  const handleReset = () => {
    setFormEdits(null);
  };

  const handleWizardComplete = () => {
    setShowWizard(false);
    refetchProfile();
  };

  if (!selectedYear || !supportedYears) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Show wizard when there's no profile for this year
  if (showWizard || shouldShowWizard) {
    return (
      <SetupWizard
        financialYear={selectedYear}
        rentalNetResult={rentalResult?.netResult ?? 0}
        onComplete={handleWizardComplete}
        onCancel={() => setShowWizard(false)}
      />
    );
  }

  const showFamilyFields =
    formState.familyStatus === "couple" || formState.familyStatus === "family";

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Tax Position</h2>
          <p className="text-muted-foreground">
            Your estimated tax outcome for the financial year
          </p>
        </div>
        <Select
          value={String(selectedYear)}
          onValueChange={(v) => {
            setYearOverride(Number(v));
            setFormEdits(null); // Reset edits when changing year
          }}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {supportedYears.map((y) => (
              <SelectItem key={y.year} value={String(y.year)}>
                {y.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary Card */}
      {calculation && (
        <Card
          className={
            calculation.isRefund
              ? "border-green-200 bg-green-50"
              : "border-amber-200 bg-amber-50"
          }
        >
          <CardContent className="pt-6">
            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                {calculation.isRefund ? "Estimated Refund" : "Estimated Owing"}
              </p>
              <p
                className={`text-4xl font-bold ${
                  calculation.isRefund ? "text-green-600" : "text-amber-600"
                }`}
              >
                {formatCurrency(Math.abs(calculation.refundOrOwing))}
              </p>
              {calculation.propertySavings > 0 && (
                <p className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                  <Home className="h-4 w-4" />
                  Your rental properties saved you{" "}
                  {formatCurrency(calculation.propertySavings)} in tax
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Forecast Summary */}
      {forecast?.taxPosition.forecast && forecast.monthsElapsed < 12 && calculation && (
        <ForecastSummary
          forecastRefund={forecast.taxPosition.forecast.refundOrOwing}
          forecastIsRefund={forecast.taxPosition.forecast.isRefund}
          monthsElapsed={forecast.monthsElapsed}
          confidence={forecast.confidence}
        />
      )}

      {/* Income & Deductions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Income Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Your Income</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="grossSalary">Gross salary</Label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-muted-foreground">
                  $
                </span>
                <Input
                  id="grossSalary"
                  type="number"
                  className="pl-7"
                  value={formState.grossSalary}
                  onChange={(e) =>
                    setFormState({ ...formState, grossSalary: e.target.value })
                  }
                  placeholder="95,000"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="paygWithheld">PAYG withheld</Label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-muted-foreground">
                  $
                </span>
                <Input
                  id="paygWithheld"
                  type="number"
                  className="pl-7"
                  value={formState.paygWithheld}
                  onChange={(e) =>
                    setFormState({ ...formState, paygWithheld: e.target.value })
                  }
                  placeholder="22,000"
                />
              </div>
            </div>

            {calculation && (
              <div className="pt-2 border-t">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Taxable income</span>
                  <span className="font-medium">
                    {formatCurrency(calculation.taxableIncome)}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Deductions Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Deductions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Rental property result</Label>
                <Link
                  href="/reports/tax"
                  className="text-xs text-primary flex items-center gap-1"
                >
                  View breakdown
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-muted-foreground">
                  $
                </span>
                <Input
                  type="number"
                  className="pl-7"
                  value={
                    formState.rentalOverride ?? String(rentalResult?.netResult ?? 0)
                  }
                  onChange={(e) =>
                    setFormState({ ...formState, rentalOverride: e.target.value })
                  }
                />
              </div>
              {formState.rentalOverride !== null && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setFormState({ ...formState, rentalOverride: null })
                  }
                  className="text-xs"
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Reset to actual
                </Button>
              )}
              <p className="text-xs text-muted-foreground">
                Based on {rentalResult?.transactionCount ?? 0} transactions
              </p>
              {forecast && (
                <div className="text-xs text-muted-foreground">
                  <ForecastAnnotation
                    actual={Math.abs(rentalResult?.netResult ?? 0)}
                    forecast={Math.abs(forecast.netRentalResult.forecast)}
                  />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="otherDeductions">Other deductions</Label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-muted-foreground">
                  $
                </span>
                <Input
                  id="otherDeductions"
                  type="number"
                  className="pl-7"
                  value={formState.otherDeductions}
                  onChange={(e) =>
                    setFormState({ ...formState, otherDeductions: e.target.value })
                  }
                  placeholder="0"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Work expenses, donations, income protection, etc.
              </p>
            </div>

            {calculation && (
              <div className="pt-2 border-t">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total deductions</span>
                  <span className="font-medium">
                    {formatCurrency(calculation.totalDeductions)}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tax Calculation */}
      {calculation && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Tax Calculation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Tax on taxable income</span>
                <span>{formatCurrency(calculation.baseTax)}</span>
              </div>
              <div className="flex justify-between">
                <span>Medicare levy (2%)</span>
                <span>{formatCurrency(calculation.medicareLevy)}</span>
              </div>
              <div className="flex justify-between">
                <span>
                  Medicare Levy Surcharge
                  {calculation.mlsApplies && (
                    <span className="text-muted-foreground ml-1">
                      (no PHI, income above{" "}
                      {formatCurrency(calculation.mlsThreshold)})
                    </span>
                  )}
                </span>
                <span>{formatCurrency(calculation.medicareLevySurcharge)}</span>
              </div>
              <div className="flex justify-between">
                <span>HECS/HELP repayment</span>
                <span>{formatCurrency(calculation.hecsRepayment)}</span>
              </div>
              <div className="flex justify-between border-t pt-2 font-medium">
                <span>Total tax liability</span>
                <span>{formatCurrency(calculation.totalTaxLiability)}</span>
              </div>
              {forecast?.taxPosition.forecast && forecast.monthsElapsed < 12 && (
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Projected full year</span>
                  <span>{formatCurrency(forecast.taxPosition.forecast.totalTaxLiability)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Less: PAYG already paid</span>
                <span className="text-green-600">
                  -{formatCurrency(calculation.paygWithheld)}
                </span>
              </div>
              <div className="flex justify-between border-t pt-2 font-bold text-base">
                <span>
                  {calculation.isRefund ? "ESTIMATED REFUND" : "ESTIMATED OWING"}
                </span>
                <span
                  className={
                    calculation.isRefund ? "text-green-600" : "text-amber-600"
                  }
                >
                  {formatCurrency(Math.abs(calculation.refundOrOwing))}
                </span>
              </div>
              {forecast?.taxPosition.forecast && forecast.monthsElapsed < 12 && (
                <div className="flex justify-between text-xs text-muted-foreground pt-1">
                  <span>Projected full year</span>
                  <span className={
                    forecast.taxPosition.forecast.isRefund ? "text-green-600" : "text-amber-600"
                  }>
                    {formatCurrency(Math.abs(forecast.taxPosition.forecast.refundOrOwing))}
                    {" "}{forecast.taxPosition.forecast.isRefund ? "refund" : "owing"}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tax Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Tax Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="hasHecsDebt"
              checked={formState.hasHecsDebt}
              onCheckedChange={(checked) =>
                setFormState({ ...formState, hasHecsDebt: !!checked })
              }
            />
            <Label htmlFor="hasHecsDebt">I have a HECS/HELP debt</Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="hasPrivateHealth"
              checked={formState.hasPrivateHealth}
              onCheckedChange={(checked) =>
                setFormState({ ...formState, hasPrivateHealth: !!checked })
              }
            />
            <Label htmlFor="hasPrivateHealth">
              I have private hospital cover
            </Label>
          </div>

          <div className="space-y-2">
            <Label>Family status</Label>
            <Select
              value={formState.familyStatus}
              onValueChange={(v) =>
                setFormState({ ...formState, familyStatus: v as FamilyStatus })
              }
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="single">Single</SelectItem>
                <SelectItem value="couple">Couple</SelectItem>
                <SelectItem value="family">Family</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {showFamilyFields && (
            <>
              <div className="space-y-2">
                <Label htmlFor="dependentChildren">Dependent children</Label>
                <Input
                  id="dependentChildren"
                  type="number"
                  className="w-[100px]"
                  min="0"
                  value={formState.dependentChildren}
                  onChange={(e) =>
                    setFormState({
                      ...formState,
                      dependentChildren: e.target.value,
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="partnerIncome">Partner&apos;s taxable income</Label>
                <div className="relative w-[200px]">
                  <span className="absolute left-3 top-2.5 text-muted-foreground">
                    $
                  </span>
                  <Input
                    id="partnerIncome"
                    type="number"
                    className="pl-7"
                    value={formState.partnerIncome}
                    onChange={(e) =>
                      setFormState({ ...formState, partnerIncome: e.target.value })
                    }
                    placeholder="0"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Used for family MLS threshold only
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Unsaved Changes Bar */}
      {hasChanges && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-800">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm font-medium">You have unsaved changes</span>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleReset}>
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Reset
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={saveProfile.isPending}
                >
                  {saveProfile.isPending ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-1" />
                  )}
                  Save to profile
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
