"use client";

import { useState, useRef, useCallback } from "react";
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
import { ColumnMappingStep } from "./import/ColumnMappingStep";
import { PreviewStep, type ImportReadyRow } from "./import/PreviewStep";
import {
  parseCSVHeaders,
  parseRichCSV,
  splitCSVLine,
  type CSVColumnMap,
  type ParsedCSVRow,
} from "@/server/services/banking/csv-import";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Upload, FileSpreadsheet } from "lucide-react";

// --- Types ---

type WizardStep = "upload" | "mapping" | "preview";

const STEPS: WizardStep[] = ["upload", "mapping", "preview"];

interface ImportCSVDialogProps {
  onSuccess?: () => void;
}

// --- Component ---

export function ImportCSVDialog({ onSuccess }: ImportCSVDialogProps) {
  const [open, setOpen] = useState(false);

  // Wizard state
  const [step, setStep] = useState<WizardStep>("upload");
  const [propertyId, setPropertyId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [csvContent, setCsvContent] = useState("");
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<string[][]>([]);
  const [, setColumnMap] = useState<CSVColumnMap | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedCSVRow[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Properties query for preview step
  const { data: properties } = trpc.property.list.useQuery();

  // Reset all wizard state
  const resetState = useCallback(() => {
    setStep("upload");
    setPropertyId("");
    setFile(null);
    setCsvContent("");
    setCsvHeaders([]);
    setPreviewRows([]);
    setColumnMap(null);
    setParsedRows([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  // tRPC mutation
  const importRichCSV = trpc.transaction.importRichCSV.useMutation({
    onSuccess: (result) => {
      toast.success(
        `Imported ${result.importedCount} transactions${
          result.errorCount > 0 ? ` (${result.errorCount} errors)` : ""
        }`
      );
      setOpen(false);
      resetState();
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to import CSV");
    },
  });

  // --- Step transitions ---

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      const content = await selectedFile.text();
      setCsvContent(content);

      // Parse headers for the mapping step
      const lines = content.trim().split("\n");
      const headers = splitCSVLine(lines[0]).map((h) => h.replace(/"/g, ""));
      setCsvHeaders(headers);

      // Get first 3 data rows for preview context in column mapping
      const preview = lines.slice(1, 4).map((line) => splitCSVLine(line));
      setPreviewRows(preview);
    }
  };

  const handleUploadContinue = () => {
    if (file) {
      setStep("mapping");
    }
  };

  const handleMappingConfirm = (mapping: CSVColumnMap) => {
    setColumnMap(mapping);
    const rows = parseRichCSV(csvContent, mapping);
    setParsedRows(rows);
    setStep("preview");
  };

  const handleImport = (rows: ImportReadyRow[]) => {
    // Cast rows to satisfy tRPC's stricter enum types — by this point,
    // categories and transaction types have been resolved to valid values
    // by the PreviewStep component.
    importRichCSV.mutate({ rows: rows as unknown as Parameters<typeof importRichCSV.mutate>[0]["rows"] });
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      resetState();
    }
  };

  // --- Dialog size based on step ---

  const dialogSizeClass =
    step === "upload"
      ? "max-w-md"
      : step === "mapping"
        ? "max-w-2xl"
        : "max-w-5xl";

  // --- Step indicator ---

  const currentStepIndex = STEPS.indexOf(step);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="w-4 h-4 mr-2" />
          Import CSV
        </Button>
      </DialogTrigger>
      <DialogContent
        className={cn(dialogSizeClass, "transition-[max-width] duration-200")}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Import Transactions from CSV</DialogTitle>
          <DialogDescription>
            {step === "upload" &&
              "Upload a CSV file and select the default property for imported transactions."}
            {step === "mapping" &&
              "Map your CSV columns to BrickTrack fields."}
            {step === "preview" &&
              "Review and adjust your data before importing."}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-4">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={cn(
                  "w-2 h-2 rounded-full transition-colors",
                  step === s
                    ? "bg-primary"
                    : currentStepIndex > i
                      ? "bg-primary/50"
                      : "bg-muted-foreground/30"
                )}
              />
              {i < STEPS.length - 1 && (
                <div className="w-8 h-px bg-muted-foreground/20" />
              )}
            </div>
          ))}
        </div>

        {/* Step content */}
        {step === "upload" && (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Fallback Property</label>
              <p className="text-xs text-muted-foreground mb-1">
                Used for rows that don&apos;t specify a property column.
              </p>
              <PropertySelect
                value={propertyId}
                onValueChange={setPropertyId}
                triggerClassName="mt-1"
              />
            </div>

            <div>
              <span className="text-sm font-medium">CSV File</span>
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
                className="mt-1 border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary transition-colors"
              >
                <input
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
              </div>
            </div>

            <div className="text-xs text-muted-foreground">
              <p className="font-medium mb-1">Supported columns:</p>
              <p>
                Date, Description, Amount (or Debit/Credit), Property, Category,
                Type, Deductible, Invoice URL, Notes, and more.
              </p>
            </div>

            <Button
              onClick={handleUploadContinue}
              disabled={!file}
              className="w-full"
            >
              Continue to Column Mapping
            </Button>
          </div>
        )}

        {step === "mapping" && (
          <ColumnMappingStep
            csvHeaders={csvHeaders}
            previewRows={previewRows}
            autoDetected={parseCSVHeaders(csvHeaders)}
            onConfirm={handleMappingConfirm}
            onBack={() => setStep("upload")}
          />
        )}

        {step === "preview" && (
          <PreviewStep
            parsedRows={parsedRows}
            properties={
              properties?.map((p) => ({
                id: p.id,
                address: p.address,
                suburb: p.suburb,
              })) ?? []
            }
            fallbackPropertyId={propertyId}
            onImport={handleImport}
            onBack={() => setStep("mapping")}
            isImporting={importRichCSV.isPending}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
