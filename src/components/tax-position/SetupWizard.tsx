// src/components/tax-position/SetupWizard.tsx

"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc/client";
import { formatCurrency } from "@/lib/utils";
import { ArrowLeft, ArrowRight, Home, Loader2, PartyPopper } from "lucide-react";
import { toast } from "sonner";

type FamilyStatus = "single" | "couple" | "family";

interface SetupWizardProps {
  financialYear: number;
  rentalNetResult: number;
  onComplete: () => void;
  onCancel: () => void;
}

interface WizardState {
  grossSalary: string;
  paygWithheld: string;
  hasHecsDebt: boolean;
  hasPrivateHealth: boolean;
  familyStatus: FamilyStatus;
  dependentChildren: string;
  partnerIncome: string;
  otherDeductions: string;
}

const TOTAL_STEPS = 5;

export function SetupWizard({
  financialYear,
  rentalNetResult,
  onComplete,
  onCancel,
}: SetupWizardProps) {
  const [step, setStep] = useState(1);
  const [state, setState] = useState<WizardState>({
    grossSalary: "",
    paygWithheld: "",
    hasHecsDebt: false,
    hasPrivateHealth: true,
    familyStatus: "single",
    dependentChildren: "0",
    partnerIncome: "",
    otherDeductions: "0",
  });

  const saveProfile = trpc.taxPosition.saveProfile.useMutation({
    onSuccess: () => {
      setStep(TOTAL_STEPS + 1); // completion screen
    },
    onError: (error) => {
      toast.error(error.message || "Failed to save profile");
    },
  });

  const { data: calculation } = trpc.taxPosition.calculate.useQuery(
    {
      financialYear,
      grossSalary: parseFloat(state.grossSalary) || 0,
      paygWithheld: parseFloat(state.paygWithheld) || 0,
      rentalNetResult,
      otherDeductions: parseFloat(state.otherDeductions) || 0,
      hasHecsDebt: state.hasHecsDebt,
      hasPrivateHealth: state.hasPrivateHealth,
      familyStatus: state.familyStatus,
      dependentChildren: parseInt(state.dependentChildren) || 0,
      partnerIncome: parseFloat(state.partnerIncome) || 0,
    },
    {
      enabled: step === TOTAL_STEPS + 1, // only on completion
    }
  );

  const handleNext = () => {
    if (step < TOTAL_STEPS) {
      setStep(step + 1);
    } else {
      // Save profile
      saveProfile.mutate({
        financialYear,
        grossSalary: parseFloat(state.grossSalary) || undefined,
        paygWithheld: parseFloat(state.paygWithheld) || undefined,
        otherDeductions: parseFloat(state.otherDeductions) || 0,
        hasHecsDebt: state.hasHecsDebt,
        hasPrivateHealth: state.hasPrivateHealth,
        familyStatus: state.familyStatus,
        dependentChildren: parseInt(state.dependentChildren) || 0,
        partnerIncome: parseFloat(state.partnerIncome) || undefined,
        isComplete: true,
      });
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleSkip = () => {
    handleNext();
  };

  const fyLabel = `FY ${financialYear - 1}-${String(financialYear).slice(-2)}`;

  // Completion screen
  if (step > TOTAL_STEPS) {
    return (
      <div className="max-w-lg mx-auto">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                  <PartyPopper className="h-6 w-6 text-green-600" />
                </div>
              </div>
              <h3 className="text-xl font-semibold">Your estimated refund</h3>
              {calculation ? (
                <>
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
                      {formatCurrency(Math.abs(calculation.propertySavings))} in tax!
                    </p>
                  )}
                  <div className="border-t pt-4 mt-4 text-sm text-left space-y-1">
                    <div className="flex justify-between">
                      <span>Gross salary</span>
                      <span>{formatCurrency(Math.abs(calculation.grossSalary))}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Rental result</span>
                      <span>
                        {calculation.rentalNetResult < 0 ? "-" : ""}
                        {formatCurrency(Math.abs(calculation.rentalNetResult))}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Tax payable</span>
                      <span>{formatCurrency(Math.abs(calculation.totalTaxLiability))}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>PAYG paid</span>
                      <span>-{formatCurrency(Math.abs(calculation.paygWithheld))}</span>
                    </div>
                  </div>
                </>
              ) : (
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
              )}
              <Button onClick={onComplete} className="w-full mt-4">
                View full breakdown
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Let&apos;s estimate your tax refund</CardTitle>
            <span className="text-sm text-muted-foreground">
              Step {step}/{TOTAL_STEPS}
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Step 1: Gross Salary */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h3 className="font-medium">What&apos;s your annual gross salary?</h3>
                <p className="text-sm text-muted-foreground">
                  Before tax, from your payslip or contract
                </p>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-muted-foreground">
                  $
                </span>
                <Input
                  type="number"
                  className="pl-7 text-lg"
                  value={state.grossSalary}
                  onChange={(e) =>
                    setState({ ...state, grossSalary: e.target.value })
                  }
                  placeholder="95,000"
                  autoFocus
                />
              </div>
            </div>
          )}

          {/* Step 2: PAYG Withheld */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h3 className="font-medium">How much tax has been withheld this {fyLabel}?</h3>
                <p className="text-sm text-muted-foreground">
                  Check your payslips or estimate: salary x 0.25 is typical
                </p>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-muted-foreground">
                  $
                </span>
                <Input
                  type="number"
                  className="pl-7 text-lg"
                  value={state.paygWithheld}
                  onChange={(e) =>
                    setState({ ...state, paygWithheld: e.target.value })
                  }
                  placeholder="22,000"
                  autoFocus
                />
              </div>
            </div>
          )}

          {/* Step 3: HECS */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h3 className="font-medium">Do you have a HECS/HELP debt?</h3>
                <p className="text-sm text-muted-foreground">
                  Study loan that gets repaid through your tax return
                </p>
              </div>
              <div className="flex gap-4">
                <Button
                  variant={state.hasHecsDebt ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => setState({ ...state, hasHecsDebt: true })}
                >
                  Yes
                </Button>
                <Button
                  variant={!state.hasHecsDebt ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => setState({ ...state, hasHecsDebt: false })}
                >
                  No
                </Button>
              </div>
            </div>
          )}

          {/* Step 4: Private Health & Family */}
          {step === 4 && (
            <div className="space-y-6">
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium">Do you have private hospital cover?</h3>
                  <p className="text-sm text-muted-foreground">
                    Avoids Medicare Levy Surcharge for higher incomes
                  </p>
                </div>
                <div className="flex gap-4">
                  <Button
                    variant={state.hasPrivateHealth ? "default" : "outline"}
                    className="flex-1"
                    onClick={() => setState({ ...state, hasPrivateHealth: true })}
                  >
                    Yes
                  </Button>
                  <Button
                    variant={!state.hasPrivateHealth ? "default" : "outline"}
                    className="flex-1"
                    onClick={() => setState({ ...state, hasPrivateHealth: false })}
                  >
                    No
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="font-medium">What&apos;s your family status?</h3>
                </div>
                <Select
                  value={state.familyStatus}
                  onValueChange={(v) =>
                    setState({ ...state, familyStatus: v as FamilyStatus })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single">Single</SelectItem>
                    <SelectItem value="couple">Couple</SelectItem>
                    <SelectItem value="family">Family</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(state.familyStatus === "couple" ||
                state.familyStatus === "family") && (
                <>
                  <div className="space-y-2">
                    <Label>Dependent children</Label>
                    <Input
                      type="number"
                      min="0"
                      value={state.dependentChildren}
                      onChange={(e) =>
                        setState({ ...state, dependentChildren: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Partner&apos;s taxable income</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-muted-foreground">
                        $
                      </span>
                      <Input
                        type="number"
                        className="pl-7"
                        value={state.partnerIncome}
                        onChange={(e) =>
                          setState({ ...state, partnerIncome: e.target.value })
                        }
                        placeholder="0"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Used for MLS family threshold only
                    </p>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Step 5: Other Deductions */}
          {step === 5 && (
            <div className="space-y-4">
              <div>
                <h3 className="font-medium">Any other tax deductions?</h3>
                <p className="text-sm text-muted-foreground">
                  Work expenses, donations, income protection. Enter $0 if unsure.
                </p>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-muted-foreground">
                  $
                </span>
                <Input
                  type="number"
                  className="pl-7 text-lg"
                  value={state.otherDeductions}
                  onChange={(e) =>
                    setState({ ...state, otherDeductions: e.target.value })
                  }
                  placeholder="0"
                  autoFocus
                />
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between pt-4">
            <div>
              {step > 1 ? (
                <Button variant="ghost" onClick={handleBack}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
              ) : (
                <Button variant="ghost" onClick={onCancel}>
                  Cancel
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={handleSkip}>
                Skip
              </Button>
              <Button onClick={handleNext} disabled={saveProfile.isPending}>
                {saveProfile.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : step === TOTAL_STEPS ? (
                  "Calculate"
                ) : (
                  <>
                    Continue
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
