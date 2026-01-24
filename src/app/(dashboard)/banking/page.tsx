"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc/client";
import { Landmark, Plus, AlertTriangle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ConnectionAlertBanner } from "@/components/banking/ConnectionAlertBanner";
import { SyncButton } from "@/components/banking/SyncButton";
import { AccountStatusIndicator } from "@/components/banking/AccountStatusIndicator";
import { toast } from "sonner";

export default function BankingPage() {
  const utils = trpc.useUtils();
  const { data: accounts, isLoading } = trpc.banking.listAccounts.useQuery();
  const { data: alerts } = trpc.banking.listAlerts.useQuery();

  const syncAccount = trpc.banking.syncAccount.useMutation({
    onSuccess: (data) => {
      toast.success(`Synced ${data.transactionsAdded} new transactions`);
      utils.banking.listAccounts.invalidate();
      utils.banking.listAlerts.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const dismissAlert = trpc.banking.dismissAlert.useMutation({
    onSuccess: () => {
      utils.banking.listAlerts.invalidate();
    },
  });

  const reconnect = trpc.banking.reconnect.useMutation({
    onSuccess: (data) => {
      window.location.href = data.url;
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleDismissAllAlerts = async () => {
    if (!alerts) return;
    for (const alert of alerts) {
      await dismissAlert.mutateAsync({ alertId: alert.id });
    }
  };

  const hasAuthError = alerts?.some((a) => a.alertType === "requires_reauth") ?? false;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Banking</h2>
            <p className="text-muted-foreground">
              Manage your connected bank accounts
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2].map((i) => (
            <div key={i} className="h-48 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {alerts && alerts.length > 0 && (
        <ConnectionAlertBanner
          alertCount={alerts.length}
          hasAuthError={hasAuthError}
          onDismiss={handleDismissAllAlerts}
        />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Banking</h2>
          <p className="text-muted-foreground">
            Manage your connected bank accounts
          </p>
        </div>
        <Button asChild>
          <Link href="/banking/connect">
            <Plus className="w-4 h-4 mr-2" />
            Connect Bank
          </Link>
        </Button>
      </div>

      {accounts && accounts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {accounts.map((account) => {
            const accountAlerts = alerts?.filter(
              (a) => a.bankAccountId === account.id
            );
            const needsReauth = accountAlerts?.some(
              (a) => a.alertType === "requires_reauth"
            );

            return (
              <Card key={account.id}>
                <CardHeader className="flex flex-row items-start justify-between pb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Landmark className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base">
                          {account.accountName}
                        </CardTitle>
                        <AccountStatusIndicator
                          status={account.connectionStatus as "connected" | "disconnected" | "error"}
                        />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {account.institution}
                      </p>
                    </div>
                  </div>
                  {accountAlerts && accountAlerts.length > 0 && (
                    <Badge variant="destructive" className="gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      {accountAlerts.length}
                    </Badge>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Account</span>
                      <span>{account.accountNumberMasked || "****"}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Type</span>
                      <Badge variant="outline">{account.accountType}</Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Last synced</span>
                      <span>
                        {account.lastSyncedAt
                          ? formatDistanceToNow(new Date(account.lastSyncedAt), {
                              addSuffix: true,
                            })
                          : "Never"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        Default property
                      </span>
                      <span>{account.defaultProperty?.suburb || "None"}</span>
                    </div>

                    <div className="flex gap-2 pt-2">
                      {needsReauth ? (
                        <Button
                          variant="destructive"
                          size="sm"
                          className="flex-1"
                          onClick={() =>
                            reconnect.mutate({ accountId: account.id })
                          }
                        >
                          Reconnect
                        </Button>
                      ) : (
                        <SyncButton
                          onSync={() =>
                            syncAccount.mutateAsync({ accountId: account.id })
                          }
                          lastManualSyncAt={account.lastManualSyncAt}
                          className="flex-1"
                        />
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Landmark className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold">No bank accounts connected</h3>
          <p className="text-muted-foreground max-w-sm mt-2">
            Connect your bank account to automatically import transactions for
            your investment properties.
          </p>
          <Button asChild className="mt-4">
            <Link href="/banking/connect">
              <Plus className="w-4 h-4 mr-2" />
              Connect Your Bank
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
