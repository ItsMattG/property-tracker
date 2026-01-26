"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Plus, Star } from "lucide-react";

type Scenario = {
  id: string;
  name: string;
  isDefault: boolean;
};

type ScenarioModalProps = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  scenarios?: Scenario[];
};

export function ScenarioModal({ open, onClose, onSuccess, scenarios }: ScenarioModalProps) {
  const [name, setName] = useState("");
  const [rentGrowth, setRentGrowth] = useState(2);
  const [expenseInflation, setExpenseInflation] = useState(3);
  const [vacancy, setVacancy] = useState(0);
  const [rateChange, setRateChange] = useState(0);

  const utils = trpc.useUtils();

  const createMutation = trpc.forecast.createScenario.useMutation({
    onSuccess: () => {
      utils.forecast.listScenarios.invalidate();
      resetForm();
      onSuccess();
    },
  });

  const deleteMutation = trpc.forecast.deleteScenario.useMutation({
    onSuccess: () => {
      utils.forecast.listScenarios.invalidate();
    },
  });

  const setDefaultMutation = trpc.forecast.setDefaultScenario.useMutation({
    onSuccess: () => {
      utils.forecast.listScenarios.invalidate();
    },
  });

  const resetForm = () => {
    setName("");
    setRentGrowth(2);
    setExpenseInflation(3);
    setVacancy(0);
    setRateChange(0);
  };

  const handleCreate = () => {
    if (!name.trim()) return;

    createMutation.mutate({
      name: name.trim(),
      assumptions: {
        rentGrowthPercent: rentGrowth,
        expenseInflationPercent: expenseInflation,
        vacancyRatePercent: vacancy,
        interestRateChangePercent: rateChange,
      },
      isDefault: !scenarios || scenarios.length === 0,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Manage Scenarios</DialogTitle>
          <DialogDescription>
            Create and manage forecast scenarios with different assumptions.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Existing scenarios */}
          {scenarios && scenarios.length > 0 && (
            <div className="space-y-2">
              <Label>Existing Scenarios</Label>
              <div className="space-y-2">
                {scenarios.map((scenario) => (
                  <div
                    key={scenario.id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{scenario.name}</span>
                      {scenario.isDefault && (
                        <span className="text-xs text-muted-foreground">(Default)</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {!scenario.isDefault && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDefaultMutation.mutate({ id: scenario.id })}
                        >
                          <Star className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteMutation.mutate({ id: scenario.id })}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Create new scenario */}
          <div className="space-y-4">
            <Label>Create New Scenario</Label>

            <div>
              <Label htmlFor="name" className="text-sm">
                Scenario Name
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Rate Rise 1%"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="rentGrowth" className="text-sm">
                  Rent Growth (% p.a.)
                </Label>
                <Input
                  id="rentGrowth"
                  type="number"
                  step="0.5"
                  value={rentGrowth}
                  onChange={(e) => setRentGrowth(Number(e.target.value))}
                />
              </div>
              <div>
                <Label htmlFor="expenseInflation" className="text-sm">
                  Expense Inflation (% p.a.)
                </Label>
                <Input
                  id="expenseInflation"
                  type="number"
                  step="0.5"
                  value={expenseInflation}
                  onChange={(e) => setExpenseInflation(Number(e.target.value))}
                />
              </div>
              <div>
                <Label htmlFor="vacancy" className="text-sm">
                  Vacancy Rate (%)
                </Label>
                <Input
                  id="vacancy"
                  type="number"
                  step="1"
                  min="0"
                  max="100"
                  value={vacancy}
                  onChange={(e) => setVacancy(Number(e.target.value))}
                />
              </div>
              <div>
                <Label htmlFor="rateChange" className="text-sm">
                  Interest Rate Change (%)
                </Label>
                <Input
                  id="rateChange"
                  type="number"
                  step="0.25"
                  value={rateChange}
                  onChange={(e) => setRateChange(Number(e.target.value))}
                />
              </div>
            </div>

            <Button
              onClick={handleCreate}
              disabled={!name.trim() || createMutation.isPending}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Scenario
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
