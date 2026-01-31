"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ForecastSummary } from "@/components/forecast/ForecastSummary";
import { ScenarioModal } from "@/components/forecast/ScenarioModal";
import { Plus, Settings } from "lucide-react";
import { ChartSkeleton } from "@/components/ui/chart-skeleton";

const ForecastChart = dynamic(
  () =>
    import("@/components/forecast/ForecastChart").then((m) => ({
      default: m.ForecastChart,
    })),
  {
    loading: () => <ChartSkeleton height={320} />,
    ssr: false,
  }
);

export default function ForecastPage() {
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data: scenarios, isLoading: scenariosLoading } = trpc.forecast.listScenarios.useQuery();
  const utils = trpc.useUtils();

  const defaultScenario = scenarios?.find((s) => s.isDefault) ?? scenarios?.[0];
  const activeScenarioId = selectedScenarioId ?? defaultScenario?.id;

  const { data: forecastData, isLoading: forecastLoading } = trpc.forecast.getForecast.useQuery(
    { scenarioId: activeScenarioId! },
    { enabled: !!activeScenarioId }
  );

  const handleScenarioCreated = () => {
    utils.forecast.listScenarios.invalidate();
    setIsModalOpen(false);
  };

  if (scenariosLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Cash Flow Forecast</h2>
          <p className="text-muted-foreground">12-month projections for your portfolio</p>
        </div>
        <div className="h-96 rounded-lg bg-muted animate-pulse" />
      </div>
    );
  }

  if (!scenarios || scenarios.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Cash Flow Forecast</h2>
          <p className="text-muted-foreground">12-month projections for your portfolio</p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">
              Create your first forecast scenario to get started
            </p>
            <Button onClick={() => setIsModalOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Scenario
            </Button>
          </CardContent>
        </Card>
        <ScenarioModal
          open={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSuccess={handleScenarioCreated}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Cash Flow Forecast</h2>
          <p className="text-muted-foreground">12-month projections for your portfolio</p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={activeScenarioId}
            onValueChange={setSelectedScenarioId}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select scenario" />
            </SelectTrigger>
            <SelectContent>
              {scenarios.map((scenario) => (
                <SelectItem key={scenario.id} value={scenario.id}>
                  {scenario.name} {scenario.isDefault && "(Default)"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => setIsModalOpen(true)}>
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {forecastLoading ? (
        <div className="h-96 rounded-lg bg-muted animate-pulse" />
      ) : forecastData ? (
        <>
          <ForecastChart forecasts={forecastData.forecasts} />
          <ForecastSummary summary={forecastData.summary} />
        </>
      ) : null}

      <ScenarioModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleScenarioCreated}
        scenarios={scenarios}
      />
    </div>
  );
}
