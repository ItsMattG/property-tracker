"use client";

import { useState } from "react";
import { FileText, Image, Trash2, Download, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc/client";
import { formatDistanceToNow } from "date-fns";

interface DocumentItem {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  category: string | null;
  description: string | null;
  createdAt: Date | string;
  signedUrl: string | null;
}

interface DocumentListProps {
  propertyId?: string;
  transactionId?: string;
}

const categoryLabels: Record<string, string> = {
  receipt: "Receipt",
  contract: "Contract",
  depreciation: "Depreciation",
  lease: "Lease",
  other: "Other",
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentList({ propertyId, transactionId }: DocumentListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: documents, isLoading, refetch } = trpc.documents.list.useQuery({
    propertyId,
    transactionId,
  });

  const deleteDocument = trpc.documents.delete.useMutation({
    onSuccess: () => {
      refetch();
      setDeletingId(null);
    },
  });

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteDocument.mutateAsync({ id });
    } catch {
      setDeletingId(null);
    }
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith("image/")) {
      return <Image className="h-5 w-5 text-blue-500" />;
    }
    return <FileText className="h-5 w-5 text-red-500" />;
  };

  const openDocument = (doc: DocumentItem) => {
    if (doc.signedUrl) {
      window.open(doc.signedUrl, "_blank");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!documents || documents.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p>No documents uploaded yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {documents.map((doc) => (
        <div
          key={doc.id}
          className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
        >
          {/* File icon */}
          <div className="flex-shrink-0">{getFileIcon(doc.fileType)}</div>

          {/* File info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium truncate">{doc.fileName}</p>
              {doc.category && (
                <Badge variant="secondary" className="text-xs">
                  {categoryLabels[doc.category] || doc.category}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {formatFileSize(doc.fileSize)} &bull;{" "}
              {formatDistanceToNow(new Date(doc.createdAt), { addSuffix: true })}
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => openDocument(doc)}
              disabled={!doc.signedUrl}
              title="View document"
            >
              <ExternalLink className="h-4 w-4" />
            </Button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={deletingId === doc.id}
                  title="Delete document"
                >
                  {deletingId === doc.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 text-destructive" />
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete document?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete &quot;{doc.fileName}&quot;. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => handleDelete(doc.id)}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      ))}
    </div>
  );
}
