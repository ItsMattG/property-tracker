"use client";

import { formatDistanceToNow } from "date-fns";
import {
  Calendar,
  TrendingUp,
  AlertCircle,
  Copy,
  ExternalLink,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import type { AnomalyAlert } from "@/server/db/schema";

type AlertCardProps = {
  alert: Omit<AnomalyAlert, 'createdAt' | 'dismissedAt' | 'resolvedAt'> & {
    createdAt: Date | string;
    dismissedAt?: Date | string | null;
    resolvedAt?: Date | string | null;
    property?: { address: string } | null;
    transaction?: { id: string } | null;
  };
  onDismiss: (id: string) => void;
  isDismissing: boolean;
};

const alertIcons = {
  missed_rent: Calendar,
  unusual_amount: TrendingUp,
  unexpected_expense: AlertCircle,
  duplicate_transaction: Copy,
};

const severityColors = {
  critical: "border-l-red-500 bg-red-50 dark:bg-red-950/20",
  warning: "border-l-yellow-500 bg-yellow-50 dark:bg-yellow-950/20",
  info: "border-l-blue-500 bg-blue-50 dark:bg-blue-950/20",
};

const severityBadgeVariants = {
  critical: "destructive",
  warning: "secondary",
  info: "secondary",
} as const;

export function AlertCard({ alert, onDismiss, isDismissing }: AlertCardProps) {
  const Icon = alertIcons[alert.alertType] || AlertCircle;
  const colorClass = severityColors[alert.severity];

  return (
    <Card className={`border-l-4 ${colorClass} p-4`}>
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant={severityBadgeVariants[alert.severity]}>
              {alert.severity}
            </Badge>
            {alert.property && (
              <span className="text-sm text-muted-foreground truncate">
                {alert.property.address}
              </span>
            )}
          </div>
          <p className="text-sm font-medium">{alert.description}</p>
          {alert.suggestedAction && (
            <p className="text-sm text-muted-foreground mt-1">
              {alert.suggestedAction}
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-2">
            {formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {alert.transaction && (
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/transactions?highlight=${alert.transaction.id}`}>
                <ExternalLink className="h-4 w-4" />
              </Link>
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDismiss(alert.id)}
            disabled={isDismissing}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
