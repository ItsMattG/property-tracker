"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PropertyCard } from "@/components/properties/PropertyCard";
import { trpc } from "@/lib/trpc/client";
import { Plus, Building2 } from "lucide-react";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";

export default function PropertiesPage() {
  const { data: properties, isLoading, refetch } = trpc.property.list.useQuery(
    undefined,
    {
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false,
    }
  );
  const deleteProperty = trpc.property.delete.useMutation({
    onSuccess: () => {
      toast.success("Property deleted");
      refetch();
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this property?")) {
      await deleteProperty.mutateAsync({ id });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Properties</h2>
            <p className="text-muted-foreground">
              Manage your investment properties
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-48 rounded-lg bg-muted animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Properties</h2>
          <p className="text-muted-foreground">
            Manage your investment properties
          </p>
        </div>
        <Button asChild>
          <Link href="/properties/new">
            <Plus className="w-4 h-4 mr-2" />
            Add Property
          </Link>
        </Button>
      </div>

      {properties && properties.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {properties.map((property) => (
            <PropertyCard
              key={property.id}
              property={property}
              onDelete={handleDelete}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Building2 className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold">No properties yet</h3>
          <p className="text-muted-foreground max-w-sm mt-2">
            Add your first investment property to start tracking your portfolio.
          </p>
          <Button asChild className="mt-4">
            <Link href="/properties/new">
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Property
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
