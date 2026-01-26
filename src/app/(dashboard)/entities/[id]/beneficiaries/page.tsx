"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Users } from "lucide-react";

export default function BeneficiariesPage() {
  const params = useParams();
  const entityId = params?.id as string;
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    relationship: "",
    tfn: "",
  });

  const { data: entity, isLoading: entityLoading } = trpc.entity.get.useQuery({ entityId });
  const { data: beneficiaries, isLoading, refetch } = trpc.trustCompliance.getBeneficiaries.useQuery(
    { entityId },
    { enabled: entity?.type === "trust" }
  );

  const addBeneficiary = trpc.trustCompliance.addBeneficiary.useMutation({
    onSuccess: () => {
      refetch();
      setIsOpen(false);
      setFormData({
        name: "",
        relationship: "",
        tfn: "",
      });
    },
  });

  if (entityLoading || isLoading) {
    return <Skeleton className="h-96" />;
  }

  if (!entity || entity.type !== "trust") {
    return (
      <Card>
        <CardContent className="py-6 text-center text-muted-foreground">
          Beneficiary management is only available for Trust entities.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Trust Beneficiaries</h1>
          <p className="text-muted-foreground">{entity.name}</p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Beneficiary
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Beneficiary</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="relationship">Relationship</Label>
                <Input
                  id="relationship"
                  placeholder="e.g., Spouse, Child, Company"
                  value={formData.relationship}
                  onChange={(e) => setFormData({ ...formData, relationship: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="tfn">TFN (optional)</Label>
                <Input
                  id="tfn"
                  value={formData.tfn}
                  onChange={(e) => setFormData({ ...formData, tfn: e.target.value })}
                />
              </div>
              <Button
                onClick={() => addBeneficiary.mutate({
                  entityId,
                  name: formData.name,
                  relationship: formData.relationship,
                  tfn: formData.tfn || undefined,
                })}
                disabled={!formData.name || !formData.relationship || addBeneficiary.isPending}
                className="w-full"
              >
                {addBeneficiary.isPending ? "Adding..." : "Add Beneficiary"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {beneficiaries?.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No beneficiaries added yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {beneficiaries?.map((beneficiary) => (
            <Card key={beneficiary.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg">{beneficiary.name}</CardTitle>
                  <Badge variant={beneficiary.isActive ? "default" : "secondary"}>
                    {beneficiary.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-1 text-sm">
                  <p className="text-muted-foreground">{beneficiary.relationship}</p>
                  {beneficiary.tfn && (
                    <p className="font-mono text-xs">TFN: •••-•••-{beneficiary.tfn.slice(-3)}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
