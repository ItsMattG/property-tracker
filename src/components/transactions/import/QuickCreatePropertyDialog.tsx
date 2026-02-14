"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";

const STATES = ["NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT"] as const;

interface QuickCreatePropertyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (property: { id: string; address: string; suburb: string }) => void;
  prefillAddress?: string;
}

export function QuickCreatePropertyDialog({
  open,
  onOpenChange,
  onCreated,
  prefillAddress,
}: QuickCreatePropertyDialogProps) {
  const [address, setAddress] = useState(prefillAddress ?? "");
  const [suburb, setSuburb] = useState("");
  const [state, setState] = useState("");
  const [postcode, setPostcode] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [contractDate, setContractDate] = useState("");
  const [error, setError] = useState("");

  const createProperty = trpc.property.create.useMutation({
    onSuccess: (data) => {
      toast.success(`Property "${data.address}" created`);
      onCreated({ id: data.id, address: data.address, suburb: data.suburb });
      onOpenChange(false);
      setAddress("");
      setSuburb("");
      setState("");
      setPostcode("");
      setPurchasePrice("");
      setContractDate("");
      setError("");
    },
    onError: (err) => {
      setError(err.message || "Failed to create property");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    createProperty.mutate({
      address,
      suburb,
      state: state as (typeof STATES)[number],
      postcode,
      purchasePrice,
      contractDate,
    });
  };

  const isValid =
    address.length > 0 &&
    suburb.length > 0 &&
    state.length > 0 &&
    /^\d{4}$/.test(postcode) &&
    /^\d+\.?\d*$/.test(purchasePrice) &&
    contractDate.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Quick Add Property</DialogTitle>
          <DialogDescription>
            Create a property to assign imported transactions to.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="qcp-address" className="text-xs">Address</Label>
            <Input
              id="qcp-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="123 Main Street"
              className="h-8 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="qcp-suburb" className="text-xs">Suburb</Label>
              <Input
                id="qcp-suburb"
                value={suburb}
                onChange={(e) => setSuburb(e.target.value)}
                placeholder="Richmond"
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qcp-state" className="text-xs">State</Label>
              <Select value={state} onValueChange={setState}>
                <SelectTrigger id="qcp-state" className="h-8 text-sm">
                  <SelectValue placeholder="State" />
                </SelectTrigger>
                <SelectContent>
                  {STATES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="qcp-postcode" className="text-xs">Postcode</Label>
              <Input
                id="qcp-postcode"
                value={postcode}
                onChange={(e) => setPostcode(e.target.value)}
                placeholder="3121"
                maxLength={4}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qcp-price" className="text-xs">Purchase Price</Label>
              <Input
                id="qcp-price"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
                placeholder="750000"
                className="h-8 text-sm"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="qcp-date" className="text-xs">Contract Date</Label>
            <Input
              id="qcp-date"
              type="date"
              value={contractDate}
              onChange={(e) => setContractDate(e.target.value)}
              className="h-8 text-sm"
            />
          </div>

          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}

          <Button
            type="submit"
            className="w-full"
            size="sm"
            disabled={!isValid || createProperty.isPending}
          >
            {createProperty.isPending ? "Creating..." : "Create Property"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
