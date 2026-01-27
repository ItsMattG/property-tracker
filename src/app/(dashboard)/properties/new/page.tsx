"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PropertyForm, type PropertyFormValues } from "@/components/properties/PropertyForm";
import { trpc } from "@/lib/trpc/client";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useTour } from "@/hooks/useTour";

export default function NewPropertyPage() {
  const router = useRouter();
  useTour({ tourId: "add-property" });
  const createProperty = trpc.property.create.useMutation({
    onSuccess: () => {
      router.push("/properties");
    },
  });

  const handleSubmit = async (values: PropertyFormValues) => {
    await createProperty.mutateAsync(values);
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
          />
        </CardContent>
      </Card>
    </div>
  );
}
