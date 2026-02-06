"use client";

import { useParams, useRouter } from "next/navigation";
import { LoanForm, LoanFormValues } from "@/components/loans/LoanForm";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";

export default function EditLoanPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const router = useRouter();
  const { data: loan, isLoading } = trpc.loan.get.useQuery({ id }, { enabled: !!id });
  const utils = trpc.useUtils();

  const updateLoan = trpc.loan.update.useMutation({
    onSuccess: () => {
      toast.success("Loan updated");
      utils.loan.list.invalidate();
      utils.loan.stale.invalidate();
      router.push("/loans");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update loan");
    },
  });

  const handleSubmit = (values: LoanFormValues) => {
    updateLoan.mutate({ id, ...values });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Edit Loan</h2>
          <p className="text-muted-foreground">Loading loan details...</p>
        </div>
        <div className="h-96 rounded-lg bg-muted animate-pulse" />
      </div>
    );
  }

  if (!loan) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Loan Not Found</h2>
          <p className="text-muted-foreground">
            The loan you&apos;re looking for doesn&apos;t exist.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Edit Loan</h2>
        <p className="text-muted-foreground">
          Update details for your {loan.lender} loan
        </p>
      </div>

      <div className="max-w-2xl">
        <LoanForm
          defaultValues={{
            propertyId: loan.propertyId,
            lender: loan.lender,
            accountNumberMasked: loan.accountNumberMasked ?? "",
            loanType: loan.loanType as "principal_and_interest" | "interest_only",
            rateType: loan.rateType as "variable" | "fixed" | "split",
            originalAmount: loan.originalAmount,
            currentBalance: loan.currentBalance,
            interestRate: loan.interestRate,
            fixedRateExpiry: loan.fixedRateExpiry ?? "",
            repaymentAmount: loan.repaymentAmount,
            repaymentFrequency: loan.repaymentFrequency as "weekly" | "fortnightly" | "monthly",
          }}
          onSubmit={handleSubmit}
          isLoading={updateLoan.isPending}
        />
      </div>
    </div>
  );
}
