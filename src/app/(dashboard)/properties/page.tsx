"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PropertyCard } from "@/components/properties/PropertyCard";
import { trpc } from "@/lib/trpc/client";
import { Plus } from "lucide-react";
import { PropertyIllustration } from "@/components/ui/illustrations/PropertyIllustration";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";
import { PropertyListSkeleton } from "@/components/skeletons";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
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

const purposes = ["investment", "owner_occupied", "commercial", "short_term_rental"] as const;
const purposeLabels: Record<string, string> = {
  investment: "Investment",
  owner_occupied: "Owner-Occupied",
  commercial: "Commercial",
  short_term_rental: "Short-Term Rental",
};

export default function PropertiesPage() {
  const [deleteProperty, setDeleteProperty] = useState<{ id: string; address: string } | null>(null);
  const [excludedEntities, setExcludedEntities] = useState<Set<string>>(new Set());
  const [activePurpose, setActivePurpose] = useState<string>("all");
  const [showSold, setShowSold] = useState(false);

  const { data: properties, isLoading, refetch } = trpc.property.list.useQuery(
    undefined,
    {
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
    }
  );
  const { data: metrics } = trpc.portfolio.getPropertyMetrics.useQuery(
    { period: "monthly", sortBy: "alphabetical", sortOrder: "asc" },
    {
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: false,
    }
  );
  const deletePropertyMutation = trpc.property.delete.useMutation({
    onSuccess: () => {
      toast.success("Property deleted");
      refetch();
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const handleDelete = (id: string) => {
    const prop = properties?.find((p) => p.id === id);
    setDeleteProperty(prop ? { id: prop.id, address: prop.address } : { id, address: "" });
  };

  const confirmDelete = async () => {
    if (deleteProperty) {
      await deletePropertyMutation.mutateAsync({ id: deleteProperty.id });
      setDeleteProperty(null);
    }
  };

  // Derive unique entity names from properties for filter chips
  const entityNames = properties
    ? [...new Set(properties.map((p) => p.entityName))].sort()
    : [];

  const toggleEntity = (name: string) => {
    setExcludedEntities((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  const metricsMap = useMemo(() => {
    if (!metrics) return new Map();
    return new Map(metrics.map((m) => [m.propertyId, m]));
  }, [metrics]);

  const purposeCounts = useMemo(() => {
    if (!properties) return new Map<string, number>();
    const counts = new Map<string, number>();
    for (const p of properties) {
      const purpose = p.purpose ?? "investment";
      counts.set(purpose, (counts.get(purpose) ?? 0) + 1);
    }
    return counts;
  }, [properties]);

  const filteredProperties = useMemo(() => {
    if (!properties) return undefined;
    return properties.filter((p) => {
      // Purpose filter
      if (activePurpose !== "all" && (p.purpose ?? "investment") !== activePurpose) return false;
      // Sold toggle
      if (!showSold && p.status === "sold") return false;
      // Entity filter
      if (excludedEntities.has(p.entityName)) return false;
      return true;
    });
  }, [properties, activePurpose, showSold, excludedEntities]);

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

      {/* Purpose tabs */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setActivePurpose("all")}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors cursor-pointer border",
              activePurpose === "all"
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-muted-foreground border-border hover:text-foreground"
            )}
          >
            All
            <span className={cn(
              "text-xs",
              activePurpose === "all" ? "text-primary-foreground/70" : "text-muted-foreground"
            )}>
              {properties?.length ?? 0}
            </span>
          </button>
          {purposes.map((purpose) => {
            const count = purposeCounts.get(purpose) ?? 0;
            const isActive = activePurpose === purpose;
            return (
              <button
                key={purpose}
                onClick={() => setActivePurpose(purpose)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors cursor-pointer border",
                  isActive
                    ? "bg-primary text-primary-foreground border-primary"
                    : count === 0
                      ? "bg-background text-muted-foreground/50 border-border/50 cursor-default"
                      : "bg-background text-muted-foreground border-border hover:text-foreground"
                )}
                disabled={count === 0}
              >
                {purposeLabels[purpose]}
                <span className={cn(
                  "text-xs",
                  isActive ? "text-primary-foreground/70" : "text-muted-foreground"
                )}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Show sold toggle */}
        <div className="flex items-center gap-2">
          <Checkbox
            id="show-sold"
            checked={showSold}
            onCheckedChange={(checked) => setShowSold(checked === true)}
          />
          <Label htmlFor="show-sold" className="text-sm text-muted-foreground cursor-pointer">
            Show sold properties
          </Label>
        </div>
      </div>

      {/* Entity filter chips - only show when there are multiple entities */}
      {entityNames.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground mr-1">Filter:</span>
          {entityNames.map((name) => {
            const isExcluded = excludedEntities.has(name);
            const count = properties?.filter((p) => p.entityName === name).length ?? 0;
            return (
              <button
                key={name}
                onClick={() => toggleEntity(name)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium transition-colors cursor-pointer border",
                  isExcluded
                    ? "bg-muted text-muted-foreground border-transparent line-through opacity-60"
                    : "bg-primary/10 text-primary border-primary/20"
                )}
              >
                {name}
                <span className={cn(
                  "text-xs",
                  isExcluded ? "text-muted-foreground" : "text-primary/70"
                )}>
                  {count}
                </span>
              </button>
            );
          })}
          {excludedEntities.size > 0 && (
            <button
              onClick={() => setExcludedEntities(new Set())}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer underline"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {isLoading ? (
        <PropertyListSkeleton count={3} />
      ) : filteredProperties && filteredProperties.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProperties.map((property, i) => (
            <div key={property.id} className="animate-card-entrance" style={{ '--stagger-index': i } as React.CSSProperties}>
              <PropertyCard
                property={property}
                metrics={metricsMap.get(property.id)}
                onDelete={handleDelete}
              />
            </div>
          ))}
        </div>
      ) : properties && properties.length > 0 ? (
        // All properties filtered out
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-muted-foreground">No properties match your current filters.</p>
          <button
            onClick={() => {
              setExcludedEntities(new Set());
              setActivePurpose("all");
              setShowSold(false);
            }}
            className="text-sm text-primary hover:underline mt-2 cursor-pointer"
          >
            Clear all filters
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <PropertyIllustration className="w-24 h-24 text-primary/40 mb-4" />
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

      <AlertDialog
        open={!!deleteProperty}
        onOpenChange={(open) => !open && setDeleteProperty(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Property</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-medium">{deleteProperty?.address}</span>?
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
