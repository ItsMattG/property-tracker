"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function BankingCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasProcessed = useRef(false);

  const processConnection = trpc.banking.processConnection.useMutation({
    onSuccess: (data) => {
      if (data.accountsAdded > 0) {
        toast.success(
          `Connected ${data.accountsAdded} account${data.accountsAdded !== 1 ? "s" : ""}. Assign properties to start importing.`
        );
        router.push(`/banking/assign?accounts=${data.newAccountIds.join(",")}`);
      } else {
        toast.info("No new accounts found");
        router.push("/banking");
      }
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
  }, [searchParams, processConnection]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
      <h2 className="text-lg font-semibold">Importing your accounts...</h2>
      <p className="text-sm text-muted-foreground">
        This may take a moment while we fetch your bank data.
      </p>
    </div>
  );
}
