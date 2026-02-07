"use client";

import { useState } from "react";
import {
  X,
  ChevronRight,
  Building2,
  Landmark,
  CheckCircle2,
  Circle,
  Minus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc/client";
import { useRouter } from "next/navigation";

interface EnhancedWizardProps {
  onClose: () => void;
}

type WizardStep = "welcome" | "property" | "bank" | "done";

const STEPS: WizardStep[] = ["welcome", "property", "bank", "done"];
const STATES = ["NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT"] as const;

const STEP_LABELS: Record<WizardStep, string> = {
  welcome: "Welcome",
  property: "Add Property",
  bank: "Connect Bank",
  done: "All Set",
};

export function EnhancedWizard({ onClose }: EnhancedWizardProps) {
  const [step, setStep] = useState<WizardStep>("welcome");
  const [propertyAdded, setPropertyAdded] = useState(false);
  const [propertyData, setPropertyData] = useState({
    address: "",
    suburb: "",
    state: "" as (typeof STATES)[number] | "",
    postcode: "",
    purchasePrice: "",
    purchaseDate: "",
  });
  const [showSuccess, setShowSuccess] = useState(false);
  const router = useRouter();
  const utils = trpc.useUtils();

  const createProperty = trpc.property.create.useMutation({
    onSuccess: () => {
      utils.onboarding.getProgress.invalidate();
      setPropertyAdded(true);
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setStep("bank");
      }, 1500);
    },
  });

  const dismissWizard = trpc.onboarding.dismissWizard.useMutation({
    onSuccess: () => {
      utils.onboarding.getProgress.invalidate();
      onClose();
    },
  });

  const handlePropertySubmit = async () => {
    if (!propertyData.address || !propertyData.state) return;
    await createProperty.mutateAsync({
      address: propertyData.address,
      suburb: propertyData.suburb,
      state: propertyData.state,
      postcode: propertyData.postcode,
      purchasePrice: propertyData.purchasePrice || "0",
      purchaseDate:
        propertyData.purchaseDate || new Date().toISOString().split("T")[0],
    });
  };

  const handleSkip = () => {
    const currentIndex = STEPS.indexOf(step);
    if (currentIndex < STEPS.length - 1) {
      setStep(STEPS[currentIndex + 1]);
    }
  };

  const handleClose = () => {
    dismissWizard.mutate();
  };

  const handleConnectBank = () => {
    dismissWizard.mutate();
    router.push("/banking/connect");
  };

  const handleFinish = () => {
    dismissWizard.mutate();
  };

  const currentStepIndex = STEPS.indexOf(step);
  const progressPercent = (currentStepIndex / (STEPS.length - 1)) * 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/60" onClick={handleClose} />

      {/* Modal */}
      <div className="relative w-full max-w-lg mx-4 bg-card rounded-lg shadow-2xl flex flex-col max-h-[90vh]">
        {/* Progress bar */}
        <div className="px-6 pt-6 pb-2">
          <div className="flex items-center justify-between mb-2">
            <div className="flex gap-1">
              {STEPS.map((s, i) => (
                <span
                  key={s}
                  className={cn(
                    "text-xs",
                    i <= currentStepIndex
                      ? "text-primary font-medium"
                      : "text-muted-foreground"
                  )}
                >
                  {i > 0 && <span className="mx-1 text-muted-foreground">&middot;</span>}
                  {STEP_LABELS[s]}
                </span>
              ))}
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <Progress value={progressPercent} className="h-1" />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {step === "welcome" && (
            <div className="space-y-6 text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Building2 className="w-8 h-8 text-primary" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold">Welcome to BrickTrack</h2>
                <p className="text-muted-foreground">
                  Track your properties, automate expenses, and optimize your tax
                  position.
                </p>
              </div>
              <div className="space-y-3 text-left max-w-xs mx-auto">
                <StepPreview step={1} label="Add your first property" />
                <StepPreview step={2} label="Connect your bank" />
                <StepPreview step={3} label="You're ready!" />
              </div>
            </div>
          )}

          {step === "property" && !showSuccess && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold">Add Your First Property</h2>
                <p className="text-sm text-muted-foreground">
                  Enter the basic details. You can add more information later.
                </p>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="wiz-address">Street Address</Label>
                  <Input
                    id="wiz-address"
                    placeholder="123 Smith Street"
                    value={propertyData.address}
                    onChange={(e) =>
                      setPropertyData({ ...propertyData, address: e.target.value })
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="wiz-suburb">Suburb</Label>
                    <Input
                      id="wiz-suburb"
                      placeholder="Sydney"
                      value={propertyData.suburb}
                      onChange={(e) =>
                        setPropertyData({ ...propertyData, suburb: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="wiz-state">State</Label>
                    <Select
                      value={propertyData.state}
                      onValueChange={(value) =>
                        setPropertyData({
                          ...propertyData,
                          state: value as (typeof STATES)[number],
                        })
                      }
                    >
                      <SelectTrigger id="wiz-state">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {STATES.map((state) => (
                          <SelectItem key={state} value={state}>
                            {state}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wiz-postcode">Postcode</Label>
                  <Input
                    id="wiz-postcode"
                    placeholder="2000"
                    value={propertyData.postcode}
                    onChange={(e) =>
                      setPropertyData({ ...propertyData, postcode: e.target.value })
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="wiz-price">Purchase Price</Label>
                    <Input
                      id="wiz-price"
                      type="number"
                      placeholder="500000"
                      value={propertyData.purchasePrice}
                      onChange={(e) =>
                        setPropertyData({
                          ...propertyData,
                          purchasePrice: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Purchase Date</Label>
                    <DatePicker
                      value={propertyData.purchaseDate}
                      onChange={(date) =>
                        setPropertyData({
                          ...propertyData,
                          purchaseDate: date,
                        })
                      }
                      placeholder="Select purchase date"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === "property" && showSuccess && (
            <div className="space-y-6 text-center py-8">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-xl font-semibold">Property Added!</h2>
              <p className="text-muted-foreground">Moving to the next step...</p>
            </div>
          )}

          {step === "bank" && (
            <div className="space-y-6 text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Landmark className="w-8 h-8 text-primary" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-semibold">Connect Your Bank</h2>
                <p className="text-muted-foreground">
                  Automatically import transactions from your bank account. We use
                  Basiq to securely connect to your bank.
                </p>
              </div>
              <div className="space-y-3 text-left max-w-xs mx-auto">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
                  <span className="text-sm">Bank-level encryption</span>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
                  <span className="text-sm">Read-only access to transactions</span>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
                  <span className="text-sm">Automatic transaction imports</span>
                </div>
              </div>
            </div>
          )}

          {step === "done" && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8 text-green-600" />
                </div>
                <h2 className="text-xl font-semibold">You're All Set!</h2>
                <p className="text-muted-foreground">
                  Here's what you've done and what's next.
                </p>
              </div>
              <div className="space-y-2 max-w-xs mx-auto">
                <CompletionItem
                  label="Add a property"
                  status={propertyAdded ? "done" : "skipped"}
                />
                <CompletionItem label="Connect your bank" status="skipped" />
                <div className="pt-2 border-t mt-3">
                  <p className="text-xs text-muted-foreground mb-2">Still to do:</p>
                  <CompletionItem label="Categorize 10 transactions" status="pending" />
                  <CompletionItem label="Set up recurring transaction" status="pending" />
                  <CompletionItem label="Add property value estimate" status="pending" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-4 flex justify-between items-center">
          {step !== "welcome" && step !== "done" && (
            <Button variant="ghost" size="sm" onClick={handleSkip}>
              Skip for now
            </Button>
          )}
          {step === "welcome" && <div />}
          {step === "done" && <div />}

          {step === "welcome" && (
            <Button onClick={() => setStep("property")}>
              Get Started
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          )}
          {step === "property" && !showSuccess && (
            <Button
              onClick={handlePropertySubmit}
              disabled={
                !propertyData.address ||
                !propertyData.suburb ||
                !propertyData.state ||
                !propertyData.postcode ||
                createProperty.isPending
              }
            >
              {createProperty.isPending ? "Saving..." : "Save & Continue"}
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          )}
          {step === "bank" && (
            <Button onClick={handleConnectBank}>
              Connect Bank
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          )}
          {step === "done" && (
            <Button onClick={handleFinish} className="ml-auto">
              Go to Dashboard
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function StepPreview({ step, label }: { step: number; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
        {step}
      </div>
      <span className="text-sm">{label}</span>
    </div>
  );
}

function CompletionItem({
  label,
  status,
}: {
  label: string;
  status: "done" | "skipped" | "pending";
}) {
  return (
    <div className="flex items-center gap-3 py-1">
      {status === "done" && (
        <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
      )}
      {status === "skipped" && (
        <Minus className="w-4 h-4 text-muted-foreground shrink-0" />
      )}
      {status === "pending" && (
        <Circle className="w-4 h-4 text-muted-foreground shrink-0" />
      )}
      <span
        className={cn(
          "text-sm",
          status === "done" && "text-foreground",
          status === "skipped" && "text-muted-foreground",
          status === "pending" && "text-muted-foreground"
        )}
      >
        {label}
      </span>
    </div>
  );
}
