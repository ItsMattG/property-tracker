"use client";

import { useState } from "react";
import { useDropzone } from "react-dropzone";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Loader2,
  Check,
  Plus,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase/client";
import { trpc } from "@/lib/trpc/client";
import type { SettlementExtractedData } from "@/server/services/settlement-extract";

type CapitalCategory =
  | "stamp_duty"
  | "conveyancing"
  | "buyers_agent_fees"
  | "initial_repairs";

interface CostItem {
  category: CapitalCategory;
  description: string;
  amount: number;
  date: string;
}

const CATEGORY_LABELS: Record<CapitalCategory, string> = {
  stamp_duty: "Stamp Duty",
  conveyancing: "Conveyancing / Legal Fees",
  buyers_agent_fees: "Buyer's Agent Fees",
  initial_repairs: "Initial Repairs",
};

interface SettlementUploadProps {
  propertyId: string;
  purchaseDate: string;
  onComplete?: () => void;
  onSkip?: () => void;
}

export function SettlementUpload({
  propertyId,
  purchaseDate,
  onComplete,
  onSkip,
}: SettlementUploadProps) {
  const [step, setStep] = useState<"upload" | "extracting" | "review">("upload");
  const [extractedData, setExtractedData] = useState<SettlementExtractedData | null>(null);
  const [costItems, setCostItems] = useState<CostItem[]>([]);
  const [purchasePrice, setPurchasePrice] = useState<string>("");
  const [settlementDate, setSettlementDate] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const getUploadUrl = trpc.documents.getUploadUrl.useMutation();
  const createDocument = trpc.documents.create.useMutation();
  const extractMutation = trpc.settlement.extract.useMutation();
  const confirmMutation = trpc.settlement.confirm.useMutation();

  const handleUpload = async (file: File) => {
    setError(null);
    setStep("extracting");

    try {
      // Get signed upload URL
      const { storagePath, token } = await getUploadUrl.mutateAsync({
        fileName: file.name,
        fileType: file.type as "application/pdf" | "image/jpeg" | "image/png" | "image/heic",
        fileSize: file.size,
        propertyId,
      });

      // Upload to Supabase
      const { error: uploadError } = await supabase.storage
        .from("documents")
        .uploadToSignedUrl(storagePath, token, file);

      if (uploadError) throw new Error(uploadError.message);

      // Create document record
      await createDocument.mutateAsync({
        storagePath,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        propertyId,
        category: "contract",
      });

      // Extract settlement data
      const data = await extractMutation.mutateAsync({
        propertyId,
        storagePath,
        fileType: file.type,
      });

      setExtractedData(data);

      // Pre-populate review form from extracted data
      if (data.purchasePrice) setPurchasePrice(String(data.purchasePrice));
      if (data.settlementDate) setSettlementDate(data.settlementDate);

      const items: CostItem[] = [];
      const date = data.settlementDate || purchaseDate;

      if (data.stampDuty) {
        items.push({
          category: "stamp_duty",
          description: "Stamp Duty (Transfer Duty)",
          amount: data.stampDuty,
          date,
        });
      }
      if (data.legalFees) {
        items.push({
          category: "conveyancing",
          description: "Conveyancing / Legal Fees",
          amount: data.legalFees,
          date,
        });
      }
      if (data.titleSearchFees) {
        items.push({
          category: "conveyancing",
          description: "Title Search Fees",
          amount: data.titleSearchFees,
          date,
        });
      }
      if (data.registrationFees) {
        items.push({
          category: "conveyancing",
          description: "Registration Fees",
          amount: data.registrationFees,
          date,
        });
      }

      setCostItems(items);
      setStep("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process settlement statement");
      setStep("upload");
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (files) => files[0] && handleUpload(files[0]),
    accept: {
      "application/pdf": [".pdf"],
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
    },
    maxSize: 10 * 1024 * 1024,
    maxFiles: 1,
    disabled: step !== "upload",
  });

  const handleConfirm = async () => {
    try {
      await confirmMutation.mutateAsync({
        propertyId,
        purchasePrice: purchasePrice ? Number(purchasePrice) : undefined,
        settlementDate: settlementDate || undefined,
        items: costItems,
      });
      onComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settlement data");
    }
  };

  const addItem = () => {
    setCostItems([
      ...costItems,
      {
        category: "conveyancing",
        description: "",
        amount: 0,
        date: settlementDate || purchaseDate,
      },
    ]);
  };

  const removeItem = (index: number) => {
    setCostItems(costItems.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, updates: Partial<CostItem>) => {
    setCostItems(
      costItems.map((item, i) => (i === index ? { ...item, ...updates } : item))
    );
  };

  if (step === "extracting") {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
          <p className="text-sm text-muted-foreground">
            Extracting settlement data...
          </p>
        </CardContent>
      </Card>
    );
  }

  if (step === "review" && extractedData) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Review Settlement Data</CardTitle>
              <CardDescription>
                Verify the extracted data and confirm to add acquisition costs to your cost base.
              </CardDescription>
            </div>
            <Badge variant="secondary">
              {Math.round(extractedData.confidence * 100)}% confident
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Purchase details */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Purchase Price ($)</Label>
              <Input
                type="number"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
                placeholder="Purchase price"
              />
            </div>
            <div className="space-y-2">
              <Label>Settlement Date</Label>
              <Input
                type="date"
                value={settlementDate}
                onChange={(e) => setSettlementDate(e.target.value)}
              />
            </div>
          </div>

          {/* Cost items */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Acquisition Costs</Label>
              <Button variant="outline" size="sm" onClick={addItem}>
                <Plus className="h-4 w-4 mr-1" />
                Add Item
              </Button>
            </div>

            {costItems.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No acquisition costs extracted. Click &quot;Add Item&quot; to add manually.
              </p>
            )}

            {costItems.map((item, index) => (
              <div
                key={index}
                className="grid grid-cols-[1fr_1fr_auto] gap-3 items-end"
              >
                <div className="space-y-1">
                  <Label className="text-xs">Description</Label>
                  <Input
                    value={item.description}
                    onChange={(e) =>
                      updateItem(index, { description: e.target.value })
                    }
                    placeholder="Description"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Amount ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={item.amount || ""}
                    onChange={(e) =>
                      updateItem(index, { amount: Number(e.target.value) })
                    }
                    placeholder="Amount"
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeItem(index)}
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}

            {costItems.length > 0 && (
              <div className="flex justify-between items-center pt-2 border-t">
                <span className="text-sm font-medium">Total Acquisition Costs</span>
                <span className="text-sm font-semibold">
                  ${costItems.reduce((sum, item) => sum + (item.amount || 0), 0).toLocaleString("en-AU", { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onSkip}>
              Skip
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={confirmMutation.isPending}
            >
              {confirmMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Confirm &amp; Save
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Upload step
  return (
    <Card>
      <CardHeader>
        <CardTitle>Settlement Statement</CardTitle>
        <CardDescription>
          Upload your settlement statement to automatically extract stamp duty, legal fees, and other acquisition costs for your CGT cost base.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          {...getRootProps()}
          className={cn(
            "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
            isDragActive && "border-primary bg-primary/5",
            !isDragActive && "border-muted-foreground/25 hover:border-primary/50"
          )}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center gap-3">
            <FileText className="h-10 w-10 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">
                {isDragActive
                  ? "Drop settlement statement here"
                  : "Drag & drop or click to upload"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                PDF, JPG, or PNG (max 10MB)
              </p>
            </div>
          </div>
        </div>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <div className="flex justify-end">
          <Button variant="ghost" onClick={onSkip}>
            Skip — I&apos;ll add costs manually later
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
