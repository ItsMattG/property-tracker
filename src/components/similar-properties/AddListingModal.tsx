"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Link as LinkIcon, FileText, Edit } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import type { ExtractedListingData } from "@/types/similar-properties";

interface AddListingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const STATES = ["NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT"];
const PROPERTY_TYPES = ["house", "townhouse", "unit"] as const;

export function AddListingModal({ open, onOpenChange, onSuccess }: AddListingModalProps) {
  const [tab, setTab] = useState<"url" | "text" | "manual">("url");
  const [urlInput, setUrlInput] = useState("");
  const [textInput, setTextInput] = useState("");
  const [extractedData, setExtractedData] = useState<ExtractedListingData | null>(null);
  const [manualData, setManualData] = useState<Partial<ExtractedListingData>>({
    propertyType: "house",
  });

  const extractMutation = trpc.similarProperties.extractListing.useMutation({
    onSuccess: (result) => {
      if (result.success && result.data) {
        setExtractedData(result.data);
      }
    },
  });

  const saveMutation = trpc.similarProperties.saveExternalListing.useMutation({
    onSuccess: () => {
      onOpenChange(false);
      resetForm();
      onSuccess?.();
    },
  });

  const resetForm = () => {
    setUrlInput("");
    setTextInput("");
    setExtractedData(null);
    setManualData({ propertyType: "house" });
  };

  const handleExtract = () => {
    if (tab === "manual") return;
    const content = tab === "url" ? urlInput : textInput;
    extractMutation.mutate({ content, sourceType: tab });
  };

  const handleSave = () => {
    const data = extractedData || (manualData as ExtractedListingData);
    if (!data.suburb || !data.state || !data.postcode || !data.propertyType) {
      return;
    }

    saveMutation.mutate({
      sourceType: tab,
      sourceUrl: tab === "url" ? urlInput : undefined,
      rawInput: tab === "text" ? textInput : undefined,
      extractedData: {
        address: data.address,
        suburb: data.suburb,
        state: data.state,
        postcode: data.postcode,
        price: data.price,
        propertyType: data.propertyType,
        bedrooms: data.bedrooms,
        bathrooms: data.bathrooms,
        landSize: data.landSize,
        estimatedRent: data.estimatedRent,
      },
    });
  };

  const renderExtractedPreview = () => {
    if (!extractedData) return null;

    return (
      <div className="mt-4 p-4 bg-muted rounded-lg space-y-2">
        <h4 className="font-medium">Extracted Data</h4>
        <div className="grid grid-cols-2 gap-2 text-sm">
          {extractedData.address && (
            <div>
              <span className="text-muted-foreground">Address:</span> {extractedData.address}
            </div>
          )}
          <div>
            <span className="text-muted-foreground">Suburb:</span> {extractedData.suburb}
          </div>
          <div>
            <span className="text-muted-foreground">State:</span> {extractedData.state}
          </div>
          <div>
            <span className="text-muted-foreground">Type:</span> {extractedData.propertyType}
          </div>
          {extractedData.price && (
            <div>
              <span className="text-muted-foreground">Price:</span> ${extractedData.price.toLocaleString()}
            </div>
          )}
          {extractedData.bedrooms && (
            <div>
              <span className="text-muted-foreground">Beds:</span> {extractedData.bedrooms}
            </div>
          )}
        </div>
        <Button onClick={handleSave} disabled={saveMutation.isPending} className="w-full mt-4">
          {saveMutation.isPending ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : null}
          Save & Compare
        </Button>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Listing to Compare</DialogTitle>
          <DialogDescription>
            Paste a listing URL, text, or enter details manually.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="url">
              <LinkIcon className="w-4 h-4 mr-2" />
              URL
            </TabsTrigger>
            <TabsTrigger value="text">
              <FileText className="w-4 h-4 mr-2" />
              Text
            </TabsTrigger>
            <TabsTrigger value="manual">
              <Edit className="w-4 h-4 mr-2" />
              Manual
            </TabsTrigger>
          </TabsList>

          <TabsContent value="url" className="space-y-4">
            <div>
              <Label htmlFor="url">Listing URL</Label>
              <Input
                id="url"
                placeholder="https://www.domain.com.au/..."
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
              />
            </div>
            <Button
              onClick={handleExtract}
              disabled={!urlInput || extractMutation.isPending}
              className="w-full"
            >
              {extractMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : null}
              Extract Details
            </Button>
            {renderExtractedPreview()}
          </TabsContent>

          <TabsContent value="text" className="space-y-4">
            <div>
              <Label htmlFor="text">Listing Text</Label>
              <Textarea
                id="text"
                placeholder="Paste listing description here..."
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                rows={6}
              />
            </div>
            <Button
              onClick={handleExtract}
              disabled={!textInput || extractMutation.isPending}
              className="w-full"
            >
              {extractMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : null}
              Extract Details
            </Button>
            {renderExtractedPreview()}
          </TabsContent>

          <TabsContent value="manual" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="suburb">Suburb *</Label>
                <Input
                  id="suburb"
                  value={manualData.suburb || ""}
                  onChange={(e) => setManualData({ ...manualData, suburb: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="state">State *</Label>
                <Select
                  value={manualData.state}
                  onValueChange={(v) => setManualData({ ...manualData, state: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATES.map((state) => (
                      <SelectItem key={state} value={state}>
                        {state}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="postcode">Postcode *</Label>
                <Input
                  id="postcode"
                  value={manualData.postcode || ""}
                  onChange={(e) => setManualData({ ...manualData, postcode: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="propertyType">Property Type *</Label>
                <Select
                  value={manualData.propertyType}
                  onValueChange={(v) =>
                    setManualData({ ...manualData, propertyType: v as typeof PROPERTY_TYPES[number] })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROPERTY_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="price">Price</Label>
                <Input
                  id="price"
                  type="number"
                  value={manualData.price || ""}
                  onChange={(e) => setManualData({ ...manualData, price: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label htmlFor="bedrooms">Bedrooms</Label>
                <Input
                  id="bedrooms"
                  type="number"
                  value={manualData.bedrooms || ""}
                  onChange={(e) => setManualData({ ...manualData, bedrooms: Number(e.target.value) })}
                />
              </div>
            </div>
            <Button
              onClick={handleSave}
              disabled={
                !manualData.suburb ||
                !manualData.state ||
                !manualData.postcode ||
                saveMutation.isPending
              }
              className="w-full"
            >
              {saveMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : null}
              Save & Compare
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
