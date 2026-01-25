"use client";

import { useParams } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ValuationCard } from "@/components/valuation";
import { PropertyComplianceSection } from "@/components/compliance/PropertyComplianceSection";
import { MilestonesSection } from "@/components/properties/MilestonesSection";
import { ClimateRiskCard } from "@/components/climate-risk";
import { BenchmarkCard } from "@/components/benchmarking";
import { Building2, MapPin, Calendar, Briefcase, DollarSign } from "lucide-react";

const formatCurrency = (value: string | number) => {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(num);
};

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
  const propertyId = params.id as string;

  const { data: property, isLoading, error } = trpc.property.get.useQuery(
    { id: propertyId },
    { enabled: !!propertyId }
  );

  const { data: milestones } = trpc.property.getMilestones.useQuery(
    { propertyId },
    { enabled: !!propertyId }
  );

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
            </div>
            <Badge variant={property.status === "active" ? "default" : "secondary"}>
              {property.status === "active" ? "Active" : "Sold"}
            </Badge>
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
              <p className="font-medium">{formatCurrency(property.purchasePrice)}</p>
            </div>
          </div>

          {/* Purchase Date */}
          <div className="flex items-start gap-3">
            <Calendar className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="text-sm text-muted-foreground">Purchase Date</p>
              <p className="font-medium">{formatDate(property.purchaseDate)}</p>
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
      <ValuationCard propertyId={propertyId} />

      {/* Climate Risk Card */}
      <ClimateRiskCard
        propertyId={propertyId}
        climateRisk={property.climateRisk}
      />

      {/* Benchmark Card */}
      <BenchmarkCard propertyId={propertyId} />

      {/* Milestones Section */}
      {milestones && milestones.length > 0 && (
        <MilestonesSection milestones={milestones} />
      )}

      {/* Compliance Section */}
      <div className="lg:col-span-2">
        <PropertyComplianceSection propertyId={propertyId} />
      </div>
    </div>
  );
}
