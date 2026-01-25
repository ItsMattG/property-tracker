"use client";

import { useState } from "react";
import { format } from "date-fns";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ComplianceStatusBadge } from "./ComplianceStatusBadge";
import { RecordCompletionModal } from "./RecordCompletionModal";
import { CheckCircle2, ClipboardCheck } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight } from "lucide-react";

interface PropertyComplianceSectionProps {
  propertyId: string;
}

export function PropertyComplianceSection({ propertyId }: PropertyComplianceSectionProps) {
  const [isOpen, setIsOpen] = useState(true);
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
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">Compliance</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-12 bg-muted rounded" />
            <div className="h-12 bg-muted rounded" />
            <div className="h-12 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.items.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">Compliance</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <CheckCircle2 className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              No compliance requirements for this property.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ClipboardCheck className="w-5 h-5 text-primary" />
                  <CardTitle className="text-lg">Compliance</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {data.items.length} {data.items.length === 1 ? "item" : "items"}
                  </span>
                  {isOpen ? (
                    <ChevronDown className="w-5 h-5 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              <div className="space-y-3">
                {data.items.map((item) => (
                  <div
                    key={item.requirement.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm">
                          {item.requirement.name}
                        </p>
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
                      <p className="text-xs text-muted-foreground mt-1">
                        {item.nextDueAt
                          ? `Next due: ${format(new Date(item.nextDueAt), "dd MMM yyyy")}`
                          : `Every ${item.requirement.frequencyMonths} months`}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        handleRecordClick(item.requirement.id, item.requirement.name)
                      }
                    >
                      Record
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {selectedRequirement && (
        <RecordCompletionModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          propertyId={propertyId}
          requirementId={selectedRequirement.id}
          requirementName={selectedRequirement.name}
        />
      )}
    </>
  );
}
