"use client";

import { useState } from "react";
import { X, ChevronRight, Building2, Landmark, CheckCircle2 } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc/client";
import { useRouter } from "next/navigation";

interface OnboardingWizardProps {
  onClose: () => void;
}

type WizardStep = "welcome" | "property" | "bank" | "done";

const STATES = ["NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT"] as const;

export function OnboardingWizard({ onClose }: OnboardingWizardProps) {
  const [step, setStep] = useState<WizardStep>("welcome");
  const [propertyData, setPropertyData] = useState({
    address: "",
    suburb: "",
    state: "" as (typeof STATES)[number] | "",
    postcode: "",
    purchasePrice: "",
    purchaseDate: "",
  });
  const router = useRouter();
  const utils = trpc.useUtils();

  const createProperty = trpc.property.create.useMutation({
    onSuccess: () => {
      utils.onboarding.getProgress.invalidate();
      setStep("bank");
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
      purchaseDate: propertyData.purchaseDate || new Date().toISOString().split("T")[0],
    });
  };

  const handleSkip = () => {
    if (step === "welcome") setStep("property");
    else if (step === "property") setStep("bank");
    else if (step === "bank") setStep("done");
  };

  const handleClose = () => {
    dismissWizard.mutate();
  };

  const handleFinish = () => {
    dismissWizard.mutate();
  };

  const handleConnectBank = () => {
    dismissWizard.mutate();
    router.push("/banking/connect");
  };

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={handleClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-card z-50 shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Get Started</h2>
          <Button variant="ghost" size="icon" onClick={handleClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === "welcome" && (
            <div className="space-y-6">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <Building2 className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">Welcome to BrickTrack</h3>
                <p className="text-muted-foreground">
                  Let's set up your portfolio in 3 quick steps. You can always
                  add more details later.
                </p>
              </div>
              <div className="space-y-3">
                <StepIndicator step={1} label="Add your first property" active />
                <StepIndicator step={2} label="Connect your bank" />
                <StepIndicator step={3} label="You're ready!" />
              </div>
            </div>
          )}

          {step === "property" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold">Add Your First Property</h3>
                <p className="text-sm text-muted-foreground">
                  Enter the basic details. You can add more information later.
                </p>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="address">Street Address</Label>
                  <Input
                    id="address"
                    placeholder="123 Smith Street"
                    value={propertyData.address}
                    onChange={(e) =>
                      setPropertyData({ ...propertyData, address: e.target.value })
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="suburb">Suburb</Label>
                    <Input
                      id="suburb"
                      placeholder="Sydney"
                      value={propertyData.suburb}
                      onChange={(e) =>
                        setPropertyData({ ...propertyData, suburb: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">State</Label>
                    <Select
                      value={propertyData.state}
                      onValueChange={(value) =>
                        setPropertyData({
                          ...propertyData,
                          state: value as (typeof STATES)[number],
                        })
                      }
                    >
                      <SelectTrigger id="state">
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
                  <Label htmlFor="postcode">Postcode</Label>
                  <Input
                    id="postcode"
                    placeholder="2000"
                    value={propertyData.postcode}
                    onChange={(e) =>
                      setPropertyData({ ...propertyData, postcode: e.target.value })
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="purchasePrice">Purchase Price</Label>
                    <Input
                      id="purchasePrice"
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

          {step === "bank" && (
            <div className="space-y-6">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <Landmark className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold">Connect Your Bank</h3>
                <p className="text-muted-foreground">
                  Automatically import transactions from your bank account.
                  We use Basiq to securely connect to your bank.
                </p>
              </div>
            </div>
          )}

          {step === "done" && (
            <div className="space-y-6">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold">You're All Set!</h3>
                <p className="text-muted-foreground">
                  Your BrickTrack is ready. Check out your dashboard to
                  see your portfolio summary.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t p-4 flex justify-between">
          {step !== "done" && (
            <Button variant="ghost" onClick={handleSkip}>
              Skip
            </Button>
          )}
          {step === "welcome" && (
            <Button onClick={() => setStep("property")}>
              Get Started
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          )}
          {step === "property" && (
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
              {createProperty.isPending ? "Saving..." : "Continue"}
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
              View Dashboard
            </Button>
          )}
        </div>
      </div>
    </>
  );
}

function StepIndicator({
  step,
  label,
  active = false,
  complete = false,
}: {
  step: number;
  label: string;
  active?: boolean;
  complete?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
          active && "bg-primary text-primary-foreground",
          complete && "bg-green-600 text-white",
          !active && !complete && "bg-muted text-muted-foreground"
        )}
      >
        {complete ? <CheckCircle2 className="w-4 h-4" /> : step}
      </div>
      <span className={cn(active ? "font-medium" : "text-muted-foreground")}>
        {label}
      </span>
    </div>
  );
}
