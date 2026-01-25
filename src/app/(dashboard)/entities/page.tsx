"use client";

import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus,
  Building2,
  Users,
  Landmark,
  Briefcase,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";

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

export default function EntitiesPage() {
  const { data: entities, isLoading } = trpc.entity.list.useQuery();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Entities</h1>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Entities</h1>
        <Link href="/entities/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Entity
          </Button>
        </Link>
      </div>

      {entities?.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No entities yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create your first entity to organize your properties.
            </p>
            <Link href="/entities/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Entity
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {entities?.map((entity) => {
            const Icon = entityTypeIcons[entity.type];

            return (
              <Link key={entity.id} href={`/entities/${entity.id}`}>
                <Card className="hover:border-primary transition-colors cursor-pointer">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Icon className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-base">
                          {entity.name}
                        </CardTitle>
                        <Badge variant="secondary" className="mt-1">
                          {entityTypeLabels[entity.type]}
                        </Badge>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    {entity.abn && (
                      <p className="text-sm text-muted-foreground">
                        ABN: {entity.abn}
                      </p>
                    )}
                    <p className="text-sm text-muted-foreground">
                      Role: {entity.role}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
