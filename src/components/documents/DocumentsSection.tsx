"use client";

import { useState } from "react";
import { FileUpload } from "./FileUpload";
import { DocumentList } from "./DocumentList";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";

interface DocumentsSectionProps {
  propertyId?: string;
  transactionId?: string;
  showCategoryFilter?: boolean;
}

const categories = [
  { value: "receipt", label: "Receipt" },
  { value: "contract", label: "Contract" },
  { value: "depreciation", label: "Depreciation Schedule" },
  { value: "lease", label: "Lease Agreement" },
  { value: "other", label: "Other" },
] as const;

type Category = (typeof categories)[number]["value"];

export function DocumentsSection({
  propertyId,
  transactionId,
  showCategoryFilter = true,
}: DocumentsSectionProps) {
  const [selectedCategory, setSelectedCategory] = useState<Category | undefined>();
  const utils = trpc.useUtils();

  const handleUploadComplete = () => {
    utils.documents.list.invalidate({ propertyId, transactionId });
    toast.success("Document uploaded successfully");
    setSelectedCategory(undefined);
  };

  const handleError = (error: string) => {
    toast.error(error);
  };

  return (
    <div className="space-y-6">
      {/* Upload section */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium">Upload Document</h3>

        {showCategoryFilter && (
          <Select
            value={selectedCategory}
            onValueChange={(value) => setSelectedCategory(value as Category)}
          >
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Select category (optional)" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <FileUpload
          propertyId={propertyId}
          transactionId={transactionId}
          category={selectedCategory}
          onUploadComplete={handleUploadComplete}
          onError={handleError}
        />
      </div>

      {/* Document list */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium">Uploaded Documents</h3>
        <DocumentList propertyId={propertyId} transactionId={transactionId} />
      </div>
    </div>
  );
}
