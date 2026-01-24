"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, X, FileText, Image, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase/client";
import { trpc } from "@/lib/trpc/client";

const ALLOWED_TYPES = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/heic": [".heic"],
  "application/pdf": [".pdf"],
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

interface FileUploadProps {
  propertyId?: string;
  transactionId?: string;
  category?: "receipt" | "contract" | "depreciation" | "lease" | "other";
  onUploadComplete?: () => void;
  onError?: (error: string) => void;
}

export function FileUpload({
  propertyId,
  transactionId,
  category,
  onUploadComplete,
  onError,
}: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<{ name: string; type: string } | null>(null);

  const getUploadUrl = trpc.documents.getUploadUrl.useMutation();
  const createDocument = trpc.documents.create.useMutation();

  const handleUpload = useCallback(
    async (file: File) => {
      if (!propertyId && !transactionId) {
        onError?.("No property or transaction specified");
        return;
      }

      setUploading(true);
      setPreview({ name: file.name, type: file.type });

      try {
        // Get signed upload URL
        const { signedUrl, storagePath, token } = await getUploadUrl.mutateAsync({
          fileName: file.name,
          fileType: file.type as "image/jpeg" | "image/png" | "image/heic" | "application/pdf",
          fileSize: file.size,
          propertyId,
          transactionId,
        });

        // Upload directly to Supabase
        const { error: uploadError } = await supabase.storage
          .from("documents")
          .uploadToSignedUrl(storagePath, token, file);

        if (uploadError) {
          throw new Error(uploadError.message);
        }

        // Create document record
        await createDocument.mutateAsync({
          storagePath,
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          propertyId,
          transactionId,
          category,
        });

        setPreview(null);
        onUploadComplete?.();
      } catch (error) {
        onError?.(error instanceof Error ? error.message : "Upload failed");
        setPreview(null);
      } finally {
        setUploading(false);
      }
    },
    [propertyId, transactionId, category, getUploadUrl, createDocument, onUploadComplete, onError]
  );

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (file) {
        handleUpload(file);
      }
    },
    [handleUpload]
  );

  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    onDrop,
    accept: ALLOWED_TYPES,
    maxSize: MAX_FILE_SIZE,
    maxFiles: 1,
    disabled: uploading,
  });

  const getFileIcon = (type: string) => {
    if (type.startsWith("image/")) {
      return <Image className="h-8 w-8 text-muted-foreground" />;
    }
    return <FileText className="h-8 w-8 text-muted-foreground" />;
  };

  return (
    <div className="space-y-2">
      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
          isDragActive && "border-primary bg-primary/5",
          uploading && "opacity-50 cursor-not-allowed",
          !isDragActive && !uploading && "border-muted-foreground/25 hover:border-primary/50"
        )}
      >
        <input {...getInputProps()} />

        {uploading && preview ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Uploading {preview.name}...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">
                {isDragActive ? "Drop file here" : "Drag & drop or click to upload"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                JPG, PNG, HEIC, or PDF (max 10MB)
              </p>
            </div>
          </div>
        )}
      </div>

      {fileRejections.length > 0 && (
        <p className="text-sm text-destructive">
          {fileRejections[0].errors[0].code === "file-too-large"
            ? "File is too large. Maximum size is 10MB."
            : fileRejections[0].errors[0].code === "file-invalid-type"
            ? "Invalid file type. Only JPG, PNG, HEIC, and PDF are supported."
            : fileRejections[0].errors[0].message}
        </p>
      )}
    </div>
  );
}
