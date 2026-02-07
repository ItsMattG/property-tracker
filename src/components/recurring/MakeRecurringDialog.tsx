"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";
import { categories, getCategoryLabel } from "@/lib/categories";
import type { Transaction } from "@/server/db/schema";

const frequencyOptions = [
  { value: "weekly", label: "Weekly" },
  { value: "fortnightly", label: "Fortnightly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "annually", label: "Annually" },
];

const dayOfWeekOptions = [
  { value: "0", label: "Sunday" },
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
];

const recurringFormSchema = z.object({
  description: z.string().min(1, "Description is required"),
  amount: z.string().regex(/^\d+\.?\d*$/, "Invalid amount"),
  category: z.string(),
  transactionType: z.enum(["income", "expense", "capital", "transfer", "personal"]),
  frequency: z.enum(["weekly", "fortnightly", "monthly", "quarterly", "annually"]),
  dayOfMonth: z.coerce.number().min(1).max(31).optional(),
  dayOfWeek: z.coerce.number().min(0).max(6).optional(),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().optional(),
  amountTolerance: z.string().regex(/^\d+\.?\d*$/).default("5.00"),
  dateTolerance: z.coerce.number().min(0).max(30).default(3),
  alertDelayDays: z.coerce.number().min(0).max(30).default(3),
  linkedBankAccountId: z.string().uuid().optional(),
});

type RecurringFormValues = z.infer<typeof recurringFormSchema>;

interface MakeRecurringDialogProps {
  transaction: Transaction;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function MakeRecurringDialog({
  transaction,
  open,
  onOpenChange,
  onSuccess,
}: MakeRecurringDialogProps) {
  const utils = trpc.useUtils();
  const { data: bankAccounts } = trpc.banking.listAccounts.useQuery();

  const form = useForm<RecurringFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(recurringFormSchema) as any,
    defaultValues: {
      description: transaction.description,
      amount: Math.abs(Number(transaction.amount)).toString(),
      category: transaction.category,
      transactionType: transaction.transactionType,
      frequency: "monthly",
      dayOfMonth: new Date(transaction.date).getDate(),
      startDate: transaction.date,
      amountTolerance: "5.00",
      dateTolerance: 3,
      alertDelayDays: 3,
      linkedBankAccountId: transaction.bankAccountId ?? undefined,
    },
  });

  const frequency = form.watch("frequency");
  const showDayOfWeek = frequency === "weekly" || frequency === "fortnightly";
  const showDayOfMonth =
    frequency === "monthly" ||
    frequency === "quarterly" ||
    frequency === "annually";

  const createRecurring = trpc.recurring.create.useMutation({
    onSuccess: () => {
      toast.success("Recurring transaction created");
      form.reset();
      onOpenChange(false);
      utils.recurring.list.invalidate();
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create recurring transaction");
    },
  });

  const handleSubmit = (values: RecurringFormValues) => {
    if (!transaction.propertyId) {
      toast.error("Transaction must be assigned to a property");
      return;
    }

    createRecurring.mutate({
      propertyId: transaction.propertyId,
      description: values.description,
      amount: values.amount,
      category: values.category,
      transactionType: values.transactionType,
      frequency: values.frequency,
      dayOfMonth: showDayOfMonth ? values.dayOfMonth : undefined,
      dayOfWeek: showDayOfWeek ? values.dayOfWeek : undefined,
      startDate: values.startDate,
      endDate: values.endDate || undefined,
      amountTolerance: values.amountTolerance,
      dateTolerance: values.dateTolerance,
      alertDelayDays: values.alertDelayDays,
      linkedBankAccountId: values.linkedBankAccountId,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Recurring Transaction</DialogTitle>
          <DialogDescription>
            Set up automatic tracking for this recurring payment or income.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expected Amount ($)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat.value} value={cat.value}>
                            {cat.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="frequency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Frequency</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select frequency" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {frequencyOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {showDayOfWeek && (
              <FormField
                control={form.control}
                name="dayOfWeek"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Day of Week</FormLabel>
                    <Select
                      onValueChange={(v) => field.onChange(Number(v))}
                      value={field.value?.toString()}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select day" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {dayOfWeekOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {showDayOfMonth && (
              <FormField
                control={form.control}
                name="dayOfMonth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Day of Month</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={31}
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormDescription>1-31 (will adjust for shorter months)</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Date</FormLabel>
                    <FormControl>
                      <DatePicker value={field.value} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End Date (optional)</FormLabel>
                    <FormControl>
                      <DatePicker value={field.value} onChange={field.onChange} placeholder="No end date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="border-t pt-4 mt-4">
              <h4 className="text-sm font-medium mb-3">Matching Settings</h4>

              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="amountTolerance"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount Tolerance (%)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.1" min="0" max="100" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="dateTolerance"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date Tolerance (days)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          max="30"
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="alertDelayDays"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Alert Delay (days)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          max="30"
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {bankAccounts && bankAccounts.length > 0 && (
              <FormField
                control={form.control}
                name="linkedBankAccountId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Linked Bank Account (optional)</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Any bank account" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">Any bank account</SelectItem>
                        {bankAccounts.map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.institution} - {account.accountName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Only match transactions from this account
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

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
                disabled={createRecurring.isPending}
              >
                {createRecurring.isPending ? "Creating..." : "Create Recurring"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
