"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, ArrowLeft, Play } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

type FactorType = "interest_rate" | "vacancy" | "rent_change" | "expense_change" | "sell_property" | "buy_property";

interface FactorFormData {
  factorType: FactorType;
  config: Record<string, unknown>;
  startMonth: number;
  durationMonths?: number;
  propertyId?: string;
}

function NewScenarioContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const branchFromId = searchParams?.get("branch");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [timeHorizon, setTimeHorizon] = useState(60);
  const [marginalTaxRate, setMarginalTaxRate] = useState(0.37);
  const [factors, setFactors] = useState<FactorFormData[]>([]);

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  const { data: properties } = trpc.property.list.useQuery();
  const { data: parentScenario } = trpc.scenario.get.useQuery(
    { id: branchFromId! },
    { enabled: !!branchFromId }
  );

  const createMutation = trpc.scenario.create.useMutation({
    onSuccess: (scenario) => {
      toast.success("Scenario created");
      router.push(`/reports/scenarios/${scenario.id}`);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const toggleSection = (section: string) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const addFactor = (factorType: FactorType, config: Record<string, unknown>) => {
    setFactors((prev) => [
      ...prev,
      { factorType, config, startMonth: 0 },
    ]);
  };

  const removeFactor = (index: number) => {
    setFactors((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (!name.trim()) {
      toast.error("Please enter a scenario name");
      return;
    }

    createMutation.mutate({
      name,
      description: description || undefined,
      timeHorizonMonths: timeHorizon,
      marginalTaxRate,
      parentScenarioId: branchFromId || undefined,
      factors: factors.length > 0 ? factors : undefined,
    });
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Link href="/reports/scenarios">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h2 className="text-2xl font-bold">
            {branchFromId ? "Branch Scenario" : "New Scenario"}
          </h2>
          {parentScenario && (
            <p className="text-muted-foreground">
              Branching from: {parentScenario.name}
            </p>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Basic Info</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Scenario Name</Label>
            <Input
              id="name"
              placeholder="e.g., Rate rise stress test"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Input
              id="description"
              placeholder="What are you modeling?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="horizon">Time Horizon</Label>
            <Select
              value={String(timeHorizon)}
              onValueChange={(v) => setTimeHorizon(Number(v))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="12">1 year (12 months)</SelectItem>
                <SelectItem value="24">2 years (24 months)</SelectItem>
                <SelectItem value="36">3 years (36 months)</SelectItem>
                <SelectItem value="60">5 years (60 months)</SelectItem>
                <SelectItem value="120">10 years (120 months)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="taxRate">Marginal Tax Rate (for CGT)</Label>
            <Select
              value={String(marginalTaxRate)}
              onValueChange={(v) => setMarginalTaxRate(Number(v))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">0% (Tax-free threshold)</SelectItem>
                <SelectItem value="0.19">19% ($18,201 - $45,000)</SelectItem>
                <SelectItem value="0.325">32.5% ($45,001 - $120,000)</SelectItem>
                <SelectItem value="0.37">37% ($120,001 - $180,000)</SelectItem>
                <SelectItem value="0.45">45% ($180,001+)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Used to calculate CGT payable on property sales
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Factors</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {/* Interest Rate Section */}
          <Collapsible open={openSections.interest_rate}>
            <CollapsibleTrigger
              className="flex items-center justify-between w-full p-3 hover:bg-muted rounded-lg"
              onClick={() => toggleSection("interest_rate")}
            >
              <span className="font-medium">Interest Rates</span>
              {openSections.interest_rate ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </CollapsibleTrigger>
            <CollapsibleContent className="p-3 space-y-3">
              <div className="space-y-2">
                <Label>Rate Change (%)</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="e.g., 2.0"
                    id="interest-rate-change"
                  />
                  <Button
                    variant="outline"
                    onClick={() => {
                      const input = document.getElementById(
                        "interest-rate-change"
                      ) as HTMLInputElement;
                      if (input?.value) {
                        addFactor("interest_rate", {
                          changePercent: Number(input.value),
                          applyTo: "all",
                        });
                        input.value = "";
                      }
                    }}
                  >
                    Add
                  </Button>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Vacancy Section */}
          <Collapsible open={openSections.vacancy}>
            <CollapsibleTrigger
              className="flex items-center justify-between w-full p-3 hover:bg-muted rounded-lg"
              onClick={() => toggleSection("vacancy")}
            >
              <span className="font-medium">Vacancy</span>
              {openSections.vacancy ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </CollapsibleTrigger>
            <CollapsibleContent className="p-3 space-y-3">
              <div className="space-y-2">
                <Label>Property</Label>
                <Select>
                  <SelectTrigger id="vacancy-property">
                    <SelectValue placeholder="Select property" />
                  </SelectTrigger>
                  <SelectContent>
                    {properties?.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.address}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Duration (months)</Label>
                <div className="flex gap-2">
                  <Input type="number" placeholder="e.g., 3" id="vacancy-months" />
                  <Button variant="outline">Add</Button>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Rent Change Section */}
          <Collapsible open={openSections.rent_change}>
            <CollapsibleTrigger
              className="flex items-center justify-between w-full p-3 hover:bg-muted rounded-lg"
              onClick={() => toggleSection("rent_change")}
            >
              <span className="font-medium">Rent Changes</span>
              {openSections.rent_change ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </CollapsibleTrigger>
            <CollapsibleContent className="p-3 space-y-3">
              <div className="space-y-2">
                <Label>Rent Change (%)</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    step="1"
                    placeholder="e.g., -10"
                    id="rent-change"
                  />
                  <Button
                    variant="outline"
                    onClick={() => {
                      const input = document.getElementById(
                        "rent-change"
                      ) as HTMLInputElement;
                      if (input?.value) {
                        addFactor("rent_change", {
                          changePercent: Number(input.value),
                        });
                        input.value = "";
                      }
                    }}
                  >
                    Add
                  </Button>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Expense Change Section */}
          <Collapsible open={openSections.expense_change}>
            <CollapsibleTrigger
              className="flex items-center justify-between w-full p-3 hover:bg-muted rounded-lg"
              onClick={() => toggleSection("expense_change")}
            >
              <span className="font-medium">Expense Changes</span>
              {openSections.expense_change ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </CollapsibleTrigger>
            <CollapsibleContent className="p-3 space-y-3">
              <div className="space-y-2">
                <Label>Expense Change (%)</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    step="1"
                    placeholder="e.g., 20"
                    id="expense-change"
                  />
                  <Button
                    variant="outline"
                    onClick={() => {
                      const input = document.getElementById(
                        "expense-change"
                      ) as HTMLInputElement;
                      if (input?.value) {
                        addFactor("expense_change", {
                          changePercent: Number(input.value),
                        });
                        input.value = "";
                      }
                    }}
                  >
                    Add
                  </Button>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Sell Property Section */}
          <Collapsible open={openSections.sell_property}>
            <CollapsibleTrigger
              className="flex items-center justify-between w-full p-3 hover:bg-muted rounded-lg"
              onClick={() => toggleSection("sell_property")}
            >
              <span className="font-medium">Sell Property</span>
              {openSections.sell_property ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </CollapsibleTrigger>
            <CollapsibleContent className="p-3 space-y-3">
              <div className="space-y-2">
                <Label>Property to Sell</Label>
                <Select>
                  <SelectTrigger id="sell-property-id">
                    <SelectValue placeholder="Select property" />
                  </SelectTrigger>
                  <SelectContent>
                    {properties?.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.address}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Sale Price ($)</Label>
                  <Input
                    type="number"
                    placeholder="e.g., 850000"
                    id="sell-price"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Selling Costs ($)</Label>
                  <Input
                    type="number"
                    placeholder="e.g., 25000"
                    id="sell-costs"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Settlement Month</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min="1"
                    max="120"
                    placeholder="e.g., 12"
                    id="sell-month"
                  />
                  <Button
                    variant="outline"
                    onClick={() => {
                      const propSelect = document.getElementById("sell-property-id") as HTMLSelectElement;
                      const priceInput = document.getElementById("sell-price") as HTMLInputElement;
                      const costsInput = document.getElementById("sell-costs") as HTMLInputElement;
                      const monthInput = document.getElementById("sell-month") as HTMLInputElement;

                      const propertyId = propSelect?.querySelector("[data-state=checked]")?.getAttribute("data-value") ||
                        (propSelect as unknown as { value?: string })?.value;

                      if (propertyId && priceInput?.value && monthInput?.value) {
                        addFactor("sell_property", {
                          propertyId,
                          salePrice: Number(priceInput.value),
                          sellingCosts: Number(costsInput?.value || 0),
                          settlementMonth: Number(monthInput.value),
                        });
                        priceInput.value = "";
                        costsInput.value = "";
                        monthInput.value = "";
                      }
                    }}
                  >
                    Add
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  CGT will be calculated automatically based on purchase price and holding period
                </p>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Buy Property Section */}
          <Collapsible open={openSections.buy_property}>
            <CollapsibleTrigger
              className="flex items-center justify-between w-full p-3 hover:bg-muted rounded-lg"
              onClick={() => toggleSection("buy_property")}
            >
              <span className="font-medium">Buy Property</span>
              {openSections.buy_property ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </CollapsibleTrigger>
            <CollapsibleContent className="p-3 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Purchase Price ($)</Label>
                  <Input
                    type="number"
                    placeholder="e.g., 600000"
                    id="buy-price"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Deposit ($)</Label>
                  <Input
                    type="number"
                    placeholder="e.g., 120000"
                    id="buy-deposit"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Loan Amount ($)</Label>
                  <Input
                    type="number"
                    placeholder="e.g., 480000"
                    id="buy-loan"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Interest Rate (%)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="e.g., 6.5"
                    id="buy-rate"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Expected Rent ($/mo)</Label>
                  <Input
                    type="number"
                    placeholder="e.g., 2500"
                    id="buy-rent"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Expected Expenses ($/mo)</Label>
                  <Input
                    type="number"
                    placeholder="e.g., 600"
                    id="buy-expenses"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Purchase Month</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min="0"
                    max="120"
                    placeholder="e.g., 6"
                    id="buy-month"
                  />
                  <Button
                    variant="outline"
                    onClick={() => {
                      const priceInput = document.getElementById("buy-price") as HTMLInputElement;
                      const depositInput = document.getElementById("buy-deposit") as HTMLInputElement;
                      const loanInput = document.getElementById("buy-loan") as HTMLInputElement;
                      const rateInput = document.getElementById("buy-rate") as HTMLInputElement;
                      const rentInput = document.getElementById("buy-rent") as HTMLInputElement;
                      const expensesInput = document.getElementById("buy-expenses") as HTMLInputElement;
                      const monthInput = document.getElementById("buy-month") as HTMLInputElement;

                      if (priceInput?.value && loanInput?.value && monthInput?.value) {
                        addFactor("buy_property", {
                          purchasePrice: Number(priceInput.value),
                          deposit: Number(depositInput?.value || 0),
                          loanAmount: Number(loanInput.value),
                          interestRate: Number(rateInput?.value || 6.0),
                          expectedRent: Number(rentInput?.value || 0),
                          expectedExpenses: Number(expensesInput?.value || 0),
                          purchaseMonth: Number(monthInput.value),
                        });
                        priceInput.value = "";
                        depositInput.value = "";
                        loanInput.value = "";
                        rateInput.value = "";
                        rentInput.value = "";
                        expensesInput.value = "";
                        monthInput.value = "";
                      }
                    }}
                  >
                    Add
                  </Button>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Configured Factors Summary */}
          {factors.length > 0 && (
            <div className="mt-4 p-3 bg-muted rounded-lg">
              <p className="font-medium mb-2">Configured Factors:</p>
              <ul className="space-y-1">
                {factors.map((f, i) => (
                  <li key={i} className="flex items-center justify-between text-sm">
                    <span>
                      {f.factorType}: {JSON.stringify(f.config)}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFactor(i)}
                    >
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" asChild>
          <Link href="/reports/scenarios">Cancel</Link>
        </Button>
        <Button onClick={handleSubmit} disabled={createMutation.isPending}>
          <Play className="w-4 h-4 mr-2" />
          {createMutation.isPending ? "Creating..." : "Create & Run"}
        </Button>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div className="h-8 w-48 bg-muted animate-pulse rounded" />
      <div className="h-64 bg-muted animate-pulse rounded-lg" />
    </div>
  );
}

export default function NewScenarioPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <NewScenarioContent />
    </Suspense>
  );
}
