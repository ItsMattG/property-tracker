"use client";

import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DocumentsSection } from "@/components/documents";
import { trpc } from "@/lib/trpc/client";

export default function PropertyDocumentsPage() {
  const params = useParams();
  const router = useRouter();
  const propertyId = params.id as string;

  const { data: property, isLoading } = trpc.property.get.useQuery({ id: propertyId });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!property) {
    return (
      <div className="text-center py-12">
        <h2 className="text-lg font-semibold">Property not found</h2>
        <p className="text-muted-foreground mt-1">
          The property you&apos;re looking for doesn&apos;t exist or you don&apos;t have access.
        </p>
        <Button variant="outline" className="mt-4" onClick={() => router.push("/properties")}>
          Back to Properties
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Documents</h1>
          <p className="text-muted-foreground">
            {property.address}, {property.suburb}
          </p>
        </div>
      </div>

      {/* Documents section */}
      <Card>
        <CardHeader>
          <CardTitle>Property Documents</CardTitle>
          <CardDescription>
            Upload and manage documents related to this property such as contracts, receipts, depreciation schedules, and lease agreements.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DocumentsSection propertyId={propertyId} />
        </CardContent>
      </Card>
    </div>
  );
}
