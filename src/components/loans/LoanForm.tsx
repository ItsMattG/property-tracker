"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { positiveAmountSchema } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PropertySelect } from "@/components/properties/PropertySelect";

const loanFormSchema = z.object({
  propertyId: z.string().uuid("Please select a property"),
  lender: z.string().min(1, "Lender is required"),
  accountNumberMasked: z.string().optional(),
  loanType: z.enum(["principal_and_interest", "interest_only"]),
  rateType: z.enum(["variable", "fixed", "split"]),
  originalAmount: positiveAmountSchema,
  currentBalance: positiveAmountSchema,
  interestRate: positiveAmountSchema,
  fixedRateExpiry: z.string().optional(),
  repaymentAmount: positiveAmountSchema,
  repaymentFrequency: z.enum(["weekly", "fortnightly", "monthly"]),
});

export type LoanFormValues = z.infer<typeof loanFormSchema>;

interface LoanFormProps {
  defaultValues?: Partial<LoanFormValues>;
  onSubmit: (values: LoanFormValues) => void;
  isLoading?: boolean;
}

function RequiredMark() {
  return <span className="text-destructive ml-0.5" aria-hidden="true">*</span>;
}

export function LoanForm({ defaultValues, onSubmit, isLoading }: LoanFormProps) {
  const router = useRouter();

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
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        {/* Property */}
        <FormField
          control={form.control}
          name="propertyId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Property<RequiredMark /></FormLabel>
              <PropertySelect value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select property" />
                  </SelectTrigger>
                </FormControl>
              </PropertySelect>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Lender details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="lender"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Lender<RequiredMark /></FormLabel>
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
                <FormLabel>Account Number</FormLabel>
                <FormControl>
                  <Input placeholder="****1234" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Loan structure */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
          <FormField
            control={form.control}
            name="loanType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Loan Type<RequiredMark /></FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger className="w-full">
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
                <FormDescription>
                  P&I: builds equity over time. IO: lower payments, no equity built.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="rateType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Rate Type<RequiredMark /></FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger className="w-full">
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

        {/* Amounts */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="originalAmount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Original Loan Amount ($)<RequiredMark /></FormLabel>
                <FormControl>
                  <Input type="number" placeholder="0" {...field} />
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
                <FormLabel>Current Balance ($)<RequiredMark /></FormLabel>
                <FormControl>
                  <Input type="number" placeholder="0" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Interest rate + fixed expiry */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
          <FormField
            control={form.control}
            name="interestRate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Interest Rate (%)<RequiredMark /></FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" placeholder="6.5" {...field} />
                </FormControl>
                <FormDescription>
                  Annual interest rate (e.g., 6.5 for 6.5% p.a.)
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {(rateType === "fixed" || rateType === "split") ? (
            <FormField
              control={form.control}
              name="fixedRateExpiry"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fixed Rate Expiry</FormLabel>
                  <FormControl>
                    <DatePicker value={field.value} onChange={field.onChange} placeholder="Select expiry date" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ) : (
            <div />
          )}
        </div>

        {/* Repayments */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="repaymentAmount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Repayment Amount ($)<RequiredMark /></FormLabel>
                <FormControl>
                  <Input type="number" placeholder="0" {...field} />
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
                <FormLabel>Repayment Frequency<RequiredMark /></FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger className="w-full">
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

        <div className="flex items-center gap-3 pt-2">
          <Button type="submit" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Loan"
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/loans")}
          >
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  );
}
