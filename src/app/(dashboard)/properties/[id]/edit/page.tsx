"use client";

import { useParams, useRouter } from "next/navigation";
import { PropertyForm, PropertyFormValues } from "@/components/properties/PropertyForm";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";

export default function EditPropertyPage() {
  const params = useParams();
  const router = useRouter();
  const propertyId = params?.id as string;

  const { data: property, isLoading } = trpc.property.get.useQuery({ id: propertyId });
  const { data: entities } = trpc.entity.list.useQuery();
  const updateProperty = trpc.property.update.useMutation({
    onSuccess: () => {
      toast.success("Property updated successfully");
      router.push("/properties");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update property");
    },
  });

  const handleSubmit = (values: PropertyFormValues) => {
    updateProperty.mutate({ id: propertyId, ...values });
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Edit Property</CardTitle>
            <CardDescription>Loading property details...</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-96 rounded-lg bg-muted animate-pulse" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Property Not Found</CardTitle>
            <CardDescription>
              The property you're looking for doesn't exist.
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
          <CardTitle>Edit Property</CardTitle>
          <CardDescription>
            Update the details for {property.address}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PropertyForm
            defaultValues={{
              address: property.address,
              suburb: property.suburb,
              state: property.state,
              postcode: property.postcode,
              purchasePrice: property.purchasePrice,
              contractDate: property.contractDate ?? property.purchaseDate,
              settlementDate: property.settlementDate ?? "",
              entityName: property.entityName,
            }}
            onSubmit={handleSubmit}
            isLoading={updateProperty.isPending}
            entities={entities}
          />
        </CardContent>
      </Card>
    </div>
  );
}
