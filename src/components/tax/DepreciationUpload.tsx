"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";
import { Upload, Loader2, FileText } from "lucide-react";
import { DepreciationTable } from "./DepreciationTable";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Lazy-initialize Supabase client to avoid errors when env vars are missing
let supabaseClient: SupabaseClient | null = null;
function getSupabase(): SupabaseClient {
  if (!supabaseClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      throw new Error("Supabase environment variables are not configured");
    }
    supabaseClient = createClient(url, key);
  }
  return supabaseClient;
}

interface ExtractedAsset {
  assetName: string;
  category: "plant_equipment" | "capital_works";
  originalCost: number;
  effectiveLife: number;
  method: "diminishing_value" | "prime_cost";
  yearlyDeduction: number;
}

export function DepreciationUpload() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"select" | "upload" | "review">("select");
  const [selectedProperty, setSelectedProperty] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [extractedData, setExtractedData] = useState<{
    assets: ExtractedAsset[];
    totalValue: number;
    effectiveDate: string | null;
    documentId: string;
  } | null>(null);

  const utils = trpc.useUtils();
  const { data: properties } = trpc.property.list.useQuery();

  const extractMutation = trpc.taxOptimization.extractDepreciation.useMutation({
    onSuccess: (data) => {
      setExtractedData((prev) => ({
        ...data,
        documentId: prev?.documentId || "",
      }));
      setStep("review");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const saveMutation = trpc.taxOptimization.saveDepreciationSchedule.useMutation({
    onSuccess: () => {
      toast.success("Depreciation schedule saved");
      utils.taxOptimization.getDepreciationSchedules.invalidate();
      utils.taxOptimization.getSuggestions.invalidate();
      setOpen(false);
      resetState();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const resetState = () => {
    setStep("select");
    setSelectedProperty("");
    setExtractedData(null);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedProperty) return;

    if (file.type !== "application/pdf") {
      toast.error("Please upload a PDF file");
      return;
    }

    setUploading(true);

    try {
      // Upload to Supabase
      const fileName = `${Date.now()}-${file.name}`;
      const path = `depreciation/${selectedProperty}/${fileName}`;

      const { error: uploadError } = await getSupabase().storage
        .from("documents")
        .upload(path, file);

      if (uploadError) throw uploadError;

      // Create document record
      const docResponse = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId: selectedProperty,
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          storagePath: path,
          category: "depreciation",
        }),
      });

      const doc = await docResponse.json();

      setExtractedData((prev) => ({
        assets: prev?.assets || [],
        totalValue: prev?.totalValue || 0,
        effectiveDate: prev?.effectiveDate || null,
        documentId: doc.id,
      }));

      // Extract depreciation data
      extractMutation.mutate({
        documentId: doc.id,
        propertyId: selectedProperty,
      });
    } catch (error) {
      toast.error("Failed to upload file");
      console.error(error);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = () => {
    if (!extractedData || !selectedProperty) return;

    saveMutation.mutate({
      propertyId: selectedProperty,
      documentId: extractedData.documentId,
      effectiveDate: extractedData.effectiveDate || new Date().toISOString().split("T")[0],
      totalValue: extractedData.totalValue,
      assets: extractedData.assets,
    });
  };

  const handleAssetUpdate = (index: number, field: string, value: string | number) => {
    if (!extractedData) return;

    const updatedAssets = [...extractedData.assets];
    updatedAssets[index] = { ...updatedAssets[index], [field]: value };

    const totalValue = updatedAssets.reduce((sum, a) => sum + a.originalCost, 0);

    setExtractedData({
      ...extractedData,
      assets: updatedAssets,
      totalValue,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetState(); }}>
      <DialogTrigger asChild>
        <Button>
          <Upload className="w-4 h-4 mr-2" />
          Upload Depreciation Schedule
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === "select" && "Select Property"}
            {step === "upload" && "Upload Schedule"}
            {step === "review" && "Review Extracted Assets"}
          </DialogTitle>
        </DialogHeader>

        {step === "select" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Property</Label>
              <Select value={selectedProperty} onValueChange={setSelectedProperty}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a property" />
                </SelectTrigger>
                <SelectContent>
                  {properties?.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.address}, {p.suburb}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => setStep("upload")} disabled={!selectedProperty}>
              Continue
            </Button>
          </div>
        )}

        {step === "upload" && (
          <div className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              {uploading || extractMutation.isPending ? (
                <div className="flex flex-col items-center">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    {uploading ? "Uploading..." : "Extracting assets..."}
                  </p>
                </div>
              ) : (
                <>
                  <FileText className="w-12 h-12 mx-auto text-muted-foreground" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    Upload your quantity surveyor depreciation schedule (PDF)
                  </p>
                  <Input
                    type="file"
                    accept=".pdf"
                    className="mt-4 max-w-xs mx-auto"
                    onChange={handleFileUpload}
                  />
                </>
              )}
            </div>
            <Button variant="outline" onClick={() => setStep("select")}>
              Back
            </Button>
          </div>
        )}

        {step === "review" && extractedData && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {extractedData.assets.length} assets extracted
              </span>
              <span className="font-medium">
                Total: ${extractedData.totalValue.toLocaleString()}
              </span>
            </div>

            <DepreciationTable
              assets={extractedData.assets}
              onUpdate={handleAssetUpdate}
              editable
            />

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep("upload")}>
                Re-upload
              </Button>
              <Button onClick={handleSave} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : null}
                Save Schedule
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
