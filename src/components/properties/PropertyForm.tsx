"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { positiveAmountSchema, australianPostcodeSchema, suburbSchema } from "@/lib/validation";
import { NumericFormat } from "react-number-format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { cn } from "@/lib/utils";
import { AddressAutocomplete } from "./AddressAutocomplete";
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

const states = ["NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT"] as const;

const propertyFormSchema = z.object({
  address: z.string().min(1, "Address is required"),
  suburb: z.string().min(1, "Suburb is required").pipe(suburbSchema),
  state: z.enum(states, { error: "State is required" }),
  postcode: australianPostcodeSchema,
  purchasePrice: positiveAmountSchema,
  contractDate: z.string().min(1, "Contract date is required"),
  settlementDate: z.string().optional(),
  entityName: z.string().optional(),
  latitude: z.string().optional(),
  longitude: z.string().optional(),
  purpose: z.enum(["investment", "owner_occupied", "commercial", "short_term_rental"]).optional(),
});

export type PropertyFormValues = z.infer<typeof propertyFormSchema>;

interface EntityOption {
  id: string;
  name: string;
  type: string;
}

interface PropertyFormProps {
  defaultValues?: Partial<PropertyFormValues>;
  onSubmit: (values: PropertyFormValues) => void;
  isLoading?: boolean;
  entities?: EntityOption[];
}

const purposeLabels: Record<string, string> = {
  investment: "Investment",
  owner_occupied: "Owner-Occupied",
  commercial: "Commercial",
  short_term_rental: "Short-Term Rental (Airbnb)",
};

function RequiredMark() {
  return <span className="text-destructive ml-0.5" aria-hidden="true">*</span>;
}

export function PropertyForm({
  defaultValues,
  onSubmit,
  isLoading,
  entities = [],
}: PropertyFormProps) {
  const [highlightedFields, setHighlightedFields] = useState<Set<string>>(new Set());

  const form = useForm<PropertyFormValues>({
    resolver: zodResolver(propertyFormSchema),
    defaultValues: {
      address: "",
      suburb: "",
      state: undefined,
      postcode: "",
      purchasePrice: "",
      contractDate: "",
      settlementDate: "",
      entityName: "Personal",
      latitude: "",
      longitude: "",
      purpose: "investment",
      ...defaultValues,
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        {/* Address */}
        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem data-tour="address-field">
              <FormLabel>Street Address<RequiredMark /></FormLabel>
              <FormControl>
                <AddressAutocomplete
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  name={field.name}
                  onAddressSelected={(result) => {
                    form.setValue("address", result.address, { shouldValidate: true });
                    form.setValue("suburb", result.suburb, { shouldValidate: true });
                    if (result.state) {
                      form.setValue("state", result.state as typeof states[number], { shouldValidate: true });
                    }
                    form.setValue("postcode", result.postcode, { shouldValidate: true });
                    form.setValue("latitude", result.latitude);
                    form.setValue("longitude", result.longitude);

                    // Briefly highlight auto-filled fields
                    const fields = new Set(["suburb", "state", "postcode"]);
                    setHighlightedFields(fields);
                    setTimeout(() => setHighlightedFields(new Set()), 600);
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Location row: Suburb, State, Postcode */}
        <div className="grid grid-cols-4 gap-4">
          <FormField
            control={form.control}
            name="suburb"
            render={({ field }) => (
              <FormItem className={cn("col-span-2", highlightedFields.has("suburb") && "[&_input]:animate-autofill-highlight")}>
                <FormLabel>Suburb<RequiredMark /></FormLabel>
                <FormControl>
                  <Input placeholder="Sydney" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="state"
            render={({ field }) => (
              <FormItem className={cn(highlightedFields.has("state") && "[&_[data-slot=select-trigger]]:animate-autofill-highlight")}>
                <FormLabel>State<RequiredMark /></FormLabel>
                <Select onValueChange={field.onChange} value={field.value ?? ""}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {states.map((state) => (
                      <SelectItem key={state} value={state}>
                        {state}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="postcode"
            render={({ field }) => (
              <FormItem className={cn(highlightedFields.has("postcode") && "[&_input]:animate-autofill-highlight")}>
                <FormLabel>Postcode<RequiredMark /></FormLabel>
                <FormControl>
                  <NumericFormat customInput={Input} placeholder="2000" allowNegative={false} decimalScale={0} maxLength={4} value={field.value} onValueChange={(values) => field.onChange(values.value)} onBlur={field.onBlur} name={field.name} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Purchase details row: Price + Entity */}
        <div className="grid grid-cols-2 gap-4" data-tour="purchase-details">
          <FormField
            control={form.control}
            name="purchasePrice"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Purchase Price ($)<RequiredMark /></FormLabel>
                <FormControl>
                  <NumericFormat customInput={Input} placeholder="0" thousandSeparator="," allowNegative={false} decimalScale={0} value={field.value} onValueChange={(values) => field.onChange(values.value)} onBlur={field.onBlur} name={field.name} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="entityName"
            render={({ field }) => (
              <FormItem data-tour="property-type">
                <FormLabel>Entity</FormLabel>
                <Select onValueChange={field.onChange} value={field.value || "Personal"}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select entity" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Personal">Personal</SelectItem>
                    {entities.map((entity) => (
                      <SelectItem key={entity.id} value={entity.name}>
                        {entity.name} ({entity.type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Purpose */}
        <FormField
          control={form.control}
          name="purpose"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Purpose</FormLabel>
              <Select onValueChange={field.onChange} value={field.value || "investment"}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select purpose" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {Object.entries(purposeLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Dates row: Contract Date + Settlement Date */}
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="contractDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Contract Date<RequiredMark /></FormLabel>
                <FormControl>
                  <DatePicker value={field.value} onChange={field.onChange} />
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
                  <DatePicker value={field.value ?? ""} onChange={field.onChange} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Saving..." : "Save Property"}
        </Button>
      </form>
    </Form>
  );
}
