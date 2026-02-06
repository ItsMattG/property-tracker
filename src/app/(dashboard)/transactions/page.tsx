"use client";

import { useState, useEffect } from "react";
import { TransactionTable } from "@/components/transactions/TransactionTable";
import { TransactionFilters } from "@/components/transactions/TransactionFilters";
import { AddTransactionDialog } from "@/components/transactions/AddTransactionDialog";
import { ImportCSVDialog } from "@/components/transactions/ImportCSVDialog";
import { ReconciliationView } from "@/components/recurring/ReconciliationView";
import { Pagination } from "@/components/ui/pagination";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc/client";
import { ArrowLeftRight, List, Calendar } from "lucide-react";
import type { Category, TransactionFilterInput } from "@/types/category";
import { useTour } from "@/hooks/useTour";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";
import { onCrossTabInvalidation } from "@/lib/trpc/cross-tab";
import { TransactionTableSkeleton } from "@/components/skeletons";

type ViewMode = "transactions" | "reconciliation";

const PAGE_SIZE = 50;

export default function TransactionsPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("transactions");
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<TransactionFilterInput>({});
  useTour({ tourId: "transactions" });

  const offset = (page - 1) * PAGE_SIZE;

  const utils = trpc.useUtils();

  useEffect(() => {
    return onCrossTabInvalidation((keys) => {
      if (keys.includes("transaction.list")) {
        utils.transaction.list.invalidate();
      }
    });
  }, [utils]);

  const { data: properties } = trpc.property.list.useQuery();
  const {
    data: transactions,
    isLoading,
    isFetching,
  } = trpc.transaction.list.useQuery({
    propertyId: filters.propertyId,
    category: filters.category,
    startDate: filters.startDate,
    endDate: filters.endDate,
    isVerified: filters.isVerified,
    limit: PAGE_SIZE,
    offset,
  });

  // Show loading skeleton on initial load or when filters change
  const showLoading = isLoading || (isFetching && !transactions);

  const totalPages = transactions?.total
    ? Math.ceil(transactions.total / PAGE_SIZE)
    : 1;

  const updateCategory = trpc.transaction.updateCategory.useMutation({
    onMutate: async (newData) => {
      await utils.transaction.list.cancel();
      const queryKey = {
        propertyId: filters.propertyId,
        category: filters.category,
        startDate: filters.startDate,
        endDate: filters.endDate,
        isVerified: filters.isVerified,
        limit: PAGE_SIZE,
        offset,
      };
      const previous = utils.transaction.list.getData(queryKey);

      utils.transaction.list.setData(queryKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          transactions: old.transactions.map((t) =>
            t.id === newData.id ? { ...t, category: newData.category } : t
          ),
        };
      });

      return { previous, queryKey };
    },
    onSuccess: () => {
      toast.success("Category updated");
    },
    onError: (error, _newData, context) => {
      if (context?.previous) {
        utils.transaction.list.setData(context.queryKey, context.previous);
      }
      toast.error(getErrorMessage(error));
    },
    onSettled: () => {
      utils.transaction.list.invalidate();
    },
  });

  const bulkUpdateCategory = trpc.transaction.bulkUpdateCategory.useMutation({
    onSuccess: (result) => {
      toast.success(`Updated ${result.count} transactions`);
      utils.transaction.list.invalidate();
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const toggleVerified = trpc.transaction.toggleVerified.useMutation({
    onMutate: async (newData) => {
      await utils.transaction.list.cancel();
      const queryKey = {
        propertyId: filters.propertyId,
        category: filters.category,
        startDate: filters.startDate,
        endDate: filters.endDate,
        isVerified: filters.isVerified,
        limit: PAGE_SIZE,
        offset,
      };
      const previous = utils.transaction.list.getData(queryKey);

      utils.transaction.list.setData(queryKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          transactions: old.transactions.map((t) =>
            t.id === newData.id ? { ...t, isVerified: !t.isVerified } : t
          ),
        };
      });

      return { previous, queryKey };
    },
    onError: (error, _newData, context) => {
      if (context?.previous) {
        utils.transaction.list.setData(context.queryKey, context.previous);
      }
      toast.error(getErrorMessage(error));
    },
    onSettled: () => {
      utils.transaction.list.invalidate();
    },
  });

  const handleCategoryChange = (
    id: string,
    category: string,
    propertyId?: string
  ) => {
    updateCategory.mutate({
      id,
      category: category as Category,
      propertyId,
    });
  };

  const handleBulkCategoryChange = async (ids: string[], category: string) => {
    await bulkUpdateCategory.mutateAsync({
      ids,
      category: category as Category,
    });
  };

  const handleToggleVerified = (id: string) => {
    toggleVerified.mutate({ id });
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  // Reset to page 1 when filters change
  const handleFiltersChange = (newFilters: {
    propertyId?: string;
    category?: string;
    startDate?: string;
    endDate?: string;
    isVerified?: boolean;
  }) => {
    setFilters(newFilters as TransactionFilterInput);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Transactions</h2>
          <p className="text-muted-foreground">
            Review and categorize your transactions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ImportCSVDialog onSuccess={() => utils.transaction.list.invalidate()} />
          <AddTransactionDialog onSuccess={() => utils.transaction.list.invalidate()} />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant={viewMode === "transactions" ? "default" : "outline"}
          size="sm"
          onClick={() => setViewMode("transactions")}
        >
          <List className="w-4 h-4 mr-2" />
          All Transactions
        </Button>
        <Button
          variant={viewMode === "reconciliation" ? "default" : "outline"}
          size="sm"
          onClick={() => setViewMode("reconciliation")}
        >
          <Calendar className="w-4 h-4 mr-2" />
          Reconciliation
        </Button>
      </div>

      {viewMode === "transactions" ? (
        <>
          <div data-tour="filters">
            <TransactionFilters
              properties={properties ?? []}
              filters={filters}
              onFiltersChange={handleFiltersChange}
            />
          </div>

          {showLoading ? (
            <TransactionTableSkeleton />
          ) : transactions && transactions.transactions.length > 0 ? (
            <>
              <TransactionTable
                transactions={transactions.transactions as any}
                properties={properties ?? []}
                onCategoryChange={handleCategoryChange}
                onToggleVerified={handleToggleVerified}
                onBulkCategoryChange={handleBulkCategoryChange}
              />
              {totalPages > 1 && (
                <Pagination
                  currentPage={page}
                  totalPages={totalPages}
                  onPageChange={handlePageChange}
                  isLoading={isLoading}
                />
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <ArrowLeftRight className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold">No transactions yet</h3>
              <p className="text-muted-foreground max-w-sm mt-2">
                Connect your bank account to automatically import transactions, or
                add them manually.
              </p>
            </div>
          )}
        </>
      ) : (
        <ReconciliationView propertyId={filters.propertyId} />
      )}
    </div>
  );
}
