"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Pagination } from "@/components/ui/pagination";
import { CategorySelect } from "@/components/transactions/CategorySelect";
import { TransactionTableSkeleton } from "@/components/skeletons";
import { trpc } from "@/lib/trpc/client";
import { formatCurrencyWithCents } from "@/lib/utils";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";
import { getCategoryInfo } from "@/lib/categories";
import { format } from "date-fns";
import {
  ArrowLeft,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  Landmark,
  Check,
  X,
  Download,
} from "lucide-react";

const PAGE_SIZE = 50;

export default function ReconcilePage() {
  const params = useParams<{ accountId: string }>();
  const accountId = params?.accountId ?? "";

  const [activeTab, setActiveTab] = useState("reconcile");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const offset = (page - 1) * PAGE_SIZE;
  const utils = trpc.useUtils();

  // Fetch account summaries to find this account's details
  const { data: summaries } = trpc.banking.getAccountSummaries.useQuery();
  const { data: allAccounts } = trpc.banking.listAccounts.useQuery();
  const summary = summaries?.find((s) => s.id === accountId);
  const account = allAccounts?.find((a) => a.id === accountId);

  // Fetch unreconciled transactions
  const { data: unreconciledData, isLoading: unreconciledLoading } =
    trpc.transaction.list.useQuery(
      {
        bankAccountId: accountId,
        category: "uncategorized" as const,
        limit: PAGE_SIZE,
        offset,
      },
      { enabled: activeTab === "reconcile" }
    );

  // Fetch reconciled transactions
  const { data: reconciledData, isLoading: reconciledLoading } =
    trpc.transaction.list.useQuery(
      {
        bankAccountId: accountId,
        limit: PAGE_SIZE,
        offset: activeTab === "account" ? offset : 0,
      },
      { enabled: activeTab === "account" }
    );

  const currentData = activeTab === "reconcile" ? unreconciledData : reconciledData;
  const isLoading = activeTab === "reconcile" ? unreconciledLoading : reconciledLoading;

  const totalPages = currentData?.total
    ? Math.ceil(currentData.total / PAGE_SIZE)
    : 1;

  // Filter by search query (client-side for simplicity)
  const filteredTransactions = currentData?.transactions.filter((t) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      t.description.toLowerCase().includes(q) ||
      t.amount.includes(q)
    );
  });

  const updateCategory = trpc.transaction.updateCategory.useMutation({
    onSuccess: () => {
      toast.success("Category updated");
      utils.transaction.list.invalidate();
      utils.banking.getAccountSummaries.invalidate();
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const bulkUpdateCategory = trpc.transaction.bulkUpdateCategory.useMutation({
    onSuccess: (result) => {
      toast.success(`Updated ${result.count} transactions`);
      utils.transaction.list.invalidate();
      utils.banking.getAccountSummaries.invalidate();
      setSelectedIds(new Set());
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const toggleVerified = trpc.transaction.toggleVerified.useMutation({
    onSuccess: () => {
      utils.transaction.list.invalidate();
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const exportCSV = trpc.transaction.exportCSV.useQuery(
    { bankAccountId: accountId },
    { enabled: false }
  );

  const handleExportCSV = async () => {
    try {
      const result = await exportCSV.refetch();
      if (result.data) {
        const blob = new Blob([result.data.csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = result.data.filename;
        link.click();
        URL.revokeObjectURL(url);
        toast.success("CSV exported successfully");
      }
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
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
    if (!filteredTransactions) return;
    if (selectedIds.size === filteredTransactions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredTransactions.map((t) => t.id)));
    }
  };

  const handleBulkCategory = (category: string) => {
    bulkUpdateCategory.mutate({
      ids: Array.from(selectedIds),
      category: category as any,
    });
  };

  return (
    <div className="space-y-6">
      {/* Back link + header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/banking">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Bank Feeds
          </Link>
        </Button>
      </div>

      {/* Account header */}
      {summary && (
        <div>
          <h2 className="text-2xl font-bold">{summary.accountName}</h2>
          <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
            <span>{summary.institution}</span>
            {summary.accountNumberMasked && (
              <>
                <span>·</span>
                <span>{summary.accountNumberMasked}</span>
              </>
            )}
            <Badge variant="outline" className="text-xs">
              {summary.accountType}
            </Badge>
          </div>
        </div>
      )}

      {/* Balance summary cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <Wallet className="w-4 h-4" />
                BrickTrack Balance
              </div>
              <div className="text-xl font-semibold">
                {formatCurrencyWithCents(summary.reconciledBalance)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <Landmark className="w-4 h-4" />
                Bank Balance
              </div>
              <div className="text-xl font-semibold">
                {summary.bankBalance
                  ? formatCurrencyWithCents(summary.bankBalance)
                  : <span className="text-muted-foreground text-sm">Not available</span>}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <ArrowUpRight className="w-4 h-4 text-success" />
                Cash In
              </div>
              <div className="text-xl font-semibold text-success">
                {formatCurrencyWithCents(summary.cashIn)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <ArrowDownRight className="w-4 h-4 text-destructive" />
                Cash Out
              </div>
              <div className="text-xl font-semibold text-destructive">
                {formatCurrencyWithCents(Math.abs(parseFloat(summary.cashOut)))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Account switcher tabs */}
      {allAccounts && allAccounts.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {allAccounts.map((acct) => (
            <Button
              key={acct.id}
              variant={acct.id === accountId ? "default" : "outline"}
              size="sm"
              asChild
            >
              <Link href={`/banking/${acct.id}/reconcile`}>
                {acct.nickname || acct.accountName}
              </Link>
            </Button>
          ))}
        </div>
      )}

      {/* Three-tab navigation */}
      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setPage(1); setSelectedIds(new Set()); }}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="reconcile">
              Reconcile
              {summary && summary.unreconciledCount > 0 && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  {summary.unreconciledCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="account">Account Transactions</TabsTrigger>
            <TabsTrigger value="rules" disabled>
              Bank Rules
            </TabsTrigger>
          </TabsList>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            disabled={exportCSV.isFetching}
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>

        <TabsContent value="reconcile" className="mt-4 space-y-4">
          <ReconcileContent />
        </TabsContent>
        <TabsContent value="account" className="mt-4 space-y-4">
          <ReconcileContent />
        </TabsContent>
        <TabsContent value="rules" className="mt-4">
          <div className="text-center py-12 text-muted-foreground">
            Bank rules coming soon
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );

  function ReconcileContent() {
    return (
      <>
        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search transactions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Bulk actions */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
            <span className="text-sm font-medium">
              {selectedIds.size} selected
            </span>
            <CategorySelect onValueChange={handleBulkCategory} />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
            >
              Clear selection
            </Button>
          </div>
        )}

        {/* Transaction table */}
        {isLoading ? (
          <TransactionTableSkeleton />
        ) : filteredTransactions && filteredTransactions.length > 0 ? (
          <TooltipProvider>
            <div className="rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={
                          filteredTransactions.length > 0 &&
                          selectedIds.size === filteredTransactions.length
                        }
                        onCheckedChange={toggleAll}
                      />
                    </TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Property</TableHead>
                    <TableHead className="w-20">Verified</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions.map((transaction) => {
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
                        </TableCell>
                        <TableCell className="font-medium">
                          <div className={isIncome ? "text-success" : ""}>
                            {formatCurrencyWithCents(transaction.amount)}
                          </div>
                          {transaction.category === "uncategorized" ? (
                            <div className="text-xs mt-0.5">
                              <span className="text-muted-foreground">$0.00</span>
                              <span className="text-muted-foreground/60">
                                {" "}of {formatCurrencyWithCents(transaction.amount)} allocated
                              </span>
                            </div>
                          ) : (
                            <div className="text-xs text-success/80 mt-0.5">
                              Allocated
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <CategorySelect
                            value={transaction.category}
                            onValueChange={(category) =>
                              updateCategory.mutate({
                                id: transaction.id,
                                category: category as any,
                                propertyId: transaction.propertyId ?? undefined,
                              })
                            }
                          />
                        </TableCell>
                        <TableCell>
                          {transaction.property ? (
                            <Badge variant="outline">
                              {(transaction.property as any).address}
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
                            onClick={() => toggleVerified.mutate({ id: transaction.id })}
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
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </TooltipProvider>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            {activeTab === "reconcile"
              ? "No unreconciled transactions"
              : "No transactions found"}
          </div>
        )}

        {totalPages > 1 && (
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
            isLoading={isLoading}
          />
        )}
      </>
    );
  }
}
