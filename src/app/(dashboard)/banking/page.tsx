"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc/client";
import { Landmark, Plus, RefreshCw, Building2 } from "lucide-react";
import { format } from "date-fns";

export default function BankingPage() {
  const { data: accounts, isLoading, refetch } = trpc.banking.listAccounts.useQuery();
  const { data: properties } = trpc.property.list.useQuery();
  const linkToProperty = trpc.banking.linkAccountToProperty.useMutation({
    onSuccess: () => refetch(),
  });

  const handleLinkProperty = async (accountId: string, propertyId: string | null) => {
    await linkToProperty.mutateAsync({ accountId, propertyId });
  };

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
          {accounts.map((account) => (
            <Card key={account.id}>
              <CardHeader className="flex flex-row items-start justify-between pb-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Landmark className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{account.accountName}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {account.institution}
                    </p>
                  </div>
                </div>
                <Badge variant={account.isConnected ? "default" : "secondary"}>
                  {account.isConnected ? "Connected" : "Disconnected"}
                </Badge>
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
                        ? format(new Date(account.lastSyncedAt), "dd MMM yyyy HH:mm")
                        : "Never"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Default property</span>
                    <span>
                      {account.defaultProperty?.suburb || "None"}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
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
