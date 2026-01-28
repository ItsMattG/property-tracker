"use client";

import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc/client";
import { SettlementUpload } from "@/components/settlement/SettlementUpload";
import Link from "next/link";

export default function PropertySettlementPage() {
  const params = useParams();
  const router = useRouter();
  const propertyId = params?.id as string;

  const { data: property, isLoading } = trpc.property.get.useQuery({
    id: propertyId,
  });

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
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push("/properties")}
        >
          Back to Properties
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/properties/${propertyId}`}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Property
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold">
          {property.address}, {property.suburb}
        </h1>
        <p className="text-muted-foreground mt-1">
          Add your settlement statement to build your CGT cost base
        </p>
      </div>

      <SettlementUpload
        propertyId={propertyId}
        purchaseDate={property.purchaseDate}
        onComplete={() => router.push(`/properties/${propertyId}`)}
        onSkip={() => router.push(`/properties/${propertyId}`)}
      />
    </div>
  );
}
