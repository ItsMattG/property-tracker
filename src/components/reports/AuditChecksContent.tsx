"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { AuditScoreBadge } from "./AuditScoreBadge";
import {
  ChevronDown,
  Loader2,
  ShieldCheck,
  AlertTriangle,
  Info,
  CircleAlert,
  CheckCircle2,
} from "lucide-react";

function SeverityIcon({ severity }: { severity: string }) {
  switch (severity) {
    case "critical":
      return <CircleAlert className="h-4 w-4 text-red-500" />;
    case "warning":
      return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    default:
      return <Info className="h-4 w-4 text-blue-500" />;
  }
}

export function AuditChecksContent() {
  const { data: availableYears } = trpc.reports.getAvailableYears.useQuery();
  const latestYear = availableYears?.[0]?.year;

  const [selectedYear, setSelectedYear] = useState<number | undefined>(undefined);
  const effectiveYear = selectedYear ?? latestYear;

  const { data, isLoading } = trpc.auditChecks.getReport.useQuery(
    { year: effectiveYear! },
    { enabled: !!effectiveYear },
  );

  if (!availableYears || availableYears.length === 0) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold">Audit Checks</h2>
          <p className="text-muted-foreground">
            Automated checks for tax readiness and data quality
          </p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              No financial year data found. Start tracking transactions to run audit checks.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold">Audit Checks</h2>
          <p className="text-muted-foreground">
            Automated checks for tax readiness and data quality
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Financial year:</span>
          <Select
            value={String(effectiveYear)}
            onValueChange={(v) => setSelectedYear(Number(v))}
          >
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableYears.map((y) => (
                <SelectItem key={y.year} value={String(y.year)}>
                  {y.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {data && (
        <>
          {/* Portfolio Score */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5" />
                  Portfolio Audit Score
                </CardTitle>
                <AuditScoreBadge score={data.portfolioScore} size="lg" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 text-sm">
                {data.summary.critical > 0 && (
                  <span className="flex items-center gap-1 text-red-600">
                    <CircleAlert className="h-4 w-4" />
                    {data.summary.critical} critical
                  </span>
                )}
                {data.summary.warning > 0 && (
                  <span className="flex items-center gap-1 text-amber-600">
                    <AlertTriangle className="h-4 w-4" />
                    {data.summary.warning} warning{data.summary.warning !== 1 ? "s" : ""}
                  </span>
                )}
                {data.summary.info > 0 && (
                  <span className="flex items-center gap-1 text-blue-600">
                    <Info className="h-4 w-4" />
                    {data.summary.info} suggestion{data.summary.info !== 1 ? "s" : ""}
                  </span>
                )}
                {data.summary.critical === 0 && data.summary.warning === 0 && data.summary.info === 0 && (
                  <span className="flex items-center gap-1 text-green-600">
                    <CheckCircle2 className="h-4 w-4" />
                    All checks passed
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Portfolio-wide Checks */}
          {data.portfolioChecks.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Portfolio-Wide Checks</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.portfolioChecks.map((check, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <SeverityIcon severity={check.severity} />
                    <div>
                      <p className="text-sm font-medium">{check.title}</p>
                      <p className="text-sm text-muted-foreground">{check.message}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Per-Property Checks */}
          {data.properties.map((prop) => (
            <Collapsible key={prop.propertyId}>
              <Card>
                <CollapsibleTrigger className="w-full">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div className="flex items-center gap-3">
                      <AuditScoreBadge score={prop.score} />
                      <CardTitle className="text-base">{prop.address}</CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        {prop.passedCount}/{prop.totalChecks} passed
                      </span>
                      <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform [[data-state=open]>&]:rotate-180" />
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="space-y-3">
                    {prop.checks.length === 0 ? (
                      <p className="flex items-center gap-2 text-sm text-green-600">
                        <CheckCircle2 className="h-4 w-4" />
                        All checks passed for this property.
                      </p>
                    ) : (
                      prop.checks.map((check, i) => (
                        <div key={i} className="flex items-start gap-3">
                          <SeverityIcon severity={check.severity} />
                          <div>
                            <p className="text-sm font-medium">{check.title}</p>
                            <p className="text-sm text-muted-foreground">{check.message}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          ))}
        </>
      )}
    </div>
  );
}
