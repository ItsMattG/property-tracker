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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { Check, SkipForward, MoreHorizontal } from "lucide-react";
import { getCategoryLabel } from "@/lib/categories";

type ExpectedStatus = "pending" | "matched" | "missed" | "skipped";

const statusConfig: Record<ExpectedStatus, { label: string; description: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pending", description: "Awaiting a matching bank transaction", variant: "secondary" },
  matched: { label: "Matched", description: "Linked to an actual transaction", variant: "default" },
  missed: { label: "Missed", description: "Expected date passed with no match", variant: "destructive" },
  skipped: { label: "Skipped", description: "Manually dismissed", variant: "outline" },
};

interface ReconciliationViewProps {
  propertyId?: string;
}

export function ReconciliationView({ propertyId }: ReconciliationViewProps) {
  const [statusFilter, setStatusFilter] = useState<ExpectedStatus | "all">("all");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; description: string } | null>(null);
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

  const deleteMutation = trpc.recurring.delete.useMutation({
    onSuccess: () => {
      toast.success("Recurring rule deleted");
      utils.recurring.getExpectedTransactions.invalidate();
      utils.recurring.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete recurring rule");
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

  const confirmDelete = () => {
    if (deleteTarget) {
      deleteMutation.mutate({ id: deleteTarget.id });
      setDeleteTarget(null);
    }
  };

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Expected Transactions</h3>
          <p className="text-sm text-muted-foreground">
            Recurring transactions are matched against your bank feed automatically.
          </p>
        </div>
        <Select
          value={statusFilter}
          onValueChange={(value) => setStatusFilter(value as ExpectedStatus | "all")}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {(Object.entries(statusConfig) as [ExpectedStatus, typeof statusConfig[ExpectedStatus]][]).map(
              ([value, config]) => (
                <SelectItem key={value} value={value}>
                  <span>{config.label}</span>
                  <span className="text-muted-foreground ml-1.5 text-xs">
                    — {config.description}
                  </span>
                </SelectItem>
              )
            )}
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
                        <Badge variant="outline">{expected.property.address}</Badge>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={config.variant}>{config.label}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {status === "pending" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSkip(expected.id)}
                            title="Skip this occurrence"
                          >
                            <SkipForward className="w-4 h-4" />
                          </Button>
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
                        {expected.recurringTransaction && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" aria-label="Transaction actions">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() =>
                                  setDeleteTarget({
                                    id: expected.recurringTransaction!.id,
                                    description: expected.recurringTransaction!.description,
                                  })
                                }
                              >
                                Delete Recurring Rule
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Recurring Rule</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the recurring rule for{" "}
              <span className="font-medium">{deleteTarget?.description}</span>?
              This will remove all future expected transactions for this rule.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
