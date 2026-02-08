"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PropertyForm, type PropertyFormValues } from "@/components/properties/PropertyForm";
import { trpc } from "@/lib/trpc/client";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useTour } from "@/hooks/useTour";
import { TrialPropertyLimitModal } from "@/components/modals/TrialPropertyLimitModal";
import { toast } from "sonner";

export default function NewPropertyPage() {
  const router = useRouter();
  useTour({ tourId: "add-property" });
  const utils = trpc.useUtils();

  const [showTrialModal, setShowTrialModal] = useState(false);
  const [pendingValues, setPendingValues] = useState<PropertyFormValues | null>(null);

  const { data: trialStatus } = trpc.billing.getTrialStatus.useQuery();
  const { data: entities } = trpc.entity.list.useQuery();

  const createProperty = trpc.property.create.useMutation({
    onSuccess: (property) => {
      // Pre-populate the property cache so the settlement page doesn't need to re-fetch
      utils.property.get.setData({ id: property.id }, property);
      utils.property.list.invalidate();

      // Show toast for 3rd+ property during trial
      if (trialStatus?.isOnTrial && trialStatus.propertyCount >= 2) {
        toast.info("Reminder: Only your first property stays active after your trial", {
          action: {
            label: "Upgrade",
            onClick: () => router.push("/settings/billing"),
          },
          duration: 5000,
        });
      }
      router.push(`/properties/${property.id}/settlement`);
    },
  });

  const handleSubmit = async (values: PropertyFormValues) => {
    // Check if this will be the 2nd property for a trial user
    if (trialStatus?.isOnTrial && trialStatus.propertyCount === 1) {
      setPendingValues(values);
      setShowTrialModal(true);
      return;
    }

    try {
      await createProperty.mutateAsync(values);
    } catch {
      toast.error("Failed to create property. Please check your details and try again.");
    }
  };

  const handleModalConfirm = async () => {
    if (pendingValues) {
      try {
        await createProperty.mutateAsync(pendingValues);
        setShowTrialModal(false);
        setPendingValues(null);
      } catch {
        toast.error("Failed to create property. Please check your details and try again.");
        setShowTrialModal(false);
      }
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/properties">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add New Property</CardTitle>
        </CardHeader>
        <CardContent>
          <PropertyForm
            onSubmit={handleSubmit}
            isLoading={createProperty.isPending}
            entities={entities}
          />
        </CardContent>
      </Card>

      {trialStatus?.trialEndsAt && (
        <TrialPropertyLimitModal
          open={showTrialModal}
          onOpenChange={setShowTrialModal}
          onConfirm={handleModalConfirm}
          trialEndsAt={new Date(trialStatus.trialEndsAt)}
          isLoading={createProperty.isPending}
        />
      )}
    </div>
  );
}
