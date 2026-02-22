"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ValuationCard } from "@/components/valuation";
import { PropertyComplianceSection } from "@/components/compliance/PropertyComplianceSection";
import { PropertyTasksSection } from "@/components/tasks/PropertyTasksSection";
import { MilestonesCard } from "@/components/properties/MilestonesCard";
import { ClimateRiskCard } from "@/components/climate-risk";
import { BenchmarkCard } from "@/components/benchmarking";
import { PerformanceCard } from "@/components/performance-benchmarking";
import { SimilarPropertiesSection } from "@/components/similar-properties";
import { RentReviewCard } from "@/components/property/RentReviewCard";
import { PropertyCashFlowChart } from "@/components/properties/PropertyCashFlowChart";
import { featureFlags } from "@/config/feature-flags";
import { Building2, MapPin, Calendar, Briefcase, DollarSign, BarChart3, FileText, Calculator } from "lucide-react";
import Link from "next/link";
import { cn, formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
};

export default function PropertyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const propertyId = params?.id as string;
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { data: property, isLoading, error } = trpc.property.get.useQuery(
    { id: propertyId },
    { enabled: !!propertyId }
  );

  const { data: linkedTransactions } = trpc.transaction.list.useQuery(
    { propertyId, limit: 5 },
    { enabled: !!propertyId }
  );

  const { data: allLoans } = trpc.loan.list.useQuery(
    { propertyId },
    { enabled: !!propertyId }
  );

  const deletePropertyMutation = trpc.property.delete.useMutation({
    onSuccess: () => {
      toast.success("Property deleted");
      router.push("/properties");
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const confirmDelete = async () => {
    await deletePropertyMutation.mutateAsync({ id: propertyId });
    setDeleteOpen(false);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-primary" />
              </div>
              <CardTitle>Property Details</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-muted rounded w-3/4" />
              <div className="h-4 bg-muted rounded w-1/2" />
              <div className="h-4 bg-muted rounded w-2/3" />
              <div className="h-4 bg-muted rounded w-1/3" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Current Valuation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-muted rounded w-1/2" />
              <div className="h-4 bg-muted rounded w-3/4" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
          <Building2 className="w-8 h-8 text-destructive" />
        </div>
        <h3 className="text-lg font-semibold">Error Loading Property</h3>
        <p className="text-muted-foreground max-w-sm mt-2 mx-auto">
          {error.message || "Failed to load property details."}
        </p>
      </div>
    );
  }

  // Not found state
  if (!property) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
          <Building2 className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold">Property Not Found</h3>
        <p className="text-muted-foreground max-w-sm mt-2 mx-auto">
          The property you&apos;re looking for doesn&apos;t exist or you don&apos;t have access to it.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Property Details Card */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-primary" />
              </div>
              <CardTitle className="text-lg">Property Details</CardTitle>
              <Badge variant={property.status === "active" ? "default" : "secondary"}>
                {property.status === "active" ? "Active" : "Sold"}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href={`/properties/${property.id}/edit`}>Edit</Link>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => setDeleteOpen(true)}
              >
                Delete
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Address */}
          <div className="flex items-start gap-3">
            <MapPin className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">{property.address}</p>
              <p className="text-sm text-muted-foreground">
                {property.suburb}, {property.state} {property.postcode}
              </p>
            </div>
          </div>

          {/* Purchase Price */}
          <div className="flex items-start gap-3">
            <DollarSign className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="text-sm text-muted-foreground">Purchase Price</p>
              <p className="font-medium">{formatCurrency(parseFloat(property.purchasePrice))}</p>
            </div>
          </div>

          {/* Contract Date */}
          <div className="flex items-start gap-3">
            <Calendar className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="text-sm text-muted-foreground">Contract Date</p>
              <p className="font-medium">{formatDate(property.contractDate ?? property.purchaseDate)}</p>
            </div>
          </div>

          {/* Entity */}
          <div className="flex items-start gap-3">
            <Briefcase className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="text-sm text-muted-foreground">Ownership Entity</p>
              <p className="font-medium">{property.entityName}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Valuation Card */}
      {featureFlags.valuation && <ValuationCard propertyId={propertyId} />}

      {/* Quick Links */}
      {featureFlags.valuation && (
        <Card>
          <CardContent className="pt-6 space-y-3">
            <Link
              href={`/properties/${propertyId}/valuation`}
              className="flex items-center gap-2 text-primary hover:underline"
            >
              <BarChart3 className="h-4 w-4" />
              View Full Valuation History & Growth Stats
            </Link>
            <Link
              href={`/properties/${propertyId}/settlement`}
              className="flex items-center gap-2 text-primary hover:underline"
            >
              <FileText className="h-4 w-4" />
              Upload Settlement Statement for CGT Cost Base
            </Link>
            <Link
              href={`/properties/${propertyId}/depreciation`}
              className="flex items-center gap-2 text-primary hover:underline"
            >
              <Calculator className="h-4 w-4" />
              Depreciation Schedule & Tax Deductions
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Cash Flow Chart */}
      <div className="lg:col-span-2">
        <PropertyCashFlowChart propertyId={propertyId} />
      </div>

      {/* Climate Risk Card */}
      {featureFlags.climateRisk && (
        <ClimateRiskCard
          propertyId={propertyId}
          climateRisk={property.climateRisk}
        />
      )}

      {/* Benchmark Card */}
      {featureFlags.performanceBenchmark && (
        <BenchmarkCard propertyId={propertyId} />
      )}

      {/* Performance Card */}
      {featureFlags.performanceBenchmark && (
        <PerformanceCard propertyId={propertyId} />
      )}

      {/* Milestones Card */}
      {featureFlags.milestones && <MilestonesCard propertyId={propertyId} />}

      {/* Rent Review Card */}
      {featureFlags.rentReview && <RentReviewCard propertyId={propertyId} />}

      {/* Similar Properties Section */}
      {featureFlags.similarProperties && (
        <div className="lg:col-span-2">
          <SimilarPropertiesSection propertyId={propertyId} />
        </div>
      )}

      {/* Compliance Section */}
      {featureFlags.compliance && (
        <div className="lg:col-span-2">
          <PropertyComplianceSection propertyId={propertyId} />
        </div>
      )}

      {/* Tasks Section */}
      {featureFlags.tasks && (
        <div className="lg:col-span-2">
          <PropertyTasksSection propertyId={propertyId} />
        </div>
      )}

      {/* Recent Transactions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Recent Transactions</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/transactions?propertyId=${property.id}`}>View all</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {linkedTransactions?.transactions.length ? (
            <div className="space-y-2">
              {linkedTransactions.transactions.map((txn) => (
                <div key={txn.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium">{txn.description}</p>
                    <p className="text-xs text-muted-foreground">{txn.date}</p>
                  </div>
                  <p className={cn("text-sm font-medium", Number(txn.amount) >= 0 ? "text-green-600" : "text-red-600")}>
                    {formatCurrency(parseFloat(txn.amount))}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No transactions yet</p>
          )}
        </CardContent>
      </Card>

      {/* Linked Loans */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Loans</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/loans">View all</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {allLoans && allLoans.length > 0 ? (
            <div className="space-y-2">
              {allLoans.map((loan) => (
                <div key={loan.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium">{loan.lender}</p>
                    <p className="text-xs text-muted-foreground">{loan.loanType} · {loan.rateType}</p>
                  </div>
                  <p className="text-sm font-medium">
                    {formatCurrency(parseFloat(loan.currentBalance))}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No loans linked to this property</p>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Property</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-medium">{property.address}</span>?
              This action cannot be undone and will remove all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
