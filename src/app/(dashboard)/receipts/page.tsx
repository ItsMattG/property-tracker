"use client";

import { useState } from "react";
import { Camera, FileText, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";
import { ReceiptScanner } from "@/components/documents/ReceiptScanner";
import { ExtractionReviewCard } from "@/components/documents/ExtractionReviewCard";
import { formatDate } from "@/lib/utils";

export default function ReceiptsPage() {
  const [showScanner, setShowScanner] = useState(false);

  const utils = trpc.useUtils();

  const { data: pendingReviews, isLoading: loadingPending } =
    trpc.documentExtraction.listPendingReviews.useQuery();

  const { data: scanQuota } =
    trpc.documentExtraction.getRemainingScans.useQuery();

  const { data: receiptDocs, isLoading: loadingHistory } =
    trpc.documents.list.useQuery({ category: "receipt" });

  const confirmMutation = trpc.documentExtraction.confirmTransaction.useMutation({
    onSuccess: () => {
      toast.success("Transaction created");
      utils.documentExtraction.listPendingReviews.invalidate();
      utils.documentExtraction.getRemainingScans.invalidate();
      utils.transaction.list.invalidate();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const discardMutation = trpc.documentExtraction.discardExtraction.useMutation({
    onSuccess: () => {
      toast.success("Receipt discarded");
      utils.documentExtraction.listPendingReviews.invalidate();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Receipts</h2>
          <p className="text-muted-foreground">
            Scan receipts to automatically create transactions
          </p>
        </div>
        <div className="flex items-center gap-3">
          {scanQuota && scanQuota.limit !== null && (
            <span className="text-sm text-muted-foreground">
              {scanQuota.remaining}/{scanQuota.limit} scans left
            </span>
          )}
          <Button onClick={() => setShowScanner(true)}>
            <Camera className="w-4 h-4 mr-2" />
            Scan Receipt
          </Button>
        </div>
      </div>

      {/* Pending reviews */}
      {pendingReviews && pendingReviews.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Pending Review ({pendingReviews.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {pendingReviews.map((extraction) => (
              <ExtractionReviewCard
                key={extraction.id}
                extraction={extraction}
                onConfirm={(updates) =>
                  confirmMutation.mutate({ extractionId: extraction.id, ...updates })
                }
                onDiscard={() =>
                  discardMutation.mutate({ extractionId: extraction.id })
                }
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* History table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Receipt History</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingHistory || loadingPending ? (
            <div className="h-32 bg-muted animate-pulse rounded-lg" />
          ) : receiptDocs && receiptDocs.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receiptDocs.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                      {doc.fileName}
                    </TableCell>
                    <TableCell>{formatDate(doc.createdAt)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">Scanned</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Camera className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold">No receipts scanned yet</h3>
              <p className="text-muted-foreground max-w-sm mt-2">
                Scan a receipt to automatically extract transaction details.
              </p>
              <Button className="mt-4" onClick={() => setShowScanner(true)}>
                Scan your first receipt
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <ReceiptScanner open={showScanner} onOpenChange={setShowScanner} />
    </div>
  );
}
