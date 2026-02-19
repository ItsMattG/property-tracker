"use client";

import { useState, useCallback, useRef } from "react";
import { Upload, Camera, Loader2, FileCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { ExtractionReviewCard } from "./ExtractionReviewCard";

const ACCEPTED_TYPES = "image/jpeg,image/png,image/heic,application/pdf";
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

type ScanState = "idle" | "uploading" | "processing" | "review" | "done";

interface ReceiptScannerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Optional property ID to associate the receipt with */
  propertyId?: string;
}

export function ReceiptScanner({ open, onOpenChange, propertyId }: ReceiptScannerProps) {
  const [scanState, setScanState] = useState<ScanState>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [extractionId, setExtractionId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();

  const { data: scanQuota } = trpc.documentExtraction.getRemainingScans.useQuery(
    undefined,
    { enabled: open }
  );

  const getUploadUrl = trpc.documents.getUploadUrl.useMutation();
  const createDocument = trpc.documents.create.useMutation();

  const confirmMutation = trpc.documentExtraction.confirmTransaction.useMutation({
    onSuccess: () => {
      toast.success("Transaction created from receipt");
      utils.documentExtraction.listPendingReviews.invalidate();
      utils.documentExtraction.getRemainingScans.invalidate();
      utils.transaction.list.invalidate();
      setScanState("done");
      setTimeout(() => {
        onOpenChange(false);
        resetState();
      }, 1500);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const discardMutation = trpc.documentExtraction.discardExtraction.useMutation({
    onSuccess: () => {
      toast.success("Receipt discarded");
      utils.documentExtraction.listPendingReviews.invalidate();
      onOpenChange(false);
      resetState();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const resetState = useCallback(() => {
    setScanState("idle");
    setUploadProgress(0);
    setExtractionId(null);
  }, []);

  const pollExtraction = useCallback(async (documentId: string) => {
    const maxAttempts = 30; // 30 seconds max
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, 1000));

      const extraction = await utils.documentExtraction.getExtraction.fetch({ documentId });

      if (extraction?.status === "completed") {
        setExtractionId(extraction.id);
        setScanState("review");
        utils.documentExtraction.getRemainingScans.invalidate();
        return;
      }

      if (extraction?.status === "failed") {
        toast.error("Extraction failed. The receipt may be unreadable.");
        resetState();
        return;
      }
    }

    toast.error("Extraction timed out. Check the Review page later.");
    resetState();
  }, [utils, resetState]);

  const handleFileSelect = useCallback(async (file: File) => {
    if (file.size > MAX_FILE_SIZE) {
      toast.error("File must be under 10MB");
      return;
    }

    try {
      // Upload phase
      setScanState("uploading");
      setUploadProgress(20);

      const { signedUrl, storagePath } = await getUploadUrl.mutateAsync({
        fileName: file.name,
        fileType: file.type as "image/jpeg" | "image/png" | "image/heic" | "application/pdf",
        fileSize: file.size,
        propertyId,
      });

      setUploadProgress(40);

      // Upload to Supabase
      await fetch(signedUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      setUploadProgress(60);

      // Create document record (auto-triggers extraction)
      const document = await createDocument.mutateAsync({
        storagePath,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        propertyId,
        category: "receipt",
      });

      setUploadProgress(80);

      // Poll for extraction completion
      setScanState("processing");
      setUploadProgress(100);

      // Poll extraction status
      await pollExtraction(document.id);
    } catch (error) {
      toast.error(getErrorMessage(error));
      resetState();
    }
  }, [getUploadUrl, createDocument, propertyId, resetState, pollExtraction]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const { data: pendingReviews } = trpc.documentExtraction.listPendingReviews.useQuery(
    undefined,
    { enabled: scanState === "review" && !!extractionId }
  );

  const currentExtraction = pendingReviews?.find((e) => e.id === extractionId);

  const isAtLimit = scanQuota?.remaining === 0;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetState(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Scan Receipt</DialogTitle>
          <DialogDescription>
            Upload or photograph a receipt to automatically extract transaction details.
          </DialogDescription>
        </DialogHeader>

        {scanState === "idle" && (
          <div className="space-y-4">
            {/* Scan quota indicator */}
            {scanQuota && scanQuota.limit !== null && (
              <div className="text-sm text-muted-foreground text-center">
                {scanQuota.remaining} scans remaining this month ({scanQuota.used}/{scanQuota.limit})
              </div>
            )}

            {isAtLimit ? (
              <div className="text-center py-8 space-y-3">
                <p className="text-sm text-muted-foreground">
                  You&apos;ve used all {scanQuota?.limit} free scans this month.
                </p>
                <Button asChild>
                  <a href="/settings/billing">Upgrade to Pro for unlimited scans</a>
                </Button>
              </div>
            ) : (
              <>
                {/* Drop zone */}
                <div
                  onDrop={handleDrop}
                  onDragOver={(e) => e.preventDefault()}
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
                    "hover:border-primary hover:bg-primary/5"
                  )}
                >
                  <Upload className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-sm font-medium">
                    Drop a receipt here or click to browse
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    JPEG, PNG, HEIC, or PDF up to 10MB
                  </p>
                </div>

                {/* Hidden file input with camera capture */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_TYPES}
                  capture="environment"
                  onChange={handleInputChange}
                  className="hidden"
                />

                {/* Mobile camera button */}
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Camera className="w-4 h-4 mr-2" />
                  Take Photo
                </Button>
              </>
            )}
          </div>
        )}

        {(scanState === "uploading" || scanState === "processing") && (
          <div className="py-8 space-y-4 text-center">
            <Loader2 className="w-8 h-8 mx-auto animate-spin text-primary" />
            <p className="text-sm font-medium">
              {scanState === "uploading" ? "Uploading receipt..." : "Extracting details..."}
            </p>
            <Progress value={uploadProgress} className="max-w-xs mx-auto" />
          </div>
        )}

        {scanState === "review" && currentExtraction && (
          <ExtractionReviewCard
            extraction={currentExtraction}
            onConfirm={(updates) =>
              confirmMutation.mutate({ extractionId: currentExtraction.id, ...updates })
            }
            onDiscard={() =>
              discardMutation.mutate({ extractionId: currentExtraction.id })
            }
          />
        )}

        {scanState === "done" && (
          <div className="py-8 text-center space-y-2">
            <FileCheck className="w-8 h-8 mx-auto text-success" />
            <p className="text-sm font-medium">Transaction created!</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
