"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import { Loader2 } from "lucide-react";

const recordSaleSchema = z.object({
  salePrice: z.string().min(1, "Sale price is required"),
  settlementDate: z.string().min(1, "Settlement date is required"),
  contractDate: z.string(),
  agentCommission: z.string(),
  legalFees: z.string(),
  marketingCosts: z.string(),
  otherSellingCosts: z.string(),
});

type RecordSaleFormValues = z.infer<typeof recordSaleSchema>;

interface RecordSaleDialogProps {
  propertyId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function RecordSaleDialog({
  propertyId,
  open,
  onOpenChange,
  onSuccess,
}: RecordSaleDialogProps) {
  const [preview, setPreview] = useState<{
    costBase: number;
    capitalGain: number;
    discountedGain: number;
    heldOverTwelveMonths: boolean;
  } | null>(null);

  const { data: costBaseData } = trpc.cgt.getCostBase.useQuery({ propertyId });

  const recordSale = trpc.cgt.recordSale.useMutation({
    onSuccess: () => {
      toast.success("Property sale recorded successfully");
      onSuccess();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to record sale");
    },
  });

  const form = useForm<RecordSaleFormValues>({
    resolver: zodResolver(recordSaleSchema),
    defaultValues: {
      salePrice: "",
      settlementDate: "",
      contractDate: "",
      agentCommission: "0",
      legalFees: "0",
      marketingCosts: "0",
      otherSellingCosts: "0",
    },
  });

  const watchedValues = form.watch();

  const calculatePreview = () => {
    if (!costBaseData || !watchedValues.salePrice || !watchedValues.settlementDate) {
      setPreview(null);
      return;
    }

    const salePrice = Number(watchedValues.salePrice) || 0;
    const totalSellingCosts =
      (Number(watchedValues.agentCommission) || 0) +
      (Number(watchedValues.legalFees) || 0) +
      (Number(watchedValues.marketingCosts) || 0) +
      (Number(watchedValues.otherSellingCosts) || 0);

    const netProceeds = salePrice - totalSellingCosts;
    const capitalGain = netProceeds - costBaseData.totalCostBase;

    const purchaseDate = new Date(costBaseData.purchaseDate);
    const settlementDate = new Date(watchedValues.settlementDate);
    const monthsHeld =
      (settlementDate.getFullYear() - purchaseDate.getFullYear()) * 12 +
      (settlementDate.getMonth() - purchaseDate.getMonth());
    const heldOverTwelveMonths = monthsHeld >= 12;

    const discountedGain =
      heldOverTwelveMonths && capitalGain > 0 ? capitalGain * 0.5 : capitalGain;

    setPreview({
      costBase: costBaseData.totalCostBase,
      capitalGain,
      discountedGain,
      heldOverTwelveMonths,
    });
  };

  const onSubmit = (values: RecordSaleFormValues) => {
    recordSale.mutate({
      propertyId,
      ...values,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Record Property Sale</DialogTitle>
          <DialogDescription>
            Enter the sale details to calculate your capital gain/loss.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="salePrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sale Price</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="0"
                        {...field}
                        onBlur={() => {
                          field.onBlur();
                          calculatePreview();
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="settlementDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Settlement Date</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        onBlur={() => {
                          field.onBlur();
                          calculatePreview();
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="contractDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contract Date (Optional)</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">Selling Costs</h4>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="agentCommission"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Agent Commission</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="0"
                          {...field}
                          onBlur={() => {
                            field.onBlur();
                            calculatePreview();
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="legalFees"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Legal Fees</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="0"
                          {...field}
                          onBlur={() => {
                            field.onBlur();
                            calculatePreview();
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="marketingCosts"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Marketing Costs</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="0"
                          {...field}
                          onBlur={() => {
                            field.onBlur();
                            calculatePreview();
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="otherSellingCosts"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Other Costs</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="0"
                          {...field}
                          onBlur={() => {
                            field.onBlur();
                            calculatePreview();
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {preview && (
              <div className="border rounded-lg p-4 bg-muted/50 space-y-2">
                <h4 className="font-medium">CGT Preview</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="text-muted-foreground">Cost Base:</span>
                  <span>{formatCurrency(preview.costBase)}</span>
                  <span className="text-muted-foreground">Capital {preview.capitalGain >= 0 ? "Gain" : "Loss"}:</span>
                  <span className={preview.capitalGain >= 0 ? "text-green-600" : "text-red-600"}>
                    {formatCurrency(Math.abs(preview.capitalGain))}
                  </span>
                  {preview.heldOverTwelveMonths && preview.capitalGain > 0 && (
                    <>
                      <span className="text-muted-foreground">50% Discount Applied:</span>
                      <span className="text-green-600">{formatCurrency(preview.discountedGain)}</span>
                    </>
                  )}
                  <span className="text-muted-foreground">Held Over 12 Months:</span>
                  <span>{preview.heldOverTwelveMonths ? "Yes" : "No"}</span>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={recordSale.isPending}>
                {recordSale.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Record Sale
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
