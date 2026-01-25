"use client";

import { useParams } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, AlertTriangle, XCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof CheckCircle2 }> = {
    ok: { label: "On Track", variant: "default", icon: CheckCircle2 },
    compliant: { label: "Compliant", variant: "default", icon: CheckCircle2 },
    warning: { label: "Warning", variant: "secondary", icon: AlertTriangle },
    info: { label: "Info", variant: "secondary", icon: Clock },
    behind: { label: "Behind", variant: "destructive", icon: XCircle },
    breach: { label: "Breach", variant: "destructive", icon: XCircle },
    urgent: { label: "Urgent", variant: "destructive", icon: AlertTriangle },
    overdue: { label: "Overdue", variant: "destructive", icon: XCircle },
  };

  const { label, variant, icon: Icon } = config[status] || { label: status, variant: "outline" as const, icon: Clock };

  return (
    <Badge variant={variant} className="gap-1">
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  );
}

export default function EntityCompliancePage() {
  const params = useParams();
  const entityId = params.id as string;

  const { data: entity, isLoading: entityLoading } = trpc.entity.get.useQuery({ entityId });
  const { data: smsfDashboard, isLoading: smsfLoading } = trpc.smsfCompliance.getDashboard.useQuery(
    { entityId },
    { enabled: entity?.type === "smsf" }
  );
  const { data: trustDashboard, isLoading: trustLoading } = trpc.trustCompliance.getDashboard.useQuery(
    { entityId },
    { enabled: entity?.type === "trust" }
  );

  if (entityLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  if (!entity) {
    return <Card><CardContent className="py-6 text-center text-muted-foreground">Entity not found</CardContent></Card>;
  }

  if (entity.type === "smsf") {
    if (smsfLoading || !smsfDashboard) {
      return <Skeleton className="h-96" />;
    }

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">SMSF Compliance</h1>
          <p className="text-muted-foreground">Financial Year {smsfDashboard.financialYear}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {/* Contribution Caps */}
          <Card>
            <CardHeader>
              <CardTitle>Contribution Caps</CardTitle>
              <CardDescription>Track member contributions against limits</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {smsfDashboard.contributions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No contributions recorded</p>
              ) : (
                smsfDashboard.contributions.map((c) => (
                  <div key={c.memberId} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">{c.memberName}</span>
                      <StatusBadge status={c.status.concessional} />
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>Concessional</span>
                        <span>${c.concessional.toLocaleString()} / ${smsfDashboard.caps.concessional.toLocaleString()}</span>
                      </div>
                      <Progress value={(c.concessional / smsfDashboard.caps.concessional) * 100} />
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>Non-concessional</span>
                        <span>${c.nonConcessional.toLocaleString()} / ${smsfDashboard.caps.nonConcessional.toLocaleString()}</span>
                      </div>
                      <Progress value={(c.nonConcessional / smsfDashboard.caps.nonConcessional) * 100} />
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Pension Drawdowns */}
          <Card>
            <CardHeader>
              <CardTitle>Pension Drawdowns</CardTitle>
              <CardDescription>Minimum pension requirements</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {smsfDashboard.pensions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No pension members</p>
              ) : (
                smsfDashboard.pensions.map((p) => (
                  <div key={p.memberId} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">{p.memberName}</span>
                      <StatusBadge status={p.status} />
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>Drawn / Minimum</span>
                        <span>${p.amountDrawn.toLocaleString()} / ${p.minimumRequired.toLocaleString()}</span>
                      </div>
                      <Progress value={(p.amountDrawn / p.minimumRequired) * 100} />
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Audit Checklist */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Audit Checklist</CardTitle>
              <CardDescription>
                {smsfDashboard.auditChecklist.completed} of {smsfDashboard.auditChecklist.total} items completed
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Progress
                value={(smsfDashboard.auditChecklist.completed / smsfDashboard.auditChecklist.total) * 100}
                className="h-2"
              />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (entity.type === "trust") {
    if (trustLoading || !trustDashboard) {
      return <Skeleton className="h-96" />;
    }

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Trust Compliance</h1>
          <p className="text-muted-foreground">Financial Year {trustDashboard.financialYear}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {/* Distribution Deadline */}
          <Card>
            <CardHeader>
              <CardTitle>Distribution Deadline</CardTitle>
              <CardDescription>June 30 resolution requirement</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className={cn(
                    "text-3xl font-bold",
                    trustDashboard.deadline.daysUntil < 0 && "text-destructive",
                    trustDashboard.deadline.daysUntil <= 5 && trustDashboard.deadline.daysUntil >= 0 && "text-orange-500"
                  )}>
                    {trustDashboard.deadline.daysUntil < 0
                      ? `${Math.abs(trustDashboard.deadline.daysUntil)} days overdue`
                      : `${trustDashboard.deadline.daysUntil} days`
                    }
                  </p>
                  <p className="text-sm text-muted-foreground">until deadline</p>
                </div>
                <StatusBadge status={trustDashboard.deadline.status} />
              </div>
              {trustDashboard.deadline.hasDistribution && (
                <p className="mt-4 text-sm text-green-600">Distribution recorded for this year</p>
              )}
            </CardContent>
          </Card>

          {/* Beneficiaries */}
          <Card>
            <CardHeader>
              <CardTitle>Beneficiaries</CardTitle>
              <CardDescription>Active trust beneficiaries</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{trustDashboard.beneficiaries}</p>
              <p className="text-sm text-muted-foreground">registered beneficiaries</p>
            </CardContent>
          </Card>

          {/* Recent Distributions */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Distribution History</CardTitle>
            </CardHeader>
            <CardContent>
              {trustDashboard.recentDistributions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No distributions recorded</p>
              ) : (
                <div className="space-y-2">
                  {trustDashboard.recentDistributions.map((d) => (
                    <div key={d.id} className="flex justify-between items-center py-2 border-b last:border-0">
                      <div>
                        <span className="font-medium">{d.financialYear}</span>
                        <span className="text-sm text-muted-foreground ml-2">
                          ({d.allocations} beneficiaries)
                        </span>
                      </div>
                      <span className="font-medium">${d.totalAmount.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="py-6 text-center text-muted-foreground">
        Compliance tracking is only available for Trust and SMSF entities.
      </CardContent>
    </Card>
  );
}
