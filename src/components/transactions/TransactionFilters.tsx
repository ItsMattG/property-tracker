"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { categories } from "@/lib/categories";
import type { Property } from "@/server/db/schema";

interface TransactionFiltersProps {
  properties: Property[];
  filters: {
    propertyId?: string;
    category?: string;
    startDate?: string;
    endDate?: string;
    isVerified?: boolean;
  };
  onFiltersChange: (filters: TransactionFiltersProps["filters"]) => void;
}

export function TransactionFilters({
  properties,
  filters,
  onFiltersChange,
}: TransactionFiltersProps) {
  return (
    <div className="flex flex-wrap gap-4 p-4 bg-card rounded-lg border">
      <div className="space-y-1">
        <Label htmlFor="property-filter">Property</Label>
        <Select
          value={filters.propertyId ?? "all"}
          onValueChange={(value) =>
            onFiltersChange({
              ...filters,
              propertyId: value === "all" ? undefined : value,
            })
          }
        >
          <SelectTrigger id="property-filter" className="w-[200px]">
            <SelectValue placeholder="All properties" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All properties</SelectItem>
            {properties.map((property) => (
              <SelectItem key={property.id} value={property.id}>
                {property.address}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label htmlFor="category-filter">Category</Label>
        <Select
          value={filters.category ?? "all"}
          onValueChange={(value) =>
            onFiltersChange({
              ...filters,
              category: value === "all" ? undefined : value,
            })
          }
        >
          <SelectTrigger id="category-filter" className="w-[200px]">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.value} value={cat.value}>
                {cat.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label htmlFor="verified-filter">Status</Label>
        <Select
          value={
            filters.isVerified === undefined
              ? "all"
              : filters.isVerified
                ? "verified"
                : "unverified"
          }
          onValueChange={(value) =>
            onFiltersChange({
              ...filters,
              isVerified:
                value === "all" ? undefined : value === "verified",
            })
          }
        >
          <SelectTrigger id="verified-filter" className="w-[150px]">
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="verified">Verified</SelectItem>
            <SelectItem value="unverified">Unverified</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label htmlFor="start-date">From</Label>
        <Input
          id="start-date"
          type="date"
          value={filters.startDate ?? ""}
          onChange={(e) =>
            onFiltersChange({
              ...filters,
              startDate: e.target.value || undefined,
            })
          }
          className="w-[150px]"
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="end-date">To</Label>
        <Input
          id="end-date"
          type="date"
          value={filters.endDate ?? ""}
          onChange={(e) =>
            onFiltersChange({
              ...filters,
              endDate: e.target.value || undefined,
            })
          }
          className="w-[150px]"
        />
      </div>
    </div>
  );
}
