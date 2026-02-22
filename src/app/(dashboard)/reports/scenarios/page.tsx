"use client";

import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  MoreHorizontal,
  Play,
  GitBranch,
  Trash2,
  Calculator,
  BarChart3,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { toast } from "sonner";

export default function ScenariosPage() {
  const utils = trpc.useUtils();
  const { data: scenarios, isLoading } = trpc.scenario.list.useQuery();

  const deleteMutation = trpc.scenario.delete.useMutation({
    onSuccess: () => {
      toast.success("Scenario deleted");
      utils.scenario.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const runMutation = trpc.scenario.run.useMutation({
    onSuccess: () => {
      toast.success("Projection calculated");
      utils.scenario.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Scenario Simulator</h2>
          <p className="text-muted-foreground">Model what-if scenarios for your portfolio</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Scenario Simulator</h2>
          <p className="text-muted-foreground">Model what-if scenarios for your portfolio</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/reports/scenarios/compare">
              <BarChart3 className="w-4 h-4 mr-2" />
              Compare
            </Link>
          </Button>
          <Button asChild>
            <Link href="/reports/scenarios/new">
              <Plus className="w-4 h-4 mr-2" />
              New Scenario
            </Link>
          </Button>
        </div>
      </div>

      {!scenarios || scenarios.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calculator className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No scenarios yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create your first scenario to model interest rate changes, vacancy,
              or buy/sell decisions.
            </p>
            <Button asChild>
              <Link href="/reports/scenarios/new">
                <Plus className="w-4 h-4 mr-2" />
                Create Scenario
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {scenarios.map((scenario) => (
            <Card key={scenario.id} className="relative">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-base">{scenario.name}</CardTitle>
                    {scenario.description && (
                      <CardDescription className="mt-1">
                        {scenario.description}
                      </CardDescription>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Scenario actions">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => runMutation.mutate({ id: scenario.id })}
                      >
                        <Play className="w-4 h-4 mr-2" />
                        Run Projection
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href={`/reports/scenarios/new?branch=${scenario.id}`}>
                          <GitBranch className="w-4 h-4 mr-2" />
                          Create Branch
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => deleteMutation.mutate({ id: scenario.id })}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 mb-3">
                  <Badge variant={scenario.status === "saved" ? "default" : "secondary"}>
                    {scenario.status}
                  </Badge>
                  {scenario.parentScenarioId && (
                    <Badge variant="outline">
                      <GitBranch className="w-3 h-3 mr-1" />
                      Branch
                    </Badge>
                  )}
                </div>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>{scenario.factors?.length || 0} factors configured</p>
                  <p>{scenario.timeHorizonMonths} month horizon</p>
                  <p>
                    Updated{" "}
                    {formatDistanceToNow(new Date(scenario.updatedAt), {
                      addSuffix: true,
                    })}
                  </p>
                </div>
                {scenario.projection && (
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-sm font-medium">
                      Net: $
                      {JSON.parse(scenario.projection.summaryMetrics).totalNet?.toLocaleString() ||
                        "—"}
                    </p>
                  </div>
                )}
                <Button
                  variant="outline"
                  className="w-full mt-3"
                  asChild
                >
                  <Link href={`/reports/scenarios/${scenario.id}`}>
                    View Details
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
