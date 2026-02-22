"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PropertyForm, PropertyFormValues } from "@/components/properties/PropertyForm";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";

export default function EditPropertyPage() {
  const params = useParams();
  const router = useRouter();
  const propertyId = params?.id as string;

  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);

  const { data: property, isLoading } = trpc.property.get.useQuery({ id: propertyId });
  const { data: entities } = trpc.entity.list.useQuery();
  const { data: groups } = trpc.propertyGroup.list.useQuery();
  const { data: currentGroups } = trpc.propertyGroup.forProperty.useQuery(
    { propertyId },
    { enabled: !!property }
  );

  useEffect(() => {
    if (currentGroups) {
      setSelectedGroupIds(currentGroups.map((g) => g.id));
    }
  }, [currentGroups]);

  const updateProperty = trpc.property.update.useMutation();
  const assignGroupsMutation = trpc.propertyGroup.assignProperties.useMutation();
  const unassignGroupsMutation = trpc.propertyGroup.unassignProperties.useMutation();

  const handleSubmit = async (values: PropertyFormValues) => {
    try {
      await updateProperty.mutateAsync({ id: propertyId, ...values });

      // Diff-based group assignment
      const originalGroupIds = currentGroups?.map((g) => g.id) ?? [];
      const toAssign = selectedGroupIds.filter((id) => !originalGroupIds.includes(id));
      const toUnassign = originalGroupIds.filter((id) => !selectedGroupIds.includes(id));

      if (toAssign.length > 0 || toUnassign.length > 0) {
        await Promise.all([
          ...toAssign.map((groupId) =>
            assignGroupsMutation.mutateAsync({ groupId, propertyIds: [propertyId] })
          ),
          ...toUnassign.map((groupId) =>
            unassignGroupsMutation.mutateAsync({ groupId, propertyIds: [propertyId] })
          ),
        ]);
      }

      toast.success("Property updated successfully");
      router.push("/properties");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update property";
      toast.error(message);
    }
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
              latitude: property.latitude ?? "",
              longitude: property.longitude ?? "",
              purpose: property.purpose ?? "investment",
              colour: property.colour,
            }}
            onSubmit={handleSubmit}
            isLoading={updateProperty.isPending}
            entities={entities}
            groups={groups}
            selectedGroupIds={selectedGroupIds}
            onGroupIdsChange={setSelectedGroupIds}
          />
        </CardContent>
      </Card>
    </div>
  );
}
