// src/app/(dashboard)/reports/tax-position/TaxPositionContent.tsx

"use client";

import { useState, useMemo } from "react";

import Link from "next/link";
import { toast } from "sonner";
import {
  AlertCircle,
  Save,
  RotateCcw,
  ExternalLink,
  Loader2,
  ChevronDown,
  Settings2,
} from "lucide-react";

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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { trpc } from "@/lib/trpc/client";
import { SetupWizard } from "@/components/tax-position/SetupWizard";
import { ForecastAnnotation } from "@/components/tax-position/ForecastAnnotation";
import { TaxHeroCard } from "@/components/tax-position/TaxHeroCard";
import { TaxSummaryStrip } from "@/components/tax-position/TaxSummaryStrip";
import { PropertyBreakdownTable } from "@/components/tax-position/PropertyBreakdownTable";
import { TaxOptimizationSection } from "@/components/tax-position/TaxOptimizationSection";
import { formatCurrency, cn } from "@/lib/utils";

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
  const [profileOpen, setProfileOpen] = useState<boolean | null>(null);

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

  const { data: propertyBreakdown } = trpc.taxPosition.getPropertyBreakdown.useQuery(
    { financialYear: selectedYear! },
    { enabled: !!selectedYear }
  );

  // Default: collapsed when profile is complete
  const isProfileOpen = profileOpen ?? !profile?.isComplete;

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
            setFormEdits(null);
            setProfileOpen(null);
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

      {/* Hero Card */}
      {calculation && (
        <TaxHeroCard
          refundOrOwing={calculation.refundOrOwing}
          isRefund={calculation.isRefund}
          propertySavings={calculation.propertySavings}
          forecast={forecast?.taxPosition.forecast ?? null}
          monthsElapsed={forecast?.monthsElapsed}
          confidence={forecast?.confidence}
        />
      )}

      {/* Summary Strip */}
      {calculation && (
        <TaxSummaryStrip
          taxableIncome={calculation.taxableIncome}
          marginalRate={calculation.marginalRate}
          totalDeductions={calculation.totalDeductions}
          propertySavings={calculation.propertySavings}
        />
      )}

      {/* Collapsible Tax Profile Editor */}
      <Collapsible open={isProfileOpen} onOpenChange={setProfileOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <button className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-2">
                <Settings2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-lg font-semibold">Tax Profile</span>
                {profile?.isComplete && !isProfileOpen && (
                  <span className="text-xs text-muted-foreground ml-2">
                    {formatCurrency(parseFloat(formState.grossSalary) || 0)} salary
                    {formState.hasHecsDebt ? " + HECS" : ""}
                    {!formState.hasPrivateHealth ? " (no PHI)" : ""}
                  </span>
                )}
              </div>
              <ChevronDown
                className={cn(
                  "h-4 w-4 text-muted-foreground transition-transform",
                  isProfileOpen && "rotate-180"
                )}
              />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 space-y-6">
              {/* Income & Deductions Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Income Section */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Income
                  </h3>
                  <div className="space-y-2">
                    <Label htmlFor="grossSalary">Gross salary</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
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
                      <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
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
                </div>

                {/* Deductions Section */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Deductions
                  </h3>
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
                      <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
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
                      <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
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
                </div>
              </div>

              {/* Tax Settings */}
              <div className="space-y-4 border-t pt-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Settings
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                        <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
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
                  </div>
                )}
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Unsaved Changes Bar */}
      {hasChanges && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-400">
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

      {/* Per-Property Breakdown */}
      {propertyBreakdown && (
        <PropertyBreakdownTable
          properties={propertyBreakdown.properties}
          unallocated={propertyBreakdown.unallocated}
          totals={propertyBreakdown.totals}
          financialYear={selectedYear}
        />
      )}

      {/* Tax Optimization Tips */}
      <TaxOptimizationSection financialYear={selectedYear} />
    </div>
  );
}
