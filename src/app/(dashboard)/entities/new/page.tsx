"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import {
  Building2,
  Users,
  Landmark,
  Briefcase,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

type EntityType = "personal" | "trust" | "smsf" | "company";

const entityTypes = [
  {
    type: "personal" as const,
    label: "Personal",
    description: "Properties held in your own name",
    icon: Building2,
  },
  {
    type: "trust" as const,
    label: "Trust",
    description: "Family trust or discretionary trust",
    icon: Users,
  },
  {
    type: "smsf" as const,
    label: "SMSF",
    description: "Self-managed superannuation fund",
    icon: Landmark,
  },
  {
    type: "company" as const,
    label: "Company",
    description: "Pty Ltd or other company structure",
    icon: Briefcase,
  },
];

export default function NewEntityPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [entityType, setEntityType] = useState<EntityType | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    abn: "",
    tfn: "",
    // Trust details
    trusteeType: "individual" as "individual" | "corporate",
    trusteeName: "",
    settlementDate: "",
    trustDeedDate: "",
    // SMSF details
    fundName: "",
    fundAbn: "",
    establishmentDate: "",
    auditorName: "",
    auditorContact: "",
  });

  const createEntity = trpc.entity.create.useMutation({
    onSuccess: (entity) => {
      router.push(`/entities/${entity.id}`);
    },
  });

  const handleSubmit = () => {
    if (!entityType) return;

    const payload: Parameters<typeof createEntity.mutate>[0] = {
      type: entityType,
      name: formData.name,
      abn: formData.abn || undefined,
      tfn: formData.tfn || undefined,
    };

    if (entityType === "trust") {
      payload.trustDetails = {
        trusteeType: formData.trusteeType,
        trusteeName: formData.trusteeName,
        settlementDate: formData.settlementDate || undefined,
        trustDeedDate: formData.trustDeedDate || undefined,
      };
    }

    if (entityType === "smsf") {
      payload.smsfDetails = {
        fundName: formData.fundName,
        fundAbn: formData.fundAbn || undefined,
        establishmentDate: formData.establishmentDate || undefined,
        auditorName: formData.auditorName || undefined,
        auditorContact: formData.auditorContact || undefined,
      };
    }

    createEntity.mutate(payload);
  };

  const totalSteps = entityType === "personal" || entityType === "company" ? 2 : 3;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Create New Entity</h1>
          <p className="text-muted-foreground">
            Step {step} of {totalSteps}
          </p>
        </div>
      </div>

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Select Entity Type</CardTitle>
            <CardDescription>
              Choose the type of legal entity that will hold your properties.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {entityTypes.map((et) => (
              <button
                key={et.type}
                onClick={() => {
                  setEntityType(et.type);
                  setStep(2);
                }}
                className={cn(
                  "flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-colors cursor-pointer",
                  "hover:border-primary hover:bg-primary/5",
                  entityType === et.type && "border-primary bg-primary/5"
                )}
              >
                <et.icon className="h-8 w-8 text-primary" />
                <span className="font-medium">{et.label}</span>
                <span className="text-xs text-muted-foreground text-center">
                  {et.description}
                </span>
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Entity Details</CardTitle>
            <CardDescription>
              Enter the basic details for your {entityType} entity.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Entity Name *</Label>
              <Input
                id="name"
                placeholder={
                  entityType === "personal"
                    ? "Personal"
                    : "Smith Family Trust"
                }
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
            </div>
            {entityType !== "personal" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="abn">ABN (optional)</Label>
                  <Input
                    id="abn"
                    placeholder="12 345 678 901"
                    value={formData.abn}
                    onChange={(e) =>
                      setFormData({ ...formData, abn: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tfn">TFN (optional)</Label>
                  <Input
                    id="tfn"
                    placeholder="123 456 789"
                    value={formData.tfn}
                    onChange={(e) =>
                      setFormData({ ...formData, tfn: e.target.value })
                    }
                  />
                </div>
              </>
            )}
            <div className="flex gap-2 pt-4">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button
                onClick={() => {
                  if (entityType === "trust" || entityType === "smsf") {
                    setStep(3);
                  } else {
                    handleSubmit();
                  }
                }}
                disabled={!formData.name || createEntity.isPending}
              >
                {entityType === "trust" || entityType === "smsf" ? (
                  <>
                    Next
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                ) : createEntity.isPending ? (
                  "Creating..."
                ) : (
                  "Create Entity"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && entityType === "trust" && (
        <Card>
          <CardHeader>
            <CardTitle>Trust Details</CardTitle>
            <CardDescription>
              Enter the trustee information for your trust.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Trustee Type *</Label>
              <div className="flex gap-4">
                <Button
                  type="button"
                  variant={
                    formData.trusteeType === "individual" ? "default" : "outline"
                  }
                  onClick={() =>
                    setFormData({ ...formData, trusteeType: "individual" })
                  }
                >
                  Individual
                </Button>
                <Button
                  type="button"
                  variant={
                    formData.trusteeType === "corporate" ? "default" : "outline"
                  }
                  onClick={() =>
                    setFormData({ ...formData, trusteeType: "corporate" })
                  }
                >
                  Corporate
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="trusteeName">Trustee Name *</Label>
              <Input
                id="trusteeName"
                placeholder="John Smith or ABC Pty Ltd"
                value={formData.trusteeName}
                onChange={(e) =>
                  setFormData({ ...formData, trusteeName: e.target.value })
                }
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Settlement Date</Label>
                <DatePicker
                  value={formData.settlementDate}
                  onChange={(date) =>
                    setFormData({ ...formData, settlementDate: date })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Trust Deed Date</Label>
                <DatePicker
                  value={formData.trustDeedDate}
                  onChange={(date) =>
                    setFormData({ ...formData, trustDeedDate: date })
                  }
                />
              </div>
            </div>
            <div className="flex gap-2 pt-4">
              <Button variant="outline" onClick={() => setStep(2)}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!formData.trusteeName || createEntity.isPending}
              >
                {createEntity.isPending ? "Creating..." : "Create Entity"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && entityType === "smsf" && (
        <Card>
          <CardHeader>
            <CardTitle>SMSF Details</CardTitle>
            <CardDescription>
              Enter the fund details for your SMSF.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fundName">Fund Name *</Label>
              <Input
                id="fundName"
                placeholder="Smith Family Super Fund"
                value={formData.fundName}
                onChange={(e) =>
                  setFormData({ ...formData, fundName: e.target.value })
                }
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="fundAbn">Fund ABN</Label>
                <Input
                  id="fundAbn"
                  placeholder="12 345 678 901"
                  value={formData.fundAbn}
                  onChange={(e) =>
                    setFormData({ ...formData, fundAbn: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Establishment Date</Label>
                <DatePicker
                  value={formData.establishmentDate}
                  onChange={(date) =>
                    setFormData({
                      ...formData,
                      establishmentDate: date,
                    })
                  }
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="auditorName">Auditor Name</Label>
                <Input
                  id="auditorName"
                  placeholder="SMSF Audit Co"
                  value={formData.auditorName}
                  onChange={(e) =>
                    setFormData({ ...formData, auditorName: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="auditorContact">Auditor Contact</Label>
                <Input
                  id="auditorContact"
                  placeholder="auditor@example.com"
                  value={formData.auditorContact}
                  onChange={(e) =>
                    setFormData({ ...formData, auditorContact: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="flex gap-2 pt-4">
              <Button variant="outline" onClick={() => setStep(2)}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!formData.fundName || createEntity.isPending}
              >
                {createEntity.isPending ? "Creating..." : "Create Entity"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
