"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type ComplianceStatus = "compliant" | "upcoming" | "due_soon" | "overdue";

const statusConfig: Record<ComplianceStatus, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  compliant: { label: "Compliant", variant: "default" },
  upcoming: { label: "Upcoming", variant: "secondary" },
  due_soon: { label: "Due Soon", variant: "outline" },
  overdue: { label: "Overdue", variant: "destructive" },
};

interface ComplianceStatusBadgeProps {
  status: ComplianceStatus;
  className?: string;
}

export function ComplianceStatusBadge({ status, className }: ComplianceStatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <Badge variant={config.variant} className={cn(className)}>
      {config.label}
    </Badge>
  );
}
