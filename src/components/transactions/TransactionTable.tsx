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
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CategorySelect } from "./CategorySelect";
import { MakeRecurringDialog } from "@/components/recurring/MakeRecurringDialog";
import { getCategoryLabel, getCategoryInfo } from "@/lib/categories";
import { format } from "date-fns";
import { Check, X, MoreHorizontal } from "lucide-react";
import type { Transaction, Property, BankAccount } from "@/server/db/schema";

// When serialized through tRPC, Date fields become strings
type SerializedProperty = Omit<Property, "createdAt" | "updatedAt"> & {
  createdAt: Date | string;
  updatedAt: Date | string;
};

type SerializedTransaction = Omit<Transaction, "createdAt" | "updatedAt"> & {
  createdAt: Date | string;
  updatedAt: Date | string;
};

type SerializedBankAccount = Omit<BankAccount, "createdAt" | "lastSyncedAt"> & {
  createdAt: Date | string;
  lastSyncedAt: Date | string | null;
};

interface TransactionWithRelations extends SerializedTransaction {
  property: SerializedProperty | null;
  bankAccount: SerializedBankAccount;
}

interface TransactionTableProps {
  transactions: TransactionWithRelations[];
  properties: SerializedProperty[];
  onCategoryChange: (id: string, category: string, propertyId?: string) => void;
  onToggleVerified: (id: string) => void;
  onBulkCategoryChange: (ids: string[], category: string) => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}

export function TransactionTable({
  transactions,
  properties,
  onCategoryChange,
  onToggleVerified,
  onBulkCategoryChange,
  onEdit,
  onDelete,
}: TransactionTableProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [recurringDialogOpen, setRecurringDialogOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionWithRelations | null>(null);

  const handleMakeRecurring = (transaction: TransactionWithRelations) => {
    setSelectedTransaction(transaction);
    setRecurringDialogOpen(true);
  };

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleAll = () => {
    if (selectedIds.size === transactions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(transactions.map((t) => t.id)));
    }
  };

  const handleBulkCategory = (category: string) => {
    onBulkCategoryChange(Array.from(selectedIds), category);
    setSelectedIds(new Set());
  };

  const formatAmount = (amount: string) => {
    const num = Number(amount);
    const formatted = new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
    }).format(Math.abs(num));
    return num >= 0 ? formatted : `-${formatted}`;
  };

  return (
    <div className="space-y-4" data-tour="transaction-list">
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-4 p-4 bg-muted rounded-lg" data-tour="bulk-actions">
          <span className="text-sm font-medium">
            {selectedIds.size} selected
          </span>
          <CategorySelect
            onValueChange={handleBulkCategory}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedIds(new Set())}
          >
            Clear selection
          </Button>
        </div>
      )}

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedIds.size === transactions.length && transactions.length > 0}
                  onCheckedChange={toggleAll}
                />
              </TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead data-tour="category-dropdown">Category</TableHead>
              <TableHead>Property</TableHead>
              <TableHead className="w-20">Verified</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  No transactions found
                </TableCell>
              </TableRow>
            ) : (
              transactions.map((transaction) => {
                const categoryInfo = getCategoryInfo(transaction.category);
                const isIncome = categoryInfo?.type === "income";

                return (
                  <TableRow key={transaction.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(transaction.id)}
                        onCheckedChange={() => toggleSelection(transaction.id)}
                      />
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(transaction.date), "dd MMM yyyy")}
                    </TableCell>
                    <TableCell className="max-w-[300px]">
                      <div className="truncate">{transaction.description}</div>
                      {transaction.notes && (
                        <div className="text-xs text-muted-foreground truncate mt-0.5">
                          {transaction.notes}
                        </div>
                      )}
                    </TableCell>
                    <TableCell
                      className={
                        isIncome ? "text-success font-medium" : "font-medium"
                      }
                    >
                      {formatAmount(transaction.amount)}
                    </TableCell>
                    <TableCell>
                      <CategorySelect
                        value={transaction.category}
                        onValueChange={(category) =>
                          onCategoryChange(
                            transaction.id,
                            category,
                            transaction.propertyId ?? undefined
                          )
                        }
                      />
                    </TableCell>
                    <TableCell>
                      {transaction.property ? (
                        <Badge variant="outline">
                          {transaction.property.address}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">
                          Unassigned
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onToggleVerified(transaction.id)}
                        className={
                          transaction.isVerified
                            ? "text-success"
                            : "text-muted-foreground"
                        }
                      >
                        {transaction.isVerified ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <X className="w-4 h-4" />
                        )}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => onEdit?.(transaction.id)}
                          >
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleMakeRecurring(transaction)}
                            disabled={!transaction.propertyId}
                          >
                            Make Recurring
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => onDelete?.(transaction.id)}
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {selectedTransaction && (
        <MakeRecurringDialog
          transaction={selectedTransaction as unknown as Transaction}
          open={recurringDialogOpen}
          onOpenChange={setRecurringDialogOpen}
        />
      )}
    </div>
  );
}
