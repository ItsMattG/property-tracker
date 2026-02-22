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
import { calculateYearlyDeduction } from "@/lib/depreciation";

interface Asset {
  assetName: string;
  category: "plant_equipment" | "capital_works";
  originalCost: number;
  effectiveLife: number;
  method: "diminishing_value" | "prime_cost";
  yearlyDeduction: number;
  discrepancy?: boolean;
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
    <>
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
                    onValueChange={(v) => {
                      onUpdate?.(index, "category", v);
                      if (v === "capital_works") {
                        onUpdate?.(index, "method", "prime_cost");
                        onUpdate?.(index, "effectiveLife", 40);
                        onUpdate?.(index, "yearlyDeduction", calculateYearlyDeduction(asset.originalCost, 40, "prime_cost"));
                      }
                    }}
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
                    onChange={(e) => {
                      const newCost = parseFloat(e.target.value) || 0;
                      onUpdate?.(index, "originalCost", newCost);
                      onUpdate?.(index, "yearlyDeduction", calculateYearlyDeduction(newCost, asset.effectiveLife, asset.method));
                    }}
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
                    onChange={(e) => {
                      const newLife = parseFloat(e.target.value) || 0;
                      onUpdate?.(index, "effectiveLife", newLife);
                      onUpdate?.(index, "yearlyDeduction", calculateYearlyDeduction(asset.originalCost, newLife, asset.method));
                    }}
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
                    onValueChange={(v) => {
                      onUpdate?.(index, "method", v);
                      onUpdate?.(index, "yearlyDeduction", calculateYearlyDeduction(
                        asset.originalCost,
                        asset.effectiveLife,
                        v as "diminishing_value" | "prime_cost"
                      ));
                    }}
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
                <div className="flex items-center justify-end gap-1">
                  {asset.discrepancy && (
                    <span className="text-xs text-amber-500" title="Adjusted from AI estimate">*</span>
                  )}
                  {formatCurrency(asset.yearlyDeduction)}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
    {editable && (
      <p className="text-xs text-muted-foreground mt-2">
        * Capital works are typically depreciated at 2.5% (prime cost) over 40 years per ATO rules.
      </p>
    )}
    </>
  );
}
