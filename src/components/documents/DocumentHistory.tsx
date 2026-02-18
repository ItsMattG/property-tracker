"use client";

import { useState } from "react";
import { FileText, Image, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc/client";
import { formatDate } from "@/lib/utils";

const DOCUMENT_CATEGORIES = [
  { value: "all", label: "All Categories" },
  { value: "receipt", label: "Receipt" },
  { value: "contract", label: "Contract" },
  { value: "depreciation", label: "Depreciation" },
  { value: "lease", label: "Lease" },
  { value: "other", label: "Other" },
] as const;

export function DocumentHistory() {
  const [propertyId, setPropertyId] = useState<string>("all");
  const [category, setCategory] = useState<string>("all");

  const { data: properties } = trpc.property.list.useQuery();
  const { data: documents, isLoading } = trpc.documents.list.useQuery({
    propertyId: propertyId !== "all" ? propertyId : undefined,
    category:
      category !== "all"
        ? (category as "receipt" | "contract" | "depreciation" | "lease" | "other")
        : undefined,
  });

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith("image/"))
      return <Image className="h-4 w-4 text-muted-foreground" />;
    return <FileText className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-lg">Document History</CardTitle>
          <div className="flex items-center gap-2">
            <Select value={propertyId} onValueChange={setPropertyId}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Properties" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Properties</SelectItem>
                {properties?.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.address}, {p.suburb}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DOCUMENT_CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-12 bg-muted animate-pulse rounded" />
            ))}
          </div>
        ) : !documents || documents.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No documents found. Upload some files to get started.
          </p>
        ) : (
          <div className="space-y-1">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center gap-3 rounded-lg p-2.5 hover:bg-muted/50 transition-colors"
              >
                {getFileIcon(doc.fileType)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{doc.fileName}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(doc.createdAt)}
                  </p>
                </div>
                {doc.category && (
                  <Badge variant="outline" className="text-xs shrink-0">
                    {doc.category}
                  </Badge>
                )}
                {doc.signedUrl && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    asChild
                  >
                    <a
                      href={doc.signedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
