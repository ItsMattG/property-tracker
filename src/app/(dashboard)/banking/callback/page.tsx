"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function BankingCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasProcessed = useRef(false);
  const [statusText, setStatusText] = useState("Importing your accounts...");

  const linkMutation = trpc.banking.linkAccountToProperty.useMutation();
  const syncMutation = trpc.banking.syncAccount.useMutation();

  const processConnection = trpc.banking.processConnection.useMutation({
    onSuccess: async (data) => {
      if (data.accountsAdded === 0) {
        toast.info("No new accounts found");
        router.push("/banking");
        return;
      }

      const pendingPropertyId = data.pendingPropertyId;

      if (!pendingPropertyId) {
        // No property pre-selected — fall back to assign page
        toast.success(
          `Connected ${data.accountsAdded} account${data.accountsAdded !== 1 ? "s" : ""}. Assign properties to start importing.`
        );
        router.push(`/banking/assign?accounts=${data.newAccountIds.join(",")}`);
        return;
      }

      // Auto-assign property to all new accounts
      setStatusText("Linking accounts to your property...");
      try {
        for (const accountId of data.newAccountIds) {
          await linkMutation.mutateAsync({
            accountId,
            propertyId: pendingPropertyId,
          });
        }
      } catch {
        // Property may have been deleted — fall back to assign page
        toast.error("Could not link to selected property. Please assign manually.");
        router.push(`/banking/assign?accounts=${data.newAccountIds.join(",")}`);
        return;
      }

      // Auto-sync all new accounts
      setStatusText("Importing transactions...");
      let totalTransactions = 0;
      for (const accountId of data.newAccountIds) {
        try {
          const result = await syncMutation.mutateAsync({ accountId });
          totalTransactions += result.transactionsAdded;
        } catch {
          // Non-fatal — account is linked, sync can be retried from banking page
        }
      }

      toast.success(
        `Connected ${data.accountsAdded} account${data.accountsAdded !== 1 ? "s" : ""} and imported ${totalTransactions} transaction${totalTransactions !== 1 ? "s" : ""}.`
      );
      router.push("/banking");
    },
    onError: (error) => {
      toast.error(`Connection failed: ${error.message}`);
      router.push("/banking/connect");
    },
  });

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const jobIds = searchParams?.get("jobIds")?.split(",").filter(Boolean);
    processConnection.mutate({ jobIds: jobIds ?? undefined });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
      <h2 className="text-lg font-semibold">{statusText}</h2>
      <p className="text-sm text-muted-foreground">
        This may take a moment while we fetch your bank data.
      </p>
    </div>
  );
}
