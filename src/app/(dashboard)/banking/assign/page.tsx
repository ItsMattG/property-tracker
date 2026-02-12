"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PropertySelect } from "@/components/properties/PropertySelect";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";
import { Landmark, ArrowRight, Loader2 } from "lucide-react";

export default function AssignAccountsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const accountIds = searchParams?.get("accounts")?.split(",").filter(Boolean) ?? [];

  const { data: accounts, isLoading: accountsLoading } = trpc.banking.listAccounts.useQuery();
  const { data: properties, isLoading: propertiesLoading } = trpc.property.list.useQuery();

  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [isSyncing, setIsSyncing] = useState(false);

  const linkMutation = trpc.banking.linkAccountToProperty.useMutation();
  const syncMutation = trpc.banking.syncAccount.useMutation();

  const newAccounts = accounts?.filter((a) => accountIds.includes(a.id)) ?? [];
  const isLoading = accountsLoading || propertiesLoading;

  const handleContinue = async () => {
    if (!properties?.length) {
      toast.error("Please create a property first");
      router.push("/properties/new");
      return;
    }

    setIsSyncing(true);

    try {
      // Assign properties to accounts
      for (const account of newAccounts) {
        const propertyId = assignments[account.id];
        if (propertyId) {
          await linkMutation.mutateAsync({
            accountId: account.id,
            propertyId,
          });
        }
      }

      // Trigger initial sync for each new account
      let totalTransactions = 0;
      for (const account of newAccounts) {
        try {
          const result = await syncMutation.mutateAsync({
            accountId: account.id,
          });
          totalTransactions += result.transactionsAdded;
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown error";
          toast.error(`Failed to sync ${account.accountName}: ${message}`);
        }
      }

      toast.success(`Imported ${totalTransactions} transactions`);
      router.push("/banking");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast.error(`Failed to assign properties: ${message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Loading accounts...</p>
      </div>
    );
  }

  if (newAccounts.length === 0) {
    router.push("/banking");
    return null;
  }

  const allAssigned = newAccounts.every((a) => assignments[a.id]);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Assign Properties</h1>
        <p className="text-muted-foreground">
          Link each bank account to a property before importing transactions.
        </p>
      </div>

      <div className="space-y-4">
        {newAccounts.map((account) => (
          <Card key={account.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Landmark className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">
                    {account.accountName}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {account.institution}
                    {account.accountNumberMasked && ` - ${account.accountNumberMasked}`}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <PropertySelect
                value={assignments[account.id] ?? ""}
                onValueChange={(value) =>
                  setAssignments((prev) => ({ ...prev, [account.id]: value }))
                }
                placeholder="Select a property"
                triggerClassName="w-full"
              />
            </CardContent>
          </Card>
        ))}
      </div>

      <Button
        onClick={handleContinue}
        className="w-full"
        size="lg"
        disabled={!allAssigned || isSyncing}
      >
        {isSyncing ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Importing transactions...
          </>
        ) : (
          <>
            Import Transactions
            <ArrowRight className="w-4 h-4 ml-2" />
          </>
        )}
      </Button>

      {!allAssigned && (
        <p className="text-sm text-center text-muted-foreground">
          Assign a property to each account to continue
        </p>
      )}
    </div>
  );
}
