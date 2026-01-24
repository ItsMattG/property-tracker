"use client";

import { useRouter } from "next/navigation";
import { LoanForm, LoanFormValues } from "@/components/loans/LoanForm";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";

export default function NewLoanPage() {
  const router = useRouter();
  const createLoan = trpc.loan.create.useMutation({
    onSuccess: () => {
      toast.success("Loan added successfully");
      router.push("/loans");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to add loan");
    },
  });

  const handleSubmit = (values: LoanFormValues) => {
    createLoan.mutate(values);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Add Loan</h2>
        <p className="text-muted-foreground">
          Add a loan for one of your investment properties
        </p>
      </div>

      <div className="max-w-2xl">
        <LoanForm onSubmit={handleSubmit} isLoading={createLoan.isPending} />
      </div>
    </div>
  );
}
