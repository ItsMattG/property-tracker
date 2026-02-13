"use client";

import { useState, useCallback, useRef, useEffect } from "react";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CategorySelect } from "./CategorySelect";
import { AllocationPopup } from "./AllocationPopup";
import { DiscussionNotesModal } from "./DiscussionNotesModal";
import { MakeRecurringDialog } from "@/components/recurring/MakeRecurringDialog";
import { TRANSACTION_COLUMNS } from "./ColumnVisibilityMenu";
import { getCategoryLabel, getCategoryInfo } from "@/lib/categories";
import { format } from "date-fns";
import { Check, X, MoreHorizontal, Sparkles, MessageSquare, ExternalLink } from "lucide-react";
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
  onAllocate?: (data: { id: string; category: string; propertyId?: string; claimPercent: number }) => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  columnVisibility?: Record<string, boolean>;
  onToggleColumn?: (columnId: string) => void;
  onResetColumns?: () => void;
}

const TYPE_BADGE_VARIANTS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  income: "default",
  expense: "secondary",
  capital: "outline",
  transfer: "outline",
  personal: "secondary",
};

export function TransactionTable({
  transactions,
  properties,
  onCategoryChange,
  onToggleVerified,
  onBulkCategoryChange,
  onAllocate,
  onEdit,
  onDelete,
  columnVisibility,
  onToggleColumn,
  onResetColumns,
}: TransactionTableProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [recurringDialogOpen, setRecurringDialogOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionWithRelations | null>(null);
  const [notesTransactionId, setNotesTransactionId] = useState<string | null>(null);
  const [notesTransactionDesc, setNotesTransactionDesc] = useState("");

  // Context menu state for right-click on header
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  const isVisible = useCallback(
    (colId: string) => columnVisibility?.[colId] ?? true,
    [columnVisibility]
  );

  // Count visible columns for the empty state colspan
  const visibleColumnCount = 2 + TRANSACTION_COLUMNS.filter((c) => isVisible(c.id)).length;
  // 2 = checkbox + actions (always visible)

  const handleHeaderContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (!onToggleColumn) return;
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY });
    },
    [onToggleColumn]
  );

  // Close context menu on click outside
  useEffect(() => {
    if (!contextMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [contextMenu]);

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

  const truncateUrl = (url: string, maxLen = 30) => {
    try {
      const parsed = new URL(url);
      const display = parsed.hostname + parsed.pathname;
      return display.length > maxLen ? display.slice(0, maxLen) + "..." : display;
    } catch {
      return url.length > maxLen ? url.slice(0, maxLen) + "..." : url;
    }
  };

  return (
    <TooltipProvider>
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
            <TableRow onContextMenu={handleHeaderContextMenu}>
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedIds.size === transactions.length && transactions.length > 0}
                  onCheckedChange={toggleAll}
                />
              </TableHead>
              {isVisible("date") && <TableHead>Date</TableHead>}
              {isVisible("description") && <TableHead>Description</TableHead>}
              {isVisible("amount") && <TableHead>Amount</TableHead>}
              {isVisible("type") && <TableHead>Type</TableHead>}
              {isVisible("category") && <TableHead data-tour="category-dropdown">Category</TableHead>}
              {isVisible("property") && <TableHead>Property</TableHead>}
              {isVisible("deductible") && <TableHead className="w-20">Deductible</TableHead>}
              {isVisible("notes") && <TableHead className="w-12">Notes</TableHead>}
              {isVisible("invoiceUrl") && <TableHead>Invoice URL</TableHead>}
              {isVisible("invoicePresent") && <TableHead className="w-20">Invoice</TableHead>}
              {isVisible("verified") && <TableHead className="w-20">Verified</TableHead>}
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={visibleColumnCount} className="text-center py-8 text-muted-foreground">
                  No transactions found
                </TableCell>
              </TableRow>
            ) : (
              transactions.map((transaction) => {
                const categoryInfo = getCategoryInfo(transaction.category);
                const isIncome = categoryInfo?.type === "income";

                return (
                  <TableRow key={transaction.id} className="hover:bg-muted/50 transition-colors">
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(transaction.id)}
                        onCheckedChange={() => toggleSelection(transaction.id)}
                      />
                    </TableCell>

                    {/* Date */}
                    {isVisible("date") && (
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(transaction.date), "dd MMM yyyy")}
                      </TableCell>
                    )}

                    {/* Description */}
                    {isVisible("description") && (
                      <TableCell className="max-w-[300px]">
                        {transaction.description.length > 40 ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="truncate cursor-default">
                                {transaction.description}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-sm">
                              <p>{transaction.description}</p>
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <div className="truncate">{transaction.description}</div>
                        )}
                        {transaction.notes && (
                          <div className="text-xs text-muted-foreground truncate mt-0.5">
                            {transaction.notes}
                          </div>
                        )}
                      </TableCell>
                    )}

                    {/* Amount */}
                    {isVisible("amount") && (
                      <TableCell className="font-medium">
                        <div className={isIncome ? "text-success" : ""}>
                          {formatAmount(transaction.amount)}
                        </div>
                        {transaction.category === "uncategorized" ? (
                          <div className="text-xs mt-0.5">
                            <span className="text-muted-foreground">$0.00</span>
                            <span className="text-muted-foreground/60"> of {formatAmount(transaction.amount)} allocated</span>
                          </div>
                        ) : (
                          <div className="text-xs text-success/80 mt-0.5">
                            Allocated
                          </div>
                        )}
                      </TableCell>
                    )}

                    {/* Type */}
                    {isVisible("type") && (
                      <TableCell>
                        <Badge
                          variant={TYPE_BADGE_VARIANTS[transaction.transactionType] ?? "outline"}
                          className="text-xs capitalize"
                        >
                          {transaction.transactionType}
                        </Badge>
                      </TableCell>
                    )}

                    {/* Category */}
                    {isVisible("category") && (
                      <TableCell>
                        <div className="flex items-center gap-2">
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
                          {transaction.category === "uncategorized" &&
                            transaction.suggestedCategory &&
                            transaction.suggestionConfidence &&
                            parseFloat(transaction.suggestionConfidence) >= 85 && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 gap-1 text-xs border-primary/30 text-primary hover:bg-primary/10"
                                    onClick={() =>
                                      onCategoryChange(
                                        transaction.id,
                                        transaction.suggestedCategory!,
                                        transaction.propertyId ?? undefined
                                      )
                                    }
                                  >
                                    <Sparkles className="w-3 h-3" />
                                    {getCategoryLabel(transaction.suggestedCategory)}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  AI suggests this category ({Math.round(parseFloat(transaction.suggestionConfidence))}% confident). Click to accept.
                                </TooltipContent>
                              </Tooltip>
                            )}
                        </div>
                      </TableCell>
                    )}

                    {/* Property */}
                    {isVisible("property") && (
                      <TableCell>
                        {transaction.property ? (
                          <Badge variant="outline">
                            {transaction.property.address}
                          </Badge>
                        ) : onAllocate && transaction.category === "uncategorized" ? (
                          <AllocationPopup
                            transactionId={transaction.id}
                            amount={transaction.amount}
                            description={transaction.description}
                            properties={properties.map((p) => ({ id: p.id, address: p.address, suburb: p.suburb }))}
                            onAllocate={onAllocate}
                          >
                            <Button variant="outline" size="sm" className="h-7 text-xs">
                              Allocate
                            </Button>
                          </AllocationPopup>
                        ) : (
                          <span className="text-muted-foreground text-sm">
                            Unassigned
                          </span>
                        )}
                      </TableCell>
                    )}

                    {/* Deductible */}
                    {isVisible("deductible") && (
                      <TableCell>
                        {transaction.isDeductible ? (
                          <Check className="w-4 h-4 text-success" />
                        ) : (
                          <X className="w-4 h-4 text-muted-foreground" />
                        )}
                      </TableCell>
                    )}

                    {/* Notes */}
                    {isVisible("notes") && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => {
                            setNotesTransactionId(transaction.id);
                            setNotesTransactionDesc(transaction.description);
                          }}
                        >
                          <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
                        </Button>
                      </TableCell>
                    )}

                    {/* Invoice URL */}
                    {isVisible("invoiceUrl") && (
                      <TableCell>
                        {transaction.invoiceUrl ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <a
                                href={transaction.invoiceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-primary hover:underline max-w-[150px] truncate"
                              >
                                {truncateUrl(transaction.invoiceUrl)}
                                <ExternalLink className="w-3 h-3 shrink-0" />
                              </a>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-sm">
                              <p>{transaction.invoiceUrl}</p>
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="text-muted-foreground text-xs">-</span>
                        )}
                      </TableCell>
                    )}

                    {/* Invoice Present */}
                    {isVisible("invoicePresent") && (
                      <TableCell>
                        {transaction.invoicePresent ? (
                          <Check className="w-4 h-4 text-success" />
                        ) : (
                          <X className="w-4 h-4 text-muted-foreground" />
                        )}
                      </TableCell>
                    )}

                    {/* Verified */}
                    {isVisible("verified") && (
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
                    )}

                    {/* Actions (always visible) */}
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" aria-label="Transaction actions">
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

      {/* Right-click context menu for column visibility */}
      {contextMenu && onToggleColumn && (
        <div
          ref={contextMenuRef}
          className="fixed z-50 min-w-[180px] rounded-md border bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <div className="px-2 py-1.5 text-sm font-semibold">Toggle columns</div>
          <div className="-mx-1 my-1 h-px bg-border" />
          {TRANSACTION_COLUMNS.map((col) => {
            const checked = columnVisibility?.[col.id] ?? col.defaultVisible;
            return (
              <button
                key={col.id}
                className="relative flex w-full cursor-pointer items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                onClick={() => {
                  onToggleColumn(col.id);
                }}
              >
                <span className="absolute left-2 flex size-3.5 items-center justify-center">
                  {checked && <Check className="size-4" />}
                </span>
                {col.label}
              </button>
            );
          })}
          <div className="-mx-1 my-1 h-px bg-border" />
          <button
            className="relative flex w-full cursor-pointer items-center rounded-sm py-1.5 px-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
            onClick={() => {
              onResetColumns?.();
              setContextMenu(null);
            }}
          >
            Reset to defaults
          </button>
        </div>
      )}

      {selectedTransaction && (
        <MakeRecurringDialog
          transaction={selectedTransaction as unknown as Transaction}
          open={recurringDialogOpen}
          onOpenChange={setRecurringDialogOpen}
        />
      )}

      {notesTransactionId && (
        <DiscussionNotesModal
          transactionId={notesTransactionId}
          transactionDescription={notesTransactionDesc}
          open={!!notesTransactionId}
          onOpenChange={(open) => {
            if (!open) {
              setNotesTransactionId(null);
              setNotesTransactionDesc("");
            }
          }}
        />
      )}
    </div>
    </TooltipProvider>
  );
}
