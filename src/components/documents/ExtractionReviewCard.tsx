"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { FileText, Check, X, ExternalLink } from "lucide-react";
import { useState } from "react";
import { categories } from "@/lib/categories";
import { PropertySelect } from "@/components/properties/PropertySelect";

interface ExtractionReviewCardProps {
  extraction: {
    id: string;
    documentType: string;
    confidence: string | null;
    extractedData?: {
      vendor: string | null;
      amount: number | null;
      date: string | null;
      category: string | null;
      propertyAddress: string | null;
    } | null;
    matchedPropertyId: string | null;
    propertyMatchConfidence: string | null;
    document: {
      fileName: string;
      storagePath: string;
    } | null;
    draftTransaction: {
      id: string;
      amount: string;
      date: string;
      description: string;
      category: string;
      propertyId: string | null;
    } | null;
    matchedProperty: {
      id: string;
      address: string;
    } | null;
  };
  onConfirm: (updates: {
    propertyId?: string;
    category?: string;
    amount?: number;
    date?: string;
    description?: string;
  }) => void;
  onDiscard: () => void;
}

export function ExtractionReviewCard({
  extraction,
  onConfirm,
  onDiscard,
}: ExtractionReviewCardProps) {
  const [propertyId, setPropertyId] = useState(
    extraction.matchedPropertyId || extraction.draftTransaction?.propertyId || ""
  );
  const [category, setCategory] = useState(
    extraction.draftTransaction?.category || "uncategorized"
  );
  const [amount, setAmount] = useState(
    extraction.extractedData?.amount
      ? Math.abs(extraction.extractedData.amount).toString()
      : ""
  );
  const [date, setDate] = useState(
    extraction.extractedData?.date || extraction.draftTransaction?.date || ""
  );
  const [description, setDescription] = useState(
    extraction.extractedData?.vendor || extraction.draftTransaction?.description || ""
  );

  const confidence = extraction.confidence
    ? parseFloat(extraction.confidence)
    : 0;
  const propertyConfidence = extraction.propertyMatchConfidence
    ? parseFloat(extraction.propertyMatchConfidence)
    : 0;

  const handleConfirm = () => {
    onConfirm({
      propertyId: propertyId || undefined,
      category,
      amount: parseFloat(amount) * -1, // Expenses are negative
      date,
      description,
    });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle className="text-base">
                {extraction.document?.fileName || "Unknown document"}
              </CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary">
                  {extraction.documentType.replace("_", " ")}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {Math.round(confidence * 100)}% confident
                </span>
              </div>
            </div>
          </div>
          {extraction.document?.storagePath && (
            <Button variant="ghost" size="sm" asChild>
              <a
                href={`/api/documents/${extraction.document.storagePath}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-4 w-4 mr-1" />
                View
              </a>
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="vendor">Vendor</Label>
            <Input
              id="vendor"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="amount">Amount</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Date</Label>
            <DatePicker
              value={date}
              onChange={setDate}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="property">Property</Label>
            {propertyConfidence > 0 && (
              <span className="text-xs text-muted-foreground">
                {Math.round(propertyConfidence * 100)}% match
              </span>
            )}
          </div>
          <PropertySelect
            value={propertyId}
            onValueChange={setPropertyId}
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onDiscard}>
            <X className="h-4 w-4 mr-1" />
            Discard
          </Button>
          <Button onClick={handleConfirm}>
            <Check className="h-4 w-4 mr-1" />
            Confirm Transaction
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
