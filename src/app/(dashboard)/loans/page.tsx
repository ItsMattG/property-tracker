"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LoanCard } from "@/components/loans/LoanCard";
import { trpc } from "@/lib/trpc/client";
import { Plus, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function LoansPage() {
  const router = useRouter();
  const { data: loans, isLoading, refetch } = trpc.loan.list.useQuery();
  const deleteLoan = trpc.loan.delete.useMutation({
    onSuccess: () => {
      toast.success("Loan deleted");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete loan");
    },
  });

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this loan?")) {
      deleteLoan.mutate({ id });
    }
  };

  const handleEdit = (id: string) => {
    router.push(`/loans/${id}/edit`);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Loans</h2>
            <p className="text-muted-foreground">Manage your investment property loans</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2].map((i) => (
            <div key={i} className="h-48 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Loans</h2>
          <p className="text-muted-foreground">Manage your investment property loans</p>
        </div>
        <Button asChild>
          <Link href="/loans/new">
            <Plus className="w-4 h-4 mr-2" />
            Add Loan
          </Link>
        </Button>
      </div>

      {loans && loans.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {loans.map((loan) => (
            <LoanCard
              key={loan.id}
              loan={loan}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Wallet className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold">No loans yet</h3>
          <p className="text-muted-foreground max-w-sm mt-2">
            Add your investment property loans to track interest and repayments.
          </p>
          <Button asChild className="mt-4">
            <Link href="/loans/new">
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Loan
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
