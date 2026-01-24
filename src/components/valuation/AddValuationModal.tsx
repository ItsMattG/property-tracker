"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";

const formSchema = z.object({
  estimatedValue: z.string().regex(/^\d+\.?\d*$/, "Invalid value"),
  valueDate: z.string().min(1, "Date is required"),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface AddValuationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId: string;
  onSuccess: () => void;
}

export function AddValuationModal({
  open,
  onOpenChange,
  propertyId,
  onSuccess,
}: AddValuationModalProps) {
  const form = useForm<FormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      estimatedValue: "",
      valueDate: new Date().toISOString().split("T")[0],
      notes: "",
    },
  });

  const createValuation = trpc.propertyValue.create.useMutation({
    onSuccess: () => {
      toast.success("Valuation added successfully");
      form.reset();
      onOpenChange(false);
      onSuccess();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to add valuation");
    },
  });

  const handleSubmit = (values: FormValues) => {
    createValuation.mutate({
      propertyId,
      estimatedValue: values.estimatedValue,
      valueDate: values.valueDate,
      source: "manual",
      notes: values.notes,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Valuation</DialogTitle>
          <DialogDescription>
            Enter a manual property valuation estimate.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="estimatedValue"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Estimated Value ($)</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="650000" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="valueDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Valuation Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="e.g., Bank valuation, Agent estimate"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={createValuation.isPending}
              >
                {createValuation.isPending ? "Saving..." : "Add Valuation"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
