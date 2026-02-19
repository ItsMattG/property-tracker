"use client";

import { useCallback, useState, useRef } from "react";
import { useDropzone } from "react-dropzone";
import {
  Upload,
  FileText,
  Image,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase/client";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";

const ALLOWED_TYPES = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/heic": [".heic"],
  "application/pdf": [".pdf"],
};
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES = 10;
const MAX_CONCURRENT = 3;

type FileStatus =
  | "queued"
  | "uploading"
  | "extracting"
  | "done"
  | "failed"
  | "quota_exceeded";

interface TrackedFile {
  id: string;
  file: File;
  status: FileStatus;
  progress: number;
  documentId: string | null;
  error: string | null;
  extractedPreview: { amount: number | null; category: string | null } | null;
}

interface BatchUploadZoneProps {
  remainingScans: number | null; // null = unlimited
  onBatchComplete?: () => void;
}

export function BatchUploadZone({
  remainingScans,
  onBatchComplete,
}: BatchUploadZoneProps) {
  const [files, setFiles] = useState<TrackedFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const activeUploads = useRef(0);

  const utils = trpc.useUtils();
  const getUploadUrl = trpc.documents.getUploadUrl.useMutation();
  const createDocument = trpc.documents.create.useMutation();

  const updateFile = useCallback(
    (id: string, updates: Partial<TrackedFile>) => {
      setFiles((prev) =>
        prev.map((f) => (f.id === id ? { ...f, ...updates } : f))
      );
    },
    []
  );

  const processFile = useCallback(
    async (tracked: TrackedFile, scanIndex: number) => {
      if (remainingScans !== null && scanIndex >= remainingScans) {
        updateFile(tracked.id, {
          status: "quota_exceeded",
          error: "Scan quota exceeded",
        });
        return;
      }

      updateFile(tracked.id, { status: "uploading", progress: 20 });

      try {
        const { signedUrl, storagePath, token } =
          await getUploadUrl.mutateAsync({
            fileName: tracked.file.name,
            fileType: tracked.file.type as
              | "image/jpeg"
              | "image/png"
              | "image/heic"
              | "application/pdf",
            fileSize: tracked.file.size,
          });

        updateFile(tracked.id, { progress: 50 });

        const { error: uploadError } = await supabase.storage
          .from("documents")
          .uploadToSignedUrl(storagePath, token, tracked.file);

        if (uploadError) throw new Error(uploadError.message);

        updateFile(tracked.id, { progress: 70 });

        const document = await createDocument.mutateAsync({
          storagePath,
          fileName: tracked.file.name,
          fileType: tracked.file.type,
          fileSize: tracked.file.size,
          category: "receipt",
        });

        updateFile(tracked.id, {
          status: "extracting",
          progress: 80,
          documentId: document.id,
        });

        // Poll for extraction completion
        const maxAttempts = 30;
        for (let i = 0; i < maxAttempts; i++) {
          await new Promise((r) => setTimeout(r, 1000));
          const extraction =
            await utils.documentExtraction.getExtraction.fetch({
              documentId: document.id,
            });

          if (extraction?.status === "completed") {
            updateFile(tracked.id, {
              status: "done",
              progress: 100,
              extractedPreview: {
                amount: extraction.extractedData?.amount ?? null,
                category: extraction.extractedData?.category ?? null,
              },
            });
            return;
          }

          if (extraction?.status === "failed") {
            updateFile(tracked.id, {
              status: "failed",
              error: "Extraction failed",
              progress: 100,
            });
            return;
          }
        }

        updateFile(tracked.id, {
          status: "failed",
          error: "Extraction timed out",
          progress: 100,
        });
      } catch (error) {
        updateFile(tracked.id, {
          status: "failed",
          error: getErrorMessage(error),
          progress: 100,
        });
      }
    },
    [getUploadUrl, createDocument, utils, updateFile, remainingScans]
  );

  const processBatch = useCallback(
    async (trackedFiles: TrackedFile[]) => {
      setIsProcessing(true);
      const queue = [...trackedFiles];
      let scanIndex = 0;

      const processNext = async (): Promise<void> => {
        const next = queue.shift();
        if (!next) return;

        activeUploads.current++;
        await processFile(next, scanIndex++);
        activeUploads.current--;

        await processNext();
      };

      const workers = Array.from(
        { length: Math.min(MAX_CONCURRENT, queue.length) },
        () => processNext()
      );
      await Promise.all(workers);

      setIsProcessing(false);
      utils.documentExtraction.listPendingReviews.invalidate();
      utils.documentExtraction.getRemainingScans.invalidate();
      onBatchComplete?.();
    },
    [processFile, utils, onBatchComplete]
  );

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;

      const trackedFiles: TrackedFile[] = acceptedFiles
        .slice(0, MAX_FILES)
        .map((file, i) => ({
          id: `${Date.now()}-${i}`,
          file,
          status: "queued" as const,
          progress: 0,
          documentId: null,
          error: null,
          extractedPreview: null,
        }));

      setFiles(trackedFiles);
      processBatch(trackedFiles);
    },
    [processBatch]
  );

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ALLOWED_TYPES,
    maxSize: MAX_FILE_SIZE,
    maxFiles: MAX_FILES,
    disabled: isProcessing,
    onDropRejected: (rejections) => {
      const errors = rejections.map(
        (r) => `${r.file.name}: ${r.errors[0].message}`
      );
      toast.error(errors.join("\n"));
    },
  });

  const getStatusIcon = (status: FileStatus) => {
    switch (status) {
      case "queued":
        return <FileText className="h-4 w-4 text-muted-foreground" />;
      case "uploading":
        return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
      case "extracting":
        return <Loader2 className="h-4 w-4 animate-spin text-amber-500" />;
      case "done":
        return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
      case "failed":
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      case "quota_exceeded":
        return <AlertCircle className="h-4 w-4 text-amber-500" />;
    }
  };

  const getStatusLabel = (status: FileStatus) => {
    switch (status) {
      case "queued":
        return "Queued";
      case "uploading":
        return "Uploading...";
      case "extracting":
        return "Extracting...";
      case "done":
        return "Ready for review";
      case "failed":
        return "Failed";
      case "quota_exceeded":
        return "Upgrade to scan";
    }
  };

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
          isDragActive && "border-primary bg-primary/5",
          isProcessing && "opacity-50 cursor-not-allowed",
          !isDragActive &&
            !isProcessing &&
            "border-muted-foreground/25 hover:border-primary/50"
        )}
      >
        <input {...getInputProps()} />
        <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
        <p className="text-sm font-medium">
          {isDragActive
            ? "Drop files here"
            : "Drag & drop up to 10 files, or click to browse"}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          JPG, PNG, HEIC, or PDF (max 10MB each)
        </p>
        {remainingScans !== null && (
          <p className="text-xs text-muted-foreground mt-2">
            {remainingScans} scans remaining this month
          </p>
        )}
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((f) => (
            <div
              key={f.id}
              className="flex items-center gap-3 rounded-lg border p-3"
            >
              {getStatusIcon(f.status)}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{f.file.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-muted-foreground">
                    {getStatusLabel(f.status)}
                  </span>
                  {f.status === "done" && f.extractedPreview?.amount && (
                    <Badge variant="secondary" className="text-xs">
                      ${Math.abs(f.extractedPreview.amount).toFixed(2)}
                    </Badge>
                  )}
                  {f.status === "done" && f.extractedPreview?.category && (
                    <Badge variant="outline" className="text-xs">
                      {f.extractedPreview.category.replace(/_/g, " ")}
                    </Badge>
                  )}
                  {f.error && f.status === "failed" && (
                    <span className="text-xs text-destructive">{f.error}</span>
                  )}
                  {f.status === "quota_exceeded" && (
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-xs"
                      asChild
                    >
                      <a href="/settings/billing">Upgrade</a>
                    </Button>
                  )}
                </div>
                {(f.status === "uploading" || f.status === "extracting") && (
                  <Progress value={f.progress} className="mt-1.5 h-1" />
                )}
              </div>
              {(f.status === "done" ||
                f.status === "failed" ||
                f.status === "quota_exceeded") && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => removeFile(f.id)}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
