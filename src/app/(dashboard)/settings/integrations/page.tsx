"use client";

import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building2, Link2, ExternalLink, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function IntegrationsPage() {
  const { data: connections, isLoading } = trpc.propertyManager.getConnections.useQuery();
  const { mutate: getAuthUrl, isPending: isGettingUrl } = trpc.propertyManager.getAuthUrl.useMutation({
    onSuccess: (data) => {
      window.location.href = data.url;
    },
  });

  const propertyMeConnection = connections?.find((c) => c.provider === "propertyme");

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-2xl">
        <div>
          <h2 className="text-2xl font-bold">Integrations</h2>
          <p className="text-muted-foreground">
            Connect external services to automatically import data
          </p>
        </div>
        <div className="h-64 rounded-lg bg-muted animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold">Integrations</h2>
        <p className="text-muted-foreground">
          Connect external services to automatically import data
        </p>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Property Managers</h3>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">PropertyMe</CardTitle>
                  <CardDescription>
                    Import rent payments, maintenance, and bills
                  </CardDescription>
                </div>
              </div>
              {propertyMeConnection ? (
                <Badge
                  variant={
                    propertyMeConnection.status === "active"
                      ? "default"
                      : "destructive"
                  }
                >
                  {propertyMeConnection.status === "active"
                    ? "Connected"
                    : propertyMeConnection.status}
                </Badge>
              ) : (
                <Badge variant="secondary">Not connected</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {propertyMeConnection ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  {propertyMeConnection.lastSyncAt ? (
                    <span>
                      Last synced{" "}
                      {formatDistanceToNow(new Date(propertyMeConnection.lastSyncAt), {
                        addSuffix: true,
                      })}
                    </span>
                  ) : (
                    <span>Never synced</span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Link2 className="h-4 w-4" />
                  <span>{propertyMeConnection.mappingsCount} properties mapped</span>
                </div>
                <Button variant="outline" className="w-full" asChild>
                  <a href="/settings/integrations/propertyme">
                    Manage Connection
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              </div>
            ) : (
              <Button
                className="w-full"
                onClick={() => getAuthUrl({ provider: "propertyme" })}
                disabled={isGettingUrl}
              >
                <Link2 className="mr-2 h-4 w-4" />
                {isGettingUrl ? "Connecting..." : "Connect PropertyMe"}
              </Button>
            )}
          </CardContent>
        </Card>

        <Card className="opacity-60">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-muted rounded-lg">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <CardTitle className="text-base">:Different</CardTitle>
                  <CardDescription>
                    Virtual property management
                  </CardDescription>
                </div>
              </div>
              <Badge variant="outline">Coming Soon</Badge>
            </div>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}
