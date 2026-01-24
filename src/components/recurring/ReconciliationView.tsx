"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { Check, X, SkipForward, Link2 } from "lucide-react";
import { getCategoryLabel } from "@/lib/categories";

type ExpectedStatus = "pending" | "matched" | "missed" | "skipped";

const statusConfig: Record<ExpectedStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pending", variant: "secondary" },
  matched: { label: "Matched", variant: "default" },
  missed: { label: "Missed", variant: "destructive" },
  skipped: { label: "Skipped", variant: "outline" },
};

interface ReconciliationViewProps {
  propertyId?: string;
}

export function ReconciliationView({ propertyId }: ReconciliationViewProps) {
  const [statusFilter, setStatusFilter] = useState<ExpectedStatus | "all">("all");
  const utils = trpc.useUtils();

  const { data: expectedTransactions, isLoading } = trpc.recurring.getExpectedTransactions.useQuery({
    propertyId,
    status: statusFilter === "all" ? undefined : statusFilter,
  });

  const skipMutation = trpc.recurring.skip.useMutation({
    onSuccess: () => {
      toast.success("Transaction marked as skipped");
      utils.recurring.getExpectedTransactions.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to skip transaction");
    },
  });

  const formatAmount = (amount: string) => {
    const num = Number(amount);
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
    }).format(Math.abs(num));
  };

  const handleSkip = (expectedId: string) => {
    skipMutation.mutate({ expectedId });
  };

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Expected Transactions</h3>
        <Select
          value={statusFilter}
          onValueChange={(value) => setStatusFilter(value as ExpectedStatus | "all")}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="matched">Matched</SelectItem>
            <SelectItem value="missed">Missed</SelectItem>
            <SelectItem value="skipped">Skipped</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Expected Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Property</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!expectedTransactions || expectedTransactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No expected transactions found
                </TableCell>
              </TableRow>
            ) : (
              expectedTransactions.map((expected) => {
                const status = expected.status as ExpectedStatus;
                const config = statusConfig[status];

                return (
                  <TableRow
                    key={expected.id}
                    className={status === "missed" ? "bg-destructive/10" : undefined}
                  >
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(expected.expectedDate), "dd MMM yyyy")}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {expected.recurringTransaction?.description ?? "Unknown"}
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatAmount(expected.expectedAmount)}
                    </TableCell>
                    <TableCell>
                      {expected.recurringTransaction
                        ? getCategoryLabel(expected.recurringTransaction.category)
                        : "-"}
                    </TableCell>
                    <TableCell>
                      {expected.property ? (
                        <Badge variant="outline">{expected.property.suburb}</Badge>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={config.variant}>{config.label}</Badge>
                    </TableCell>
                    <TableCell>
                      {status === "pending" && (
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSkip(expected.id)}
                            title="Skip this occurrence"
                          >
                            <SkipForward className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                      {status === "matched" && expected.matchedTransaction && (
                        <div className="flex items-center gap-1 text-success">
                          <Check className="w-4 h-4" />
                          <span className="text-xs">
                            {format(new Date(expected.matchedTransaction.date), "dd MMM")}
                          </span>
                        </div>
                      )}
                      {status === "missed" && (
                        <span className="text-xs text-destructive">Overdue</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
