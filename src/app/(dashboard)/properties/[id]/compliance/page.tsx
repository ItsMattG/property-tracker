"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { format } from "date-fns";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ComplianceStatusBadge } from "@/components/compliance/ComplianceStatusBadge";
import { RecordCompletionModal } from "@/components/compliance/RecordCompletionModal";
import {
  ClipboardCheck,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  History,
  Calendar,
  Clock,
  FileText,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

function RequirementHistorySection({
  propertyId,
  requirementId,
}: {
  propertyId: string;
  requirementId: string;
}) {
  const { data: history, isLoading } = trpc.compliance.getHistory.useQuery(
    { propertyId, requirementId },
    { enabled: !!propertyId && !!requirementId }
  );

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-2 mt-4 pt-4 border-t">
        <div className="h-10 bg-muted rounded" />
        <div className="h-10 bg-muted rounded" />
      </div>
    );
  }

  if (!history || history.length === 0) {
    return (
      <div className="mt-4 pt-4 border-t">
        <p className="text-sm text-muted-foreground text-center py-4">
          No history recorded yet.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 pt-4 border-t space-y-2">
      <h4 className="text-sm font-medium flex items-center gap-2 mb-3">
        <History className="w-4 h-4" />
        Completion History
      </h4>
      {history.map((record) => (
        <div
          key={record.id}
          className="flex items-start justify-between p-3 rounded-lg bg-muted/50 text-sm"
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
              <span>Completed: {format(new Date(record.completedAt), "dd MMM yyyy")}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="w-3.5 h-3.5" />
              <span>Next due: {format(new Date(record.nextDueAt), "dd MMM yyyy")}</span>
            </div>
            {record.notes && (
              <div className="flex items-start gap-2 text-muted-foreground mt-2">
                <FileText className="w-3.5 h-3.5 mt-0.5" />
                <span>{record.notes}</span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function RequirementCard({
  propertyId,
  item,
  onRecordClick,
}: {
  propertyId: string;
  item: {
    requirement: {
      id: string;
      name: string;
      description: string;
      frequencyMonths: number;
    };
    nextDueAt: string | null;
    status: string;
  };
  onRecordClick: (id: string, name: string) => void;
}) {
  const [showHistory, setShowHistory] = useState(false);

  const frequencyLabel = (() => {
    const months = item.requirement.frequencyMonths;
    if (months === 12) return "Annually";
    if (months === 24) return "Every 2 years";
    if (months === 36) return "Every 3 years";
    if (months === 48) return "Every 4 years";
    return `Every ${months} months`;
  })();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle className="text-lg">{item.requirement.name}</CardTitle>
              {item.status === "never_completed" ? (
                <span className="text-xs text-muted-foreground px-2 py-0.5 rounded-full bg-muted">
                  Never recorded
                </span>
              ) : (
                <ComplianceStatusBadge
                  status={item.status as "compliant" | "upcoming" | "due_soon" | "overdue"}
                />
              )}
            </div>
            <CardDescription className="mt-1">
              {item.requirement.description}
            </CardDescription>
          </div>
          <Button
            variant="default"
            size="sm"
            onClick={() => onRecordClick(item.requirement.id, item.requirement.name)}
          >
            Record
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Frequency</p>
            <p className="font-medium">{frequencyLabel}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Last Completed</p>
            <p className="font-medium">
              {item.nextDueAt
                ? format(
                    new Date(
                      new Date(item.nextDueAt).getTime() -
                        item.requirement.frequencyMonths * 30 * 24 * 60 * 60 * 1000
                    ),
                    "dd MMM yyyy"
                  )
                : "Never"}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Next Due</p>
            <p className="font-medium">
              {item.nextDueAt
                ? format(new Date(item.nextDueAt), "dd MMM yyyy")
                : "Not scheduled"}
            </p>
          </div>
        </div>

        <Collapsible open={showHistory} onOpenChange={setShowHistory}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="mt-4 w-full justify-center gap-2"
            >
              {showHistory ? (
                <>
                  <ChevronDown className="w-4 h-4" />
                  Hide History
                </>
              ) : (
                <>
                  <ChevronRight className="w-4 h-4" />
                  Show History
                </>
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <RequirementHistorySection
              propertyId={propertyId}
              requirementId={item.requirement.id}
            />
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}

export default function PropertyCompliancePage() {
  const params = useParams();
  const propertyId = params.id as string;

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedRequirement, setSelectedRequirement] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const { data, isLoading } = trpc.compliance.getPropertyCompliance.useQuery(
    { propertyId },
    { enabled: !!propertyId }
  );

  const handleRecordClick = (requirementId: string, requirementName: string) => {
    setSelectedRequirement({ id: requirementId, name: requirementName });
    setModalOpen(true);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Property Compliance</h2>
          <p className="text-muted-foreground">
            Manage compliance requirements for this property
          </p>
        </div>
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!data || data.items.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Property Compliance</h2>
          <p className="text-muted-foreground">
            Manage compliance requirements for this property
          </p>
        </div>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <CheckCircle2 className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold">No compliance requirements</h3>
          <p className="text-muted-foreground max-w-sm mt-2">
            There are no compliance requirements for properties in {data?.state || "this state"}.
          </p>
        </div>
      </div>
    );
  }

  // Calculate summary statistics
  const summary = {
    total: data.items.length,
    compliant: data.items.filter((i) => i.status === "compliant").length,
    overdue: data.items.filter((i) => i.status === "overdue").length,
    dueSoon: data.items.filter((i) => i.status === "due_soon").length,
    neverCompleted: data.items.filter((i) => i.status === "never_completed").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold">Property Compliance</h2>
          <p className="text-muted-foreground">
            {data.propertyAddress} - {data.state}
          </p>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <ClipboardCheck className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{summary.total}</p>
                <p className="text-xs text-muted-foreground">Total Items</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{summary.compliant}</p>
                <p className="text-xs text-muted-foreground">Compliant</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-yellow-100 dark:bg-yellow-900/20 flex items-center justify-center">
                <Clock className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{summary.dueSoon}</p>
                <p className="text-xs text-muted-foreground">Due Soon</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
                <Clock className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{summary.overdue + summary.neverCompleted}</p>
                <p className="text-xs text-muted-foreground">Needs Attention</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Requirement Cards */}
      <div className="grid gap-4">
        {data.items.map((item) => (
          <RequirementCard
            key={item.requirement.id}
            propertyId={propertyId}
            item={item}
            onRecordClick={handleRecordClick}
          />
        ))}
      </div>

      {selectedRequirement && (
        <RecordCompletionModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          propertyId={propertyId}
          requirementId={selectedRequirement.id}
          requirementName={selectedRequirement.name}
        />
      )}
    </div>
  );
}
