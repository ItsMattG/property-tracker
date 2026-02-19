"use client";

import { FileText } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { BatchUploadZone } from "@/components/documents/BatchUploadZone";
import { PendingReviews } from "@/components/documents/PendingReviews";
import { DocumentHistory } from "@/components/documents/DocumentHistory";

export function DocumentsPageContent() {
  const utils = trpc.useUtils();
  const { data: scanQuota } =
    trpc.documentExtraction.getRemainingScans.useQuery();

  const handleBatchComplete = () => {
    utils.documentExtraction.listPendingReviews.invalidate();
    utils.documents.list.invalidate();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <FileText className="h-6 w-6" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Documents</h1>
          <p className="text-sm text-muted-foreground">
            Upload receipts and documents to automatically extract transaction
            details
          </p>
        </div>
      </div>

      <BatchUploadZone
        remainingScans={scanQuota?.remaining ?? null}
        onBatchComplete={handleBatchComplete}
      />

      <PendingReviews />

      <DocumentHistory />
    </div>
  );
}
