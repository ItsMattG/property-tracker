"use client";

import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Building2,
  RefreshCw,
  Unlink,
  Clock,
  CheckCircle,
  XCircle,
  ArrowLeft,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import Link from "next/link";
import { toast } from "sonner";

export default function PropertyMeIntegrationPage() {
  const utils = trpc.useUtils();

  const { data: connections } = trpc.propertyManager.getConnections.useQuery();
  const connection = connections?.find((c) => c.provider === "propertyme");

  const { data: connectionDetails, isLoading } =
    trpc.propertyManager.getConnection.useQuery(
      { connectionId: connection?.id ?? "" },
      { enabled: !!connection?.id }
    );

  const { data: properties } = trpc.property.list.useQuery();

  const fetchPropertiesMutation =
    trpc.propertyManager.fetchProviderProperties.useMutation({
      onSuccess: (data) => {
        toast.success(`Found ${data.count} properties`);
        utils.propertyManager.getConnection.invalidate();
      },
      onError: (error) => {
        toast.error(error.message);
      },
    });

  const updateMappingMutation = trpc.propertyManager.updateMapping.useMutation({
    onSuccess: () => {
      utils.propertyManager.getConnection.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const syncMutation = trpc.propertyManager.sync.useMutation({
    onSuccess: (data) => {
      toast.success(
        `Sync complete: ${data.transactionsCreated} transactions created`
      );
      utils.propertyManager.getConnection.invalidate();
      utils.propertyManager.getConnections.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const disconnectMutation = trpc.propertyManager.disconnect.useMutation({
    onSuccess: () => {
      toast.success("Disconnected from PropertyMe");
      utils.propertyManager.getConnections.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  if (!connection) {
    return (
      <div className="space-y-6 max-w-2xl">
        <Link
          href="/settings/integrations"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Integrations
        </Link>
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              No PropertyMe connection found.{" "}
              <Link href="/settings/integrations" className="text-primary hover:underline">
                Connect now
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading || !connectionDetails) {
    return (
      <div className="space-y-6 max-w-2xl">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="h-64 bg-muted animate-pulse rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <Link
        href="/settings/integrations"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Integrations
      </Link>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">PropertyMe</h2>
            <p className="text-muted-foreground">Manage your connection</p>
          </div>
        </div>
        <Badge
          variant={connection.status === "active" ? "default" : "destructive"}
        >
          {connection.status}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Connection Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>Last synced</span>
            </div>
            <span className="text-sm">
              {connectionDetails.lastSyncAt
                ? formatDistanceToNow(new Date(connectionDetails.lastSyncAt), {
                    addSuffix: true,
                  })
                : "Never"}
            </span>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={() => syncMutation.mutate({ connectionId: connection.id })}
              disabled={syncMutation.isPending}
              className="flex-1"
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${syncMutation.isPending ? "animate-spin" : ""}`}
              />
              {syncMutation.isPending ? "Syncing..." : "Sync Now"}
            </Button>
            <Button
              variant="destructive"
              onClick={() => disconnectMutation.mutate({ connectionId: connection.id })}
              disabled={disconnectMutation.isPending}
            >
              <Unlink className="mr-2 h-4 w-4" />
              Disconnect
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Property Mappings</CardTitle>
              <CardDescription>
                Link PropertyMe properties to your PropertyTracker properties
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                fetchPropertiesMutation.mutate({ connectionId: connection.id })
              }
              disabled={fetchPropertiesMutation.isPending}
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${
                  fetchPropertiesMutation.isPending ? "animate-spin" : ""
                }`}
              />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {connectionDetails.mappings.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              No properties found. Click Refresh to fetch properties from PropertyMe.
            </p>
          ) : (
            <div className="space-y-4">
              {connectionDetails.mappings.map((mapping) => (
                <div
                  key={mapping.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex-1">
                    <p className="font-medium">{mapping.providerPropertyAddress}</p>
                    <p className="text-sm text-muted-foreground">
                      PropertyMe ID: {mapping.providerPropertyId}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <Select
                      value={mapping.propertyId || "unmapped"}
                      onValueChange={(value) =>
                        updateMappingMutation.mutate({
                          mappingId: mapping.id,
                          propertyId: value === "unmapped" ? null : value,
                        })
                      }
                    >
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Select property" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unmapped">Not mapped</SelectItem>
                        {properties?.map((prop) => (
                          <SelectItem key={prop.id} value={prop.id}>
                            {prop.address}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex items-center gap-2">
                      <Switch
                        id={`autosync-${mapping.id}`}
                        checked={mapping.autoSync}
                        onCheckedChange={(checked) =>
                          updateMappingMutation.mutate({
                            mappingId: mapping.id,
                            propertyId: mapping.propertyId,
                            autoSync: checked,
                          })
                        }
                      />
                      <Label htmlFor={`autosync-${mapping.id}`} className="text-sm">
                        Auto-sync
                      </Label>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sync History</CardTitle>
        </CardHeader>
        <CardContent>
          {connectionDetails.syncLogs.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              No sync history yet
            </p>
          ) : (
            <div className="space-y-2">
              {connectionDetails.syncLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between p-2 border rounded"
                >
                  <div className="flex items-center gap-2">
                    {log.status === "completed" ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : log.status === "failed" ? (
                      <XCircle className="h-4 w-4 text-red-500" />
                    ) : (
                      <RefreshCw className="h-4 w-4 text-yellow-500 animate-spin" />
                    )}
                    <span className="text-sm capitalize">{log.syncType} sync</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {log.transactionsCreated} transactions •{" "}
                    {format(new Date(log.startedAt), "MMM d, h:mm a")}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
