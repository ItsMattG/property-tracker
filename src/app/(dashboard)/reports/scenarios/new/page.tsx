"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Play, Plus, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FactorCard } from "@/components/scenarios";
import { trpc } from "@/lib/trpc/client";
import { getErrorMessage } from "@/lib/errors";
import {
  FACTOR_TYPES,
  type FactorType,
  interestRateConfigSchema,
  vacancyConfigSchema,
  rentChangeConfigSchema,
  expenseChangeConfigSchema,
  sellPropertyConfigSchema,
  buyPropertyConfigSchema,
} from "@/lib/scenarios";

interface FactorEntry {
  factorType: FactorType;
  config: Record<string, unknown>;
  startMonth: number;
  durationMonths?: number;
}

const FACTOR_LABELS: Record<FactorType, string> = {
  interest_rate: "Interest Rate Change",
  vacancy: "Vacancy Period",
  rent_change: "Rent Change",
  expense_change: "Expense Change",
  sell_property: "Sell Property",
  buy_property: "Buy Property",
};

function NewScenarioContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const branchFromId = searchParams?.get("branch");

  // Scenario settings
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [timeHorizon, setTimeHorizon] = useState(60);
  const [marginalTaxRate, setMarginalTaxRate] = useState(0.37);
  const [factors, setFactors] = useState<FactorEntry[]>([]);

  // Factor input state
  const [addingType, setAddingType] = useState<FactorType | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // Per-type input state
  const [interestChange, setInterestChange] = useState(0);
  const [interestApplyTo, setInterestApplyTo] = useState("all");
  const [vacancyProperty, setVacancyProperty] = useState("");
  const [vacancyMonths, setVacancyMonths] = useState(3);
  const [rentChange, setRentChange] = useState(0);
  const [rentProperty, setRentProperty] = useState("");
  const [expenseChange, setExpenseChange] = useState(0);
  const [expenseCategory, setExpenseCategory] = useState("");
  const [sellProperty, setSellProperty] = useState("");
  const [sellPrice, setSellPrice] = useState(0);
  const [sellCosts, setSellCosts] = useState(0);
  const [sellMonth, setSellMonth] = useState(12);
  const [buyPrice, setBuyPrice] = useState(0);
  const [buyDeposit, setBuyDeposit] = useState(0);
  const [buyLoan, setBuyLoan] = useState(0);
  const [buyRate, setBuyRate] = useState(6.5);
  const [buyRent, setBuyRent] = useState(0);
  const [buyExpenses, setBuyExpenses] = useState(0);
  const [buyMonth, setBuyMonth] = useState(6);
  const [factorStartMonth, setFactorStartMonth] = useState(0);
  const [factorDuration, setFactorDuration] = useState<number | undefined>(
    undefined,
  );

  const { data: properties } = trpc.property.list.useQuery();
  const { data: parentScenario } = trpc.scenario.get.useQuery(
    { id: branchFromId! },
    { enabled: !!branchFromId },
  );

  const createMutation = trpc.scenario.create.useMutation({
    onSuccess: (scenario) => {
      toast.success("Scenario created");
      router.push(`/reports/scenarios/${scenario.id}`);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const propertyList = (properties ?? []).map((p) => ({
    id: p.id,
    address: p.address ?? `Property ${p.id.slice(0, 8)}`,
  }));

  function resetFactorInputs() {
    setInterestChange(0);
    setInterestApplyTo("all");
    setVacancyProperty("");
    setVacancyMonths(3);
    setRentChange(0);
    setRentProperty("");
    setExpenseChange(0);
    setExpenseCategory("");
    setSellProperty("");
    setSellPrice(0);
    setSellCosts(0);
    setSellMonth(12);
    setBuyPrice(0);
    setBuyDeposit(0);
    setBuyLoan(0);
    setBuyRate(6.5);
    setBuyRent(0);
    setBuyExpenses(0);
    setBuyMonth(6);
    setFactorStartMonth(0);
    setFactorDuration(undefined);
    setAddingType(null);
    setEditingIndex(null);
  }

  function addCurrentFactor() {
    if (!addingType) return;

    let config: Record<string, unknown> = {};
    let valid = false;

    switch (addingType) {
      case "interest_rate":
        config = { changePercent: interestChange, applyTo: interestApplyTo };
        valid = interestRateConfigSchema.safeParse(config).success;
        break;
      case "vacancy":
        config = { propertyId: vacancyProperty, months: vacancyMonths };
        valid = vacancyConfigSchema.safeParse(config).success;
        break;
      case "rent_change":
        config = {
          changePercent: rentChange,
          ...(rentProperty ? { propertyId: rentProperty } : {}),
        };
        valid = rentChangeConfigSchema.safeParse(config).success;
        break;
      case "expense_change":
        config = {
          changePercent: expenseChange,
          ...(expenseCategory ? { category: expenseCategory } : {}),
        };
        valid = expenseChangeConfigSchema.safeParse(config).success;
        break;
      case "sell_property":
        config = {
          propertyId: sellProperty,
          salePrice: sellPrice,
          sellingCosts: sellCosts,
          settlementMonth: sellMonth,
        };
        valid = sellPropertyConfigSchema.safeParse(config).success;
        break;
      case "buy_property":
        config = {
          purchasePrice: buyPrice,
          deposit: buyDeposit,
          loanAmount: buyLoan,
          interestRate: buyRate,
          expectedRent: buyRent,
          expectedExpenses: buyExpenses,
          purchaseMonth: buyMonth,
        };
        valid = buyPropertyConfigSchema.safeParse(config).success;
        break;
    }

    if (!valid) {
      toast.error("Please fill in all required fields");
      return;
    }

    const entry: FactorEntry = {
      factorType: addingType,
      config,
      startMonth: factorStartMonth,
      durationMonths: factorDuration,
    };

    if (editingIndex !== null) {
      setFactors((prev) =>
        prev.map((f, i) => (i === editingIndex ? entry : f)),
      );
    } else {
      setFactors((prev) => [...prev, entry]);
    }
    resetFactorInputs();
  }

  function handleEditFactor(index: number) {
    const f = factors[index];
    setAddingType(f.factorType);
    setEditingIndex(index);
    setFactorStartMonth(f.startMonth);
    setFactorDuration(f.durationMonths);

    const c = f.config;
    switch (f.factorType) {
      case "interest_rate":
        setInterestChange(c.changePercent as number);
        setInterestApplyTo(c.applyTo as string);
        break;
      case "vacancy":
        setVacancyProperty(c.propertyId as string);
        setVacancyMonths(c.months as number);
        break;
      case "rent_change":
        setRentChange(c.changePercent as number);
        setRentProperty((c.propertyId as string) ?? "");
        break;
      case "expense_change":
        setExpenseChange(c.changePercent as number);
        setExpenseCategory((c.category as string) ?? "");
        break;
      case "sell_property":
        setSellProperty(c.propertyId as string);
        setSellPrice(c.salePrice as number);
        setSellCosts(c.sellingCosts as number);
        setSellMonth(c.settlementMonth as number);
        break;
      case "buy_property":
        setBuyPrice(c.purchasePrice as number);
        setBuyDeposit(c.deposit as number);
        setBuyLoan(c.loanAmount as number);
        setBuyRate(c.interestRate as number);
        setBuyRent(c.expectedRent as number);
        setBuyExpenses(c.expectedExpenses as number);
        setBuyMonth(c.purchaseMonth as number);
        break;
    }
  }

  function handleSubmit() {
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
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/reports/scenarios">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
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

      {/* Basic Info */}
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
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Time Horizon</Label>
              <Select
                value={String(timeHorizon)}
                onValueChange={(v) => setTimeHorizon(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="12">1 year</SelectItem>
                  <SelectItem value="24">2 years</SelectItem>
                  <SelectItem value="36">3 years</SelectItem>
                  <SelectItem value="60">5 years</SelectItem>
                  <SelectItem value="120">10 years</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Marginal Tax Rate</Label>
              <Select
                value={String(marginalTaxRate)}
                onValueChange={(v) => setMarginalTaxRate(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">0%</SelectItem>
                  <SelectItem value="0.19">19%</SelectItem>
                  <SelectItem value="0.325">32.5%</SelectItem>
                  <SelectItem value="0.37">37%</SelectItem>
                  <SelectItem value="0.45">45%</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Factors */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Factors</CardTitle>
          {!addingType && (
            <Select onValueChange={(v) => setAddingType(v as FactorType)}>
              <SelectTrigger className="w-auto">
                <Plus className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Add factor" />
              </SelectTrigger>
              <SelectContent>
                {FACTOR_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {FACTOR_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Existing factors */}
          {factors.map((f, i) => (
            <FactorCard
              key={i}
              factorType={f.factorType}
              config={f.config}
              startMonth={f.startMonth}
              durationMonths={f.durationMonths}
              properties={propertyList}
              onEdit={() => handleEditFactor(i)}
              onRemove={() =>
                setFactors((prev) => prev.filter((_, idx) => idx !== i))
              }
            />
          ))}

          {factors.length === 0 && !addingType && (
            <p className="text-muted-foreground py-4 text-center text-sm">
              No factors added yet. Add factors to model what-if scenarios.
            </p>
          )}

          {/* Factor input form */}
          {addingType && (
            <Card className="border-primary/20">
              <CardContent className="space-y-4 pt-4">
                <p className="text-sm font-medium">
                  {FACTOR_LABELS[addingType]}
                </p>

                {/* Interest Rate */}
                {addingType === "interest_rate" && (
                  <>
                    <div className="space-y-2">
                      <Label>
                        Rate Change: {interestChange >= 0 ? "+" : ""}
                        {interestChange}%
                      </Label>
                      <Slider
                        value={[interestChange]}
                        onValueChange={([v]) => setInterestChange(v)}
                        min={-3}
                        max={5}
                        step={0.25}
                      />
                      <div className="text-muted-foreground flex justify-between text-xs">
                        <span>-3%</span>
                        <span>+5%</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Apply To</Label>
                      <Select
                        value={interestApplyTo}
                        onValueChange={setInterestApplyTo}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All properties</SelectItem>
                          {propertyList.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.address}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}

                {/* Vacancy */}
                {addingType === "vacancy" && (
                  <>
                    <div className="space-y-2">
                      <Label>Property</Label>
                      <Select
                        value={vacancyProperty}
                        onValueChange={setVacancyProperty}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select property" />
                        </SelectTrigger>
                        <SelectContent>
                          {propertyList.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.address}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Duration: {vacancyMonths} months</Label>
                      <Slider
                        value={[vacancyMonths]}
                        onValueChange={([v]) => setVacancyMonths(v)}
                        min={1}
                        max={24}
                        step={1}
                      />
                    </div>
                  </>
                )}

                {/* Rent Change */}
                {addingType === "rent_change" && (
                  <>
                    <div className="space-y-2">
                      <Label>
                        Rent Change: {rentChange >= 0 ? "+" : ""}
                        {rentChange}%
                      </Label>
                      <Slider
                        value={[rentChange]}
                        onValueChange={([v]) => setRentChange(v)}
                        min={-20}
                        max={20}
                        step={1}
                      />
                      <div className="text-muted-foreground flex justify-between text-xs">
                        <span>-20%</span>
                        <span>+20%</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Property (optional)</Label>
                      <Select
                        value={rentProperty || "_all"}
                        onValueChange={(v) =>
                          setRentProperty(v === "_all" ? "" : v)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="All properties" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_all">All properties</SelectItem>
                          {propertyList.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.address}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}

                {/* Expense Change */}
                {addingType === "expense_change" && (
                  <>
                    <div className="space-y-2">
                      <Label>
                        Expense Change: {expenseChange >= 0 ? "+" : ""}
                        {expenseChange}%
                      </Label>
                      <Slider
                        value={[expenseChange]}
                        onValueChange={([v]) => setExpenseChange(v)}
                        min={-20}
                        max={20}
                        step={1}
                      />
                      <div className="text-muted-foreground flex justify-between text-xs">
                        <span>-20%</span>
                        <span>+20%</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Category (optional)</Label>
                      <Input
                        placeholder="All categories"
                        value={expenseCategory}
                        onChange={(e) => setExpenseCategory(e.target.value)}
                      />
                    </div>
                  </>
                )}

                {/* Sell Property */}
                {addingType === "sell_property" && (
                  <>
                    <div className="space-y-2">
                      <Label>Property to Sell</Label>
                      <Select
                        value={sellProperty}
                        onValueChange={setSellProperty}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select property" />
                        </SelectTrigger>
                        <SelectContent>
                          {propertyList.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.address}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Sale Price ($)</Label>
                        <Input
                          type="number"
                          value={sellPrice || ""}
                          onChange={(e) => setSellPrice(Number(e.target.value))}
                          placeholder="850,000"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Selling Costs ($)</Label>
                        <Input
                          type="number"
                          value={sellCosts || ""}
                          onChange={(e) => setSellCosts(Number(e.target.value))}
                          placeholder="25,000"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Settlement Month</Label>
                      <Input
                        type="number"
                        min={1}
                        max={120}
                        value={sellMonth}
                        onChange={(e) => setSellMonth(Number(e.target.value))}
                      />
                    </div>
                  </>
                )}

                {/* Buy Property */}
                {addingType === "buy_property" && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Purchase Price ($)</Label>
                        <Input
                          type="number"
                          value={buyPrice || ""}
                          onChange={(e) => setBuyPrice(Number(e.target.value))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Deposit ($)</Label>
                        <Input
                          type="number"
                          value={buyDeposit || ""}
                          onChange={(e) =>
                            setBuyDeposit(Number(e.target.value))
                          }
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Loan Amount ($)</Label>
                        <Input
                          type="number"
                          value={buyLoan || ""}
                          onChange={(e) => setBuyLoan(Number(e.target.value))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Interest Rate (%)</Label>
                        <Input
                          type="number"
                          step={0.1}
                          value={buyRate}
                          onChange={(e) => setBuyRate(Number(e.target.value))}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Expected Rent ($/mo)</Label>
                        <Input
                          type="number"
                          value={buyRent || ""}
                          onChange={(e) => setBuyRent(Number(e.target.value))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Expected Expenses ($/mo)</Label>
                        <Input
                          type="number"
                          value={buyExpenses || ""}
                          onChange={(e) =>
                            setBuyExpenses(Number(e.target.value))
                          }
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Purchase Month</Label>
                      <Input
                        type="number"
                        min={0}
                        max={120}
                        value={buyMonth}
                        onChange={(e) => setBuyMonth(Number(e.target.value))}
                      />
                    </div>
                  </>
                )}

                {/* Timing (shared for all types) */}
                <div className="grid grid-cols-2 gap-4 border-t pt-2">
                  <div className="space-y-2">
                    <Label>Start Month</Label>
                    <Input
                      type="number"
                      min={0}
                      value={factorStartMonth}
                      onChange={(e) =>
                        setFactorStartMonth(Number(e.target.value))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Duration (months, optional)</Label>
                    <Input
                      type="number"
                      min={1}
                      value={factorDuration ?? ""}
                      onChange={(e) =>
                        setFactorDuration(
                          e.target.value ? Number(e.target.value) : undefined,
                        )
                      }
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={resetFactorInputs}>
                    Cancel
                  </Button>
                  <Button onClick={addCurrentFactor}>
                    {editingIndex !== null ? "Update Factor" : "Add Factor"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" asChild>
          <Link href="/reports/scenarios">Cancel</Link>
        </Button>
        <Button
          variant="outline"
          onClick={handleSubmit}
          disabled={createMutation.isPending}
        >
          <Save className="mr-2 h-4 w-4" />
          Save Draft
        </Button>
        <Button onClick={handleSubmit} disabled={createMutation.isPending}>
          <Play className="mr-2 h-4 w-4" />
          {createMutation.isPending ? "Creating..." : "Create & Run"}
        </Button>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="max-w-2xl space-y-6">
      <div className="bg-muted h-8 w-48 animate-pulse rounded" />
      <div className="bg-muted h-64 animate-pulse rounded-lg" />
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
