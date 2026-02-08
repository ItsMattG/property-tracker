"use client";

import { useParams, useRouter } from "next/navigation";
import { LoanForm, LoanFormValues } from "@/components/loans/LoanForm";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

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
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Edit Loan</CardTitle>
            <CardDescription>Loading loan details...</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-96 rounded-lg bg-muted animate-pulse" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!loan) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Loan Not Found</CardTitle>
            <CardDescription>
              The loan you&apos;re looking for doesn&apos;t exist.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Edit Loan</CardTitle>
          <CardDescription>
            Update details for your {loan.lender} loan
            {" "}&middot; last updated{" "}
            {formatDistanceToNow(new Date(loan.updatedAt), { addSuffix: true })}
          </CardDescription>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>
    </div>
  );
}
