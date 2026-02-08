"use client";

import { useParams, useRouter } from "next/navigation";
import { PropertyForm, PropertyFormValues } from "@/components/properties/PropertyForm";
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
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Edit Property</h2>
          <p className="text-muted-foreground">Loading property details...</p>
        </div>
        <div className="h-96 rounded-lg bg-muted animate-pulse" />
      </div>
    );
  }

  if (!property) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Property Not Found</h2>
          <p className="text-muted-foreground">
            The property you're looking for doesn't exist.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Edit Property</h2>
        <p className="text-muted-foreground">
          Update the details for {property.address}
        </p>
      </div>

      <div className="max-w-2xl">
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
      </div>
    </div>
  );
}
