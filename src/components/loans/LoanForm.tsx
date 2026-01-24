"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
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

const loanFormSchema = z.object({
  propertyId: z.string().uuid("Please select a property"),
  lender: z.string().min(1, "Lender is required"),
  accountNumberMasked: z.string().optional(),
  loanType: z.enum(["principal_and_interest", "interest_only"]),
  rateType: z.enum(["variable", "fixed", "split"]),
  originalAmount: z.string().regex(/^\d+\.?\d*$/, "Invalid amount"),
  currentBalance: z.string().regex(/^\d+\.?\d*$/, "Invalid amount"),
  interestRate: z.string().regex(/^\d+\.?\d*$/, "Invalid rate"),
  fixedRateExpiry: z.string().optional(),
  repaymentAmount: z.string().regex(/^\d+\.?\d*$/, "Invalid amount"),
  repaymentFrequency: z.enum(["weekly", "fortnightly", "monthly"]),
});

export type LoanFormValues = z.infer<typeof loanFormSchema>;

interface LoanFormProps {
  defaultValues?: Partial<LoanFormValues>;
  onSubmit: (values: LoanFormValues) => void;
  isLoading?: boolean;
}

export function LoanForm({ defaultValues, onSubmit, isLoading }: LoanFormProps) {
  const { data: properties } = trpc.property.list.useQuery();

  const form = useForm<LoanFormValues>({
    resolver: zodResolver(loanFormSchema),
    defaultValues: {
      propertyId: "",
      lender: "",
      accountNumberMasked: "",
      loanType: "principal_and_interest",
      rateType: "variable",
      originalAmount: "",
      currentBalance: "",
      interestRate: "",
      fixedRateExpiry: "",
      repaymentAmount: "",
      repaymentFrequency: "monthly",
      ...defaultValues,
    },
  });

  const rateType = form.watch("rateType");

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="propertyId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Property</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select property" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {properties?.map((property) => (
                    <SelectItem key={property.id} value={property.id}>
                      {property.address}, {property.suburb}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="lender"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Lender</FormLabel>
                <FormControl>
                  <Input placeholder="Commonwealth Bank" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="accountNumberMasked"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Account Number (optional)</FormLabel>
                <FormControl>
                  <Input placeholder="****1234" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="loanType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Loan Type</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="principal_and_interest">
                      Principal & Interest
                    </SelectItem>
                    <SelectItem value="interest_only">Interest Only</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="rateType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Rate Type</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="variable">Variable</SelectItem>
                    <SelectItem value="fixed">Fixed</SelectItem>
                    <SelectItem value="split">Split</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="originalAmount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Original Loan Amount ($)</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="500000" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="currentBalance"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Current Balance ($)</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="450000" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="interestRate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Interest Rate (%)</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" placeholder="6.5" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {(rateType === "fixed" || rateType === "split") && (
            <FormField
              control={form.control}
              name="fixedRateExpiry"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fixed Rate Expiry</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="repaymentAmount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Repayment Amount ($)</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="2500" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="repaymentFrequency"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Repayment Frequency</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="fortnightly">Fortnightly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Saving..." : "Save Loan"}
        </Button>
      </form>
    </Form>
  );
}
