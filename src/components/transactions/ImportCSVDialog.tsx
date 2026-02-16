"use client";

import { useState, useCallback } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { StepIndicator } from "./import/StepIndicator";
import { UploadStep } from "./import/UploadStep";
import { ColumnMappingStep } from "./import/ColumnMappingStep";
import { PreviewStep, type ImportReadyRow } from "./import/PreviewStep";
import {
  parseCSVHeaders,
  parseRichCSV,
  type CSVColumnMap,
  type ParsedCSVRow,
} from "@/server/services/banking/csv-import";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";

// --- Types ---

type WizardStep = "upload" | "mapping" | "preview";

const STEPS = [
  { key: "upload", label: "Upload" },
  { key: "mapping", label: "Map Columns" },
  { key: "preview", label: "Preview & Import" },
];

interface ImportCSVDialogProps {
  onSuccess?: () => void;
}

// --- Component ---

export function ImportCSVDialog({ onSuccess }: ImportCSVDialogProps) {
  const [open, setOpen] = useState(false);

  // Wizard state
  const [step, setStep] = useState<WizardStep>("upload");
  const [csvContent, setCsvContent] = useState("");
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<string[][]>([]);
  const [fallbackPropertyId, setFallbackPropertyId] = useState("");
  const [parsedRows, setParsedRows] = useState<ParsedCSVRow[]>([]);

  // Properties query for preview step
  const { data: properties } = trpc.property.list.useQuery();

  // Reset all wizard state
  const resetState = useCallback(() => {
    setStep("upload");
    setCsvContent("");
    setCsvHeaders([]);
    setPreviewRows([]);
    setFallbackPropertyId("");
    setParsedRows([]);
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

  const handleUploadContinue = useCallback(
    (data: {
      file: File;
      csvContent: string;
      csvHeaders: string[];
      previewRows: string[][];
      fallbackPropertyId: string;
    }) => {
      setCsvContent(data.csvContent);
      setCsvHeaders(data.csvHeaders);
      setPreviewRows(data.previewRows);
      setFallbackPropertyId(data.fallbackPropertyId);
      setStep("mapping");
    },
    []
  );

  const handleMappingConfirm = useCallback(
    (mapping: CSVColumnMap) => {
      const rows = parseRichCSV(csvContent, mapping);
      setParsedRows(rows);
      setStep("preview");
    },
    [csvContent]
  );

  const handleImport = useCallback(
    (rows: ImportReadyRow[]) => {
      // Cast rows to satisfy tRPC's stricter enum types -- by this point,
      // categories and transaction types have been resolved to valid values
      // by the PreviewStep component.
      importRichCSV.mutate({
        rows: rows as unknown as Parameters<
          typeof importRichCSV.mutate
        >[0]["rows"],
      });
    },
    [importRichCSV]
  );

  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      setOpen(newOpen);
      if (!newOpen) {
        resetState();
      }
    },
    [resetState]
  );

  // --- Step indicator ---

  const currentStepIndex = STEPS.findIndex((s) => s.key === step);

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Upload className="mr-2 size-4" />
        Import CSV
      </Button>

      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent
          side="bottom"
          className="flex h-[100dvh] flex-col overflow-hidden p-0"
          showCloseButton={true}
        >
          {/* Fixed header */}
          <SheetHeader className="shrink-0 border-b px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <SheetTitle>Import Transactions from CSV</SheetTitle>
                <SheetDescription className="mt-0.5">
                  {step === "upload" &&
                    "Upload a CSV file to get started."}
                  {step === "mapping" &&
                    "Map your CSV columns to BrickTrack fields."}
                  {step === "preview" &&
                    "Review and adjust your data before importing."}
                </SheetDescription>
              </div>
              <StepIndicator steps={STEPS} currentIndex={currentStepIndex} />
            </div>
          </SheetHeader>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto px-6 py-6">
            {step === "upload" && (
              <UploadStep onContinue={handleUploadContinue} />
            )}

            {step === "mapping" && (
              <div className="mx-auto max-w-4xl">
                <ColumnMappingStep
                  csvHeaders={csvHeaders}
                  previewRows={previewRows}
                  autoDetected={parseCSVHeaders(csvHeaders)}
                  onConfirm={handleMappingConfirm}
                  onBack={() => setStep("upload")}
                />
              </div>
            )}

            {step === "preview" && (
              <div className="mx-auto max-w-6xl">
                <PreviewStep
                  parsedRows={parsedRows}
                  properties={
                    properties?.map((p) => ({
                      id: p.id,
                      address: p.address,
                      suburb: p.suburb,
                    })) ?? []
                  }
                  fallbackPropertyId={fallbackPropertyId}
                  onImport={handleImport}
                  onBack={() => setStep("mapping")}
                  isImporting={importRichCSV.isPending}
                />
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
