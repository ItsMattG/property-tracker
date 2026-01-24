"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Asset {
  assetName: string;
  category: "plant_equipment" | "capital_works";
  originalCost: number;
  effectiveLife: number;
  method: "diminishing_value" | "prime_cost";
  yearlyDeduction: number;
}

interface DepreciationTableProps {
  assets: Asset[];
  onUpdate?: (index: number, field: string, value: string | number) => void;
  editable?: boolean;
}

export function DepreciationTable({
  assets,
  onUpdate,
  editable = false,
}: DepreciationTableProps) {
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
    }).format(amount);

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Asset</TableHead>
            <TableHead>Category</TableHead>
            <TableHead className="text-right">Cost</TableHead>
            <TableHead className="text-right">Life (yrs)</TableHead>
            <TableHead>Method</TableHead>
            <TableHead className="text-right">Annual Deduction</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {assets.map((asset, index) => (
            <TableRow key={index}>
              <TableCell className="max-w-[200px]">
                {editable ? (
                  <Input
                    value={asset.assetName}
                    onChange={(e) => onUpdate?.(index, "assetName", e.target.value)}
                    className="h-8"
                  />
                ) : (
                  <span className="truncate">{asset.assetName}</span>
                )}
              </TableCell>
              <TableCell>
                {editable ? (
                  <Select
                    value={asset.category}
                    onValueChange={(v) => onUpdate?.(index, "category", v)}
                  >
                    <SelectTrigger className="h-8 w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="plant_equipment">Plant & Equipment</SelectItem>
                      <SelectItem value="capital_works">Capital Works</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  asset.category === "plant_equipment" ? "Plant & Equipment" : "Capital Works"
                )}
              </TableCell>
              <TableCell className="text-right">
                {editable ? (
                  <Input
                    type="number"
                    value={asset.originalCost}
                    onChange={(e) => onUpdate?.(index, "originalCost", parseFloat(e.target.value) || 0)}
                    className="h-8 w-24 text-right"
                  />
                ) : (
                  formatCurrency(asset.originalCost)
                )}
              </TableCell>
              <TableCell className="text-right">
                {editable ? (
                  <Input
                    type="number"
                    value={asset.effectiveLife}
                    onChange={(e) => onUpdate?.(index, "effectiveLife", parseFloat(e.target.value) || 0)}
                    className="h-8 w-16 text-right"
                  />
                ) : (
                  asset.effectiveLife
                )}
              </TableCell>
              <TableCell>
                {editable ? (
                  <Select
                    value={asset.method}
                    onValueChange={(v) => onUpdate?.(index, "method", v)}
                  >
                    <SelectTrigger className="h-8 w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="diminishing_value">Diminishing Value</SelectItem>
                      <SelectItem value="prime_cost">Prime Cost</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  asset.method === "diminishing_value" ? "Diminishing Value" : "Prime Cost"
                )}
              </TableCell>
              <TableCell className="text-right font-medium">
                {formatCurrency(asset.yearlyDeduction)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
