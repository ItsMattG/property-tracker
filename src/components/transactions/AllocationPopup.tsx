"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CategorySelect } from "./CategorySelect";
import { Home, User, Building2, Briefcase, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

type AccountType = "personal" | "property" | "body_corporate" | "business" | "other";

const accountTypes: { type: AccountType; label: string; icon: typeof Home }[] = [
  { type: "personal", label: "Personal", icon: User },
  { type: "property", label: "Property", icon: Home },
  { type: "body_corporate", label: "Body Corp", icon: Building2 },
  { type: "business", label: "Business", icon: Briefcase },
  { type: "other", label: "Other", icon: MoreHorizontal },
];

interface AllocationPopupProps {
  transactionId: string;
  amount: string;
  description: string;
  properties: { id: string; address?: string | null; suburb?: string | null }[];
  onAllocate: (data: {
    id: string;
    category: string;
    propertyId?: string;
    claimPercent: number;
  }) => void;
  children: React.ReactNode;
}

export function AllocationPopup({
  transactionId,
  amount,
  description,
  properties,
  onAllocate,
  children,
}: AllocationPopupProps) {
  const [open, setOpen] = useState(false);
  const [accountType, setAccountType] = useState<AccountType>("property");
  const [propertyId, setPropertyId] = useState<string>("");
  const [claimPercent, setClaimPercent] = useState(100);
  const [category, setCategory] = useState<string>("");

  const handleAllocate = () => {
    if (!category) return;

    onAllocate({
      id: transactionId,
      category,
      propertyId: accountType === "property" && propertyId ? propertyId : undefined,
      claimPercent,
    });
    setOpen(false);
    // Reset form
    setCategory("");
    setPropertyId("");
    setClaimPercent(100);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium truncate">{description}</p>
            <p className="text-xs text-muted-foreground">
              {new Intl.NumberFormat("en-AU", {
                style: "currency",
                currency: "AUD",
              }).format(parseFloat(amount))}
            </p>
          </div>

          {/* Account type selector */}
          <div className="flex gap-1">
            {accountTypes.map(({ type, label, icon: Icon }) => (
              <button
                key={type}
                onClick={() => setAccountType(type)}
                className={cn(
                  "flex flex-col items-center gap-1 p-2 rounded-lg text-xs flex-1 transition-colors cursor-pointer",
                  accountType === type
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted hover:bg-muted/80 text-muted-foreground"
                )}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>

          {/* Property dropdown (only for property type) */}
          {accountType === "property" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Property</Label>
              <Select value={propertyId} onValueChange={setPropertyId}>
                <SelectTrigger size="sm">
                  <SelectValue placeholder="Select property" />
                </SelectTrigger>
                <SelectContent>
                  {properties.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.address || p.suburb || "Unnamed property"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Claim percent */}
          <div className="space-y-1.5">
            <Label className="text-xs">Claim %</Label>
            <Input
              type="number"
              min={0}
              max={100}
              value={claimPercent}
              onChange={(e) => setClaimPercent(Number(e.target.value))}
              className="h-8"
            />
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <Label className="text-xs">Category</Label>
            <CategorySelect value={category} onValueChange={setCategory} />
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1"
              onClick={handleAllocate}
              disabled={!category}
            >
              Allocate
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
