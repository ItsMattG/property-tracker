"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { NumericFormat } from "react-number-format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
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
  suburb: z.string().min(1, "Suburb is required").regex(/^[a-zA-Z\s\-']+$/, "Suburb must only contain letters"),
  state: z.enum(states, { error: "State is required" }),
  postcode: z.string().regex(/^\d{4}$/, "Invalid postcode (must be 4 digits)"),
  purchasePrice: z.string().regex(/^\d+\.?\d*$/, "Invalid price"),
  contractDate: z.string().min(1, "Contract date is required"),
  settlementDate: z.string().optional(),
  entityName: z.string().optional(),
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

function RequiredMark() {
  return <span className="text-destructive ml-0.5" aria-hidden="true">*</span>;
}

export function PropertyForm({
  defaultValues,
  onSubmit,
  isLoading,
  entities = [],
}: PropertyFormProps) {
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
                <Input placeholder="123 Smith Street" {...field} />
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
              <FormItem className="col-span-2">
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
              <FormItem>
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
              <FormItem>
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
                  <NumericFormat customInput={Input} placeholder="500,000" thousandSeparator="," allowNegative={false} decimalScale={0} value={field.value} onValueChange={(values) => field.onChange(values.value)} onBlur={field.onBlur} name={field.name} />
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
