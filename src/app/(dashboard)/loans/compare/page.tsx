"use client";

import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2, ExternalLink, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function ComparisonsListPage() {
  const utils = trpc.useUtils();

  const { data: comparisons, isLoading } = trpc.loanComparison.listComparisons.useQuery();

  const deleteComparison = trpc.loanComparison.deleteComparison.useMutation({
    onSuccess: () => {
      utils.loanComparison.listComparisons.invalidate();
    },
  });

  const formatCurrency = (amount: string) =>
    new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      minimumFractionDigits: 0,
    }).format(parseFloat(amount));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/loans">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Loans
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Saved Comparisons</h1>
        </div>
      </div>

      {!comparisons || comparisons.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">No saved comparisons yet</p>
            <Link href="/loans">
              <Button>Compare a Loan</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {comparisons.map((comparison) => (
            <Card key={comparison.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg">{comparison.name}</CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteComparison.mutate({ id: comparison.id })}
                    disabled={deleteComparison.isPending}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {comparison.loan?.property?.address}
                </p>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">New Rate</span>
                  <span className="font-medium">{comparison.newRate}%</span>
                </div>
                {comparison.newLender && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Lender</span>
                    <span>{comparison.newLender}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Switching Costs</span>
                  <span>{formatCurrency(comparison.switchingCosts)}</span>
                </div>
                <Link href={`/loans/${comparison.loanId}/compare`}>
                  <Button variant="outline" size="sm" className="w-full mt-2">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View Details
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
