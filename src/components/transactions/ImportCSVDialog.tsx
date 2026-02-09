"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { PropertySelect } from "@/components/properties/PropertySelect";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";
import { Upload, FileSpreadsheet } from "lucide-react";

interface ImportCSVDialogProps {
  onSuccess?: () => void;
}

export function ImportCSVDialog({ onSuccess }: ImportCSVDialogProps) {
  const [open, setOpen] = useState(false);
  const [propertyId, setPropertyId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const importCSV = trpc.transaction.importCSV.useMutation({
    onSuccess: (result) => {
      toast.success(
        `Imported ${result.importedCount} transactions${
          result.errorCount > 0 ? ` (${result.errorCount} errors)` : ""
        }`
      );
      setOpen(false);
      setFile(null);
      setPropertyId("");
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to import CSV");
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const handleImport = async () => {
    if (!file || !propertyId) return;

    const csvContent = await file.text();
    importCSV.mutate({ propertyId, csvContent });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="w-4 h-4 mr-2" />
          Import CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Import Transactions from CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV file from your bank statement to import transactions.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Property</label>
            <PropertySelect
              value={propertyId}
              onValueChange={setPropertyId}
              triggerClassName="mt-1"
            />
          </div>

          <div>
            <span className="text-sm font-medium">CSV File</span>
            <label
              htmlFor="csv-file-upload"
              className="mt-1 border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary transition-colors block"
            >
              <input
                id="csv-file-upload"
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="sr-only"
              />
              {file ? (
                <div className="flex items-center justify-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-primary" />
                  <span className="text-sm">{file.name}</span>
                </div>
              ) : (
                <>
                  <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Click to select a CSV file
                  </p>
                </>
              )}
            </label>
          </div>

          <div className="text-xs text-muted-foreground">
            <p className="font-medium mb-1">Expected columns:</p>
            <p>Date, Description, Amount (or Debit/Credit)</p>
          </div>

          <Button
            onClick={handleImport}
            disabled={!file || !propertyId || importCSV.isPending}
            className="w-full"
          >
            {importCSV.isPending ? "Importing..." : "Import Transactions"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
