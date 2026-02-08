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
  purchaseDate: z.string().min(1, "Purchase date is required"),
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
      purchaseDate: "",
      entityName: "Personal",
      ...defaultValues,
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem data-tour="address-field">
              <FormLabel>Street Address</FormLabel>
              <FormControl>
                <Input placeholder="123 Smith Street" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="suburb"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Suburb</FormLabel>
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
                <FormLabel>State</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select state" />
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
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="postcode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Postcode</FormLabel>
                <FormControl>
                  <NumericFormat customInput={Input} placeholder="2000" allowNegative={false} decimalScale={0} maxLength={4} value={field.value} onValueChange={(values) => field.onChange(values.value)} onBlur={field.onBlur} name={field.name} />
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

        <div className="grid grid-cols-2 gap-4" data-tour="purchase-details">
          <FormField
            control={form.control}
            name="purchasePrice"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Purchase Price ($)</FormLabel>
                <FormControl>
                  <NumericFormat customInput={Input} placeholder="500000" allowNegative={false} decimalScale={0} value={field.value} onValueChange={(values) => field.onChange(values.value)} onBlur={field.onBlur} name={field.name} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="purchaseDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Purchase Date</FormLabel>
                <FormControl>
                  <DatePicker value={field.value} onChange={field.onChange} placeholder="Select purchase date" />
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
