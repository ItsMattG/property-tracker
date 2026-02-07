"use client";

import { useParams } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Building2,
  Users,
  Landmark,
  Briefcase,
  Shield,
  UserPlus,
} from "lucide-react";
import Link from "next/link";
import { EntityTasksSection } from "@/components/tasks/EntityTasksSection";

const entityTypeIcons = {
  personal: Building2,
  trust: Users,
  smsf: Landmark,
  company: Briefcase,
};

const entityTypeLabels = {
  personal: "Personal",
  trust: "Trust",
  smsf: "SMSF",
  company: "Company",
};

export default function EntityDetailPage() {
  const params = useParams();
  const entityId = params?.id as string;

  const { data: entity, isLoading } = trpc.entity.get.useQuery({ entityId });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (!entity) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Entity not found
        </CardContent>
      </Card>
    );
  }

  const Icon = entityTypeIcons[entity.type];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{entity.name}</h1>
          <Badge variant="secondary">{entityTypeLabels[entity.type]}</Badge>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {entity.abn && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">ABN</span>
                <span>{entity.abn}</span>
              </div>
            )}
            {entity.trustDetails && (
              <>
                {entity.trustDetails.trusteeType && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Trustee Type</span>
                    <span className="capitalize">{entity.trustDetails.trusteeType}</span>
                  </div>
                )}
                {entity.trustDetails.trusteeName && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Trustee</span>
                    <span>{entity.trustDetails.trusteeName}</span>
                  </div>
                )}
              </>
            )}
            {entity.smsfDetails && (
              <>
                {entity.smsfDetails.fundName && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Fund Name</span>
                    <span>{entity.smsfDetails.fundName}</span>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {entity.type === "smsf" && (
              <Link href={`/entities/${entityId}/members`} className="block">
                <Button variant="outline" className="w-full justify-start">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Manage Members
                </Button>
              </Link>
            )}
            <Link href={`/entities/${entityId}/compliance`} className="block">
              <Button variant="outline" className="w-full justify-start">
                <Shield className="h-4 w-4 mr-2" />
                Compliance
              </Button>
            </Link>
            {(entity.type === "trust" || entity.type === "smsf") && (
              <Link href={`/entities/${entityId}/beneficiaries`} className="block">
                <Button variant="outline" className="w-full justify-start">
                  <Users className="h-4 w-4 mr-2" />
                  Beneficiaries
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      </div>

      <EntityTasksSection entityId={entityId} />
    </div>
  );
}
