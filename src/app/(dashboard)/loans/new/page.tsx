"use client";

import { useRouter } from "next/navigation";
import { LoanForm, LoanFormValues } from "@/components/loans/LoanForm";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
    <div className="max-w-2xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Add Loan</CardTitle>
          <CardDescription>
            Add a loan for one of your investment properties
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoanForm onSubmit={handleSubmit} isLoading={createLoan.isPending} />
        </CardContent>
      </Card>
    </div>
  );
}
