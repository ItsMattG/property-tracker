"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { trpc } from "@/lib/trpc/client";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Mail,
  RefreshCw,
  Trash2,
  Clock,
  AlertCircle,
  CheckCircle,
  Plus,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

export default function EmailConnectionsPage() {
  const searchParams = useSearchParams();
  const success = searchParams?.get("success");
  const error = searchParams?.get("error");

  const utils = trpc.useUtils();
  const { data: connections, isLoading } = trpc.emailConnection.list.useQuery();
  const { data: senders } = trpc.emailSender.list.useQuery();

  const { mutate: syncNow, isPending: isSyncing } =
    trpc.emailConnection.syncNow.useMutation({
      onSuccess: (data) => {
        toast.success(`Synced ${data.synced} emails`);
        utils.emailConnection.list.invalidate();
      },
      onError: (error) => {
        toast.error(error.message);
      },
    });

  const { mutate: disconnect, isPending: isDisconnecting } =
    trpc.emailConnection.disconnect.useMutation({
      onSuccess: () => {
        toast.success("Email disconnected");
        utils.emailConnection.list.invalidate();
      },
      onError: (error) => {
        toast.error(error.message);
      },
    });

  const { mutate: deleteConnection, isPending: isDeleting } =
    trpc.emailConnection.delete.useMutation({
      onSuccess: () => {
        toast.success("Email connection removed");
        utils.emailConnection.list.invalidate();
      },
      onError: (error) => {
        toast.error(error.message);
      },
    });

  // Show toast for success/error from OAuth callback
  useEffect(() => {
    if (success === "gmail_connected") {
      toast.success("Gmail connected successfully!");
    } else if (error) {
      const errorMessages: Record<string, string> = {
        missing_params: "Missing OAuth parameters",
        invalid_state: "Invalid session state - please try again",
        oauth_failed: "OAuth authentication failed",
        access_denied: "Access was denied",
      };
      toast.error(errorMessages[error] || `Error: ${error}`);
    }
  }, [success, error]);

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-2xl">
        <div>
          <h2 className="text-2xl font-bold">Email Connections</h2>
          <p className="text-muted-foreground">
            Connect your email accounts to automatically import property-related
            emails
          </p>
        </div>
        <div className="h-64 rounded-lg bg-muted animate-pulse" />
      </div>
    );
  }

  const activeConnections = connections?.filter((c) => c.status === "active");
  const hasApprovedSenders = senders && senders.length > 0;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold">Email Connections</h2>
        <p className="text-muted-foreground">
          Connect your email accounts to automatically import property-related
          emails from approved senders
        </p>
      </div>

      {/* Warning if no approved senders */}
      {!hasApprovedSenders && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Add approved senders below before connecting an email account.
            Without approved senders, no emails will be imported.
          </AlertDescription>
        </Alert>
      )}

      {/* Connected Accounts */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Connected Accounts</h3>
          {activeConnections && activeConnections.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => syncNow()}
              disabled={isSyncing}
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${isSyncing ? "animate-spin" : ""}`}
              />
              {isSyncing ? "Syncing..." : "Sync Now"}
            </Button>
          )}
        </div>

        {connections && connections.length > 0 ? (
          <div className="space-y-3">
            {connections.map((connection) => (
              <Card key={connection.id}>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Mail className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{connection.emailAddress}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {connection.lastSyncAt ? (
                            <span>
                              Last synced{" "}
                              {formatDistanceToNow(
                                new Date(connection.lastSyncAt),
                                { addSuffix: true }
                              )}
                            </span>
                          ) : (
                            <span>Never synced</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          connection.status === "active"
                            ? "default"
                            : connection.status === "needs_reauth"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {connection.status === "active"
                          ? "Active"
                          : connection.status === "needs_reauth"
                            ? "Reconnect Required"
                            : "Disconnected"}
                      </Badge>
                      {connection.status === "needs_reauth" && (
                        <Button variant="outline" size="sm" asChild>
                          <a href="/api/auth/gmail">Reconnect</a>
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteConnection({ id: connection.id })}
                        disabled={isDeleting}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  {connection.lastError && (
                    <p className="mt-2 text-sm text-destructive">
                      {connection.lastError}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-8 text-center">
              <Mail className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                No email accounts connected
              </p>
            </CardContent>
          </Card>
        )}

        {/* Add Gmail Button */}
        <Button className="w-full" asChild disabled={!hasApprovedSenders}>
          <a href="/api/auth/gmail">
            <Plus className="mr-2 h-4 w-4" />
            Connect Gmail Account
          </a>
        </Button>

        {/* Outlook Coming Soon */}
        <Button variant="outline" className="w-full" disabled>
          <Plus className="mr-2 h-4 w-4" />
          Connect Outlook (Coming Soon)
        </Button>
      </div>

      {/* Approved Senders Section */}
      <div className="space-y-4 pt-6 border-t">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Approved Senders</h3>
            <p className="text-sm text-muted-foreground">
              Only emails from these addresses or domains will be imported
            </p>
          </div>
          <Button variant="outline" size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Add Sender
          </Button>
        </div>

        {senders && senders.length > 0 ? (
          <div className="space-y-2">
            {senders.map((sender) => (
              <Card key={sender.id}>
                <CardContent className="py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-mono text-sm">
                        {sender.emailPattern}
                      </p>
                      {sender.label && (
                        <p className="text-sm text-muted-foreground">
                          {sender.label}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {sender.defaultPropertyId && (
                        <Badge variant="outline">Has default property</Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-6 text-center">
              <p className="text-muted-foreground">
                No approved senders configured. Add senders like{" "}
                <code className="text-xs bg-muted px-1 rounded">
                  *@raywhite.com
                </code>{" "}
                or{" "}
                <code className="text-xs bg-muted px-1 rounded">
                  agent@realestate.com.au
                </code>
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
