"use client";

import { useState } from "react";
import { TransactionTable } from "@/components/transactions/TransactionTable";
import { TransactionFilters } from "@/components/transactions/TransactionFilters";
import { trpc } from "@/lib/trpc/client";
import { ArrowLeftRight } from "lucide-react";

export default function TransactionsPage() {
  const [filters, setFilters] = useState<{
    propertyId?: string;
    category?: string;
    startDate?: string;
    endDate?: string;
    isVerified?: boolean;
  }>({});

  const { data: properties } = trpc.property.list.useQuery();
  const {
    data: transactions,
    isLoading,
    refetch,
  } = trpc.transaction.list.useQuery({
    propertyId: filters.propertyId,
    category: filters.category as any,
    startDate: filters.startDate,
    endDate: filters.endDate,
    isVerified: filters.isVerified,
    limit: 100,
  });

  const updateCategory = trpc.transaction.updateCategory.useMutation({
    onSuccess: () => refetch(),
  });

  const bulkUpdateCategory = trpc.transaction.bulkUpdateCategory.useMutation({
    onSuccess: () => refetch(),
  });

  const toggleVerified = trpc.transaction.toggleVerified.useMutation({
    onSuccess: () => refetch(),
  });

  const handleCategoryChange = async (
    id: string,
    category: string,
    propertyId?: string
  ) => {
    await updateCategory.mutateAsync({
      id,
      category: category as any,
      propertyId,
    });
  };

  const handleBulkCategoryChange = async (ids: string[], category: string) => {
    await bulkUpdateCategory.mutateAsync({
      ids,
      category: category as any,
    });
  };

  const handleToggleVerified = async (id: string) => {
    await toggleVerified.mutateAsync({ id });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Transactions</h2>
          <p className="text-muted-foreground">
            Review and categorize your transactions
          </p>
        </div>
        <div className="h-96 rounded-lg bg-muted animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Transactions</h2>
        <p className="text-muted-foreground">
          Review and categorize your transactions
        </p>
      </div>

      <TransactionFilters
        properties={properties ?? []}
        filters={filters}
        onFiltersChange={setFilters}
      />

      {transactions && transactions.length > 0 ? (
        <TransactionTable
          transactions={transactions as any}
          properties={properties ?? []}
          onCategoryChange={handleCategoryChange}
          onToggleVerified={handleToggleVerified}
          onBulkCategoryChange={handleBulkCategoryChange}
        />
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
    </div>
  );
}
