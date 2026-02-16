"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, FileSpreadsheet, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PropertySelect } from "@/components/properties/PropertySelect";
import { splitCSVLine } from "@/server/services/banking/csv-import";
import { cn } from "@/lib/utils";

interface UploadStepProps {
  onContinue: (data: {
    file: File;
    csvContent: string;
    csvHeaders: string[];
    previewRows: string[][];
    fallbackPropertyId: string;
  }) => void;
}

export function UploadStep({ onContinue }: UploadStepProps) {
  const [file, setFile] = useState<File | null>(null);
  const [csvContent, setCsvContent] = useState("");
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<string[][]>([]);
  const [rowCount, setRowCount] = useState(0);
  const [propertyId, setPropertyId] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(async (selectedFile: File) => {
    setFile(selectedFile);
    const content = await selectedFile.text();
    setCsvContent(content);

    const lines = content.trim().split("\n");
    const headers = splitCSVLine(lines[0]).map((h) => h.replace(/"/g, ""));
    setCsvHeaders(headers);
    setRowCount(lines.length - 1);

    const preview = lines.slice(1, 4).map((line) => splitCSVLine(line));
    setPreviewRows(preview);
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (selectedFile) processFile(selectedFile);
    },
    [processFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile?.name.endsWith(".csv")) {
        processFile(droppedFile);
      }
    },
    [processFile]
  );

  const handleClearFile = useCallback(() => {
    setFile(null);
    setCsvContent("");
    setCsvHeaders([]);
    setPreviewRows([]);
    setRowCount(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const handleContinue = useCallback(() => {
    if (!file) return;
    onContinue({
      file,
      csvContent,
      csvHeaders,
      previewRows,
      fallbackPropertyId: propertyId,
    });
  }, [file, csvContent, csvHeaders, previewRows, propertyId, onContinue]);

  return (
    <div className="mx-auto max-w-lg space-y-6">
      {!file ? (
        <div
          role="button"
          tabIndex={0}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          className={cn(
            "flex min-h-[200px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors",
            isDragOver
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-primary/50"
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="sr-only"
          />
          <Upload className="mb-3 size-10 text-muted-foreground" />
          <p className="text-sm font-medium">
            Drag a CSV file here or click to browse
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Supports .csv files
          </p>
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-lg border bg-muted/50 p-4">
          <FileSpreadsheet className="size-8 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{file.name}</p>
            <p className="text-xs text-muted-foreground">
              {rowCount} row{rowCount !== 1 ? "s" : ""} detected &middot;{" "}
              {(file.size / 1024).toFixed(1)} KB
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleClearFile}
            aria-label="Remove file"
          >
            <X className="size-4" />
          </Button>
        </div>
      )}

      <div>
        <label className="text-sm font-medium">Default Property</label>
        <p className="mb-1.5 text-xs text-muted-foreground">
          Assigned to rows without a property column.
        </p>
        <PropertySelect
          value={propertyId}
          onValueChange={setPropertyId}
          triggerClassName="mt-1"
        />
      </div>

      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer font-medium hover:text-foreground">
          Supported columns
        </summary>
        <p className="mt-1">
          Date, Description, Amount (or Debit/Credit), Property, Category, Type,
          Deductible, Invoice URL, Notes, and more.
        </p>
      </details>

      <Button onClick={handleContinue} disabled={!file} className="w-full">
        Continue to Column Mapping
      </Button>
    </div>
  );
}
