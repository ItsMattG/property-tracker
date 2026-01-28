"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, FileText, ShieldCheck } from "lucide-react";
import Link from "next/link";

interface ClientPortfolio {
  ownerId: string;
  ownerName: string;
  role: string;
}

export function AdvisorDashboard({
  portfolios,
}: {
  portfolios: ClientPortfolio[];
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Advisor Dashboard</h1>
        <p className="text-muted-foreground">
          You have read-only access to {portfolios.length} client{" "}
          {portfolios.length === 1 ? "portfolio" : "portfolios"}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {portfolios.map((portfolio) => (
          <Card key={portfolio.ownerId} className="hover:border-primary/50 transition-colors">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{portfolio.ownerName}</CardTitle>
                <Badge variant="secondary">{portfolio.role}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/dashboard?portfolio=${portfolio.ownerId}`}>
                    <Building2 className="w-4 h-4 mr-1" />
                    Properties
                  </Link>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/export?portfolio=${portfolio.ownerId}`}>
                    <FileText className="w-4 h-4 mr-1" />
                    Tax Reports
                  </Link>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/settings/audit-log?portfolio=${portfolio.ownerId}`}>
                    <ShieldCheck className="w-4 h-4 mr-1" />
                    Audit
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
