"use client";

import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Save, TestTube2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { CategorySelect } from "@/components/transactions/CategorySelect";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";

const matchTypes = [
  { value: "contains", label: "Contains" },
  { value: "equals", label: "Exactly matches" },
  { value: "starts_with", label: "Starts with" },
  { value: "regex", label: "Regular expression" },
] as const;

// Use simple string types for form state (no transforms) to keep react-hook-form happy.
// Transformations happen in handleSubmit before calling the API.
const ruleFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  merchantPattern: z.string().max(200),
  descriptionPattern: z.string().max(200),
  matchType: z.enum(["contains", "equals", "starts_with", "regex"]),
  amountMin: z.string(),
  amountMax: z.string(),
  targetCategory: z.string().min(1, "Category is required"),
  targetPropertyId: z.string(),
  priority: z.number().int().min(0).max(100),
  isActive: z.boolean(),
});

type RuleFormValues = z.infer<typeof ruleFormSchema>;

interface RuleFormProps {
  initialValues?: {
    id?: string;
    name: string;
    merchantPattern: string | null;
    descriptionPattern: string | null;
    matchType: string;
    amountMin: number | null;
    amountMax: number | null;
    targetCategory: string;
    targetPropertyId: string | null;
    priority: number;
    isActive: boolean;
  };
  onSuccess: () => void;
  onCancel: () => void;
}

export function RuleForm({ initialValues, onSuccess, onCancel }: RuleFormProps) {
  const [testResults, setTestResults] = useState<{
    matchCount: number;
    matches: Array<{ id: string; description: string | null; amount: string; category: string }>;
  } | null>(null);

  const isEditing = !!initialValues?.id;

  const form = useForm<RuleFormValues>({
    resolver: zodResolver(ruleFormSchema),
    defaultValues: {
      name: initialValues?.name ?? "",
      merchantPattern: initialValues?.merchantPattern ?? "",
      descriptionPattern: initialValues?.descriptionPattern ?? "",
      matchType: (initialValues?.matchType ?? "contains") as RuleFormValues["matchType"],
      amountMin: initialValues?.amountMin?.toString() ?? "",
      amountMax: initialValues?.amountMax?.toString() ?? "",
      targetCategory: initialValues?.targetCategory ?? "",
      targetPropertyId: initialValues?.targetPropertyId ?? "",
      priority: initialValues?.priority ?? 0,
      isActive: initialValues?.isActive ?? true,
    },
  });

  const utils = trpc.useUtils();
  const createMutation = trpc.categorizationRules.create.useMutation({
    onSuccess: () => {
      toast.success("Rule created");
      utils.categorizationRules.list.invalidate();
      onSuccess();
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const updateMutation = trpc.categorizationRules.update.useMutation({
    onSuccess: () => {
      toast.success("Rule updated");
      utils.categorizationRules.list.invalidate();
      onSuccess();
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const testQuery = trpc.categorizationRules.test.useQuery(
    {
      rule: {
        name: form.getValues("name") || "Test Rule",
        merchantPattern: form.getValues("merchantPattern") || null,
        descriptionPattern: form.getValues("descriptionPattern") || null,
        matchType: form.getValues("matchType"),
        amountMin: form.getValues("amountMin") ? parseInt(form.getValues("amountMin"), 10) : null,
        amountMax: form.getValues("amountMax") ? parseInt(form.getValues("amountMax"), 10) : null,
        targetCategory: form.getValues("targetCategory") || "uncategorized",
        targetPropertyId: null,
        priority: form.getValues("priority"),
        isActive: true,
      },
      limit: 50,
    },
    { enabled: false },
  );

  const isSaving = createMutation.isPending || updateMutation.isPending;

  function handleSubmit(values: RuleFormValues) {
    const merchantPattern = values.merchantPattern || null;
    const descriptionPattern = values.descriptionPattern || null;

    if (!merchantPattern && !descriptionPattern) {
      form.setError("merchantPattern", {
        message: "At least one pattern (merchant or description) is required",
      });
      return;
    }

    const payload = {
      name: values.name,
      merchantPattern,
      descriptionPattern,
      matchType: values.matchType,
      amountMin: values.amountMin ? parseInt(values.amountMin, 10) : null,
      amountMax: values.amountMax ? parseInt(values.amountMax, 10) : null,
      targetCategory: values.targetCategory,
      targetPropertyId: values.targetPropertyId || null,
      priority: values.priority,
      isActive: values.isActive,
    };

    if (isEditing && initialValues?.id) {
      updateMutation.mutate({ id: initialValues.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  async function handleTestRule() {
    try {
      const result = await testQuery.refetch();
      if (result.data) {
        setTestResults(result.data);
      }
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Rule name</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Body Corporate Payments" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="merchantPattern"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Merchant pattern</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Body Corporate" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormDescription>Match against the transaction merchant/description</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="descriptionPattern"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description pattern</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. quarterly levy" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormDescription>Additional description text to match</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <FormField
            control={form.control}
            name="matchType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Match type</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {matchTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
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
            name="targetCategory"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Target category</FormLabel>
                <FormControl>
                  <CategorySelect
                    value={field.value}
                    onValueChange={field.onChange}
                    placeholder="Select category"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="priority"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Priority</FormLabel>
                <FormControl>
                  <Input type="number" min={0} max={100} {...field} />
                </FormControl>
                <FormDescription>Higher = checked first</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="amountMin"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Min amount (optional)</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="e.g. -500" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="amountMax"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Max amount (optional)</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="e.g. -100" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="isActive"
          render={({ field }) => (
            <FormItem className="flex items-center gap-3">
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
              <Label>Active</Label>
            </FormItem>
          )}
        />

        {testResults && (
          <div className="rounded-md border p-4 bg-muted/50">
            <p className="text-sm font-medium mb-2">
              Test results: {testResults.matchCount} transaction{testResults.matchCount !== 1 ? "s" : ""} would match
            </p>
            {testResults.matches.length > 0 && (
              <ul className="text-sm text-muted-foreground space-y-1 max-h-40 overflow-y-auto">
                {testResults.matches.slice(0, 10).map((match) => (
                  <li key={match.id} className="flex justify-between">
                    <span className="truncate">{match.description}</span>
                    <span className="ml-2 tabular-nums">${match.amount}</span>
                  </li>
                ))}
                {testResults.matches.length > 10 && (
                  <li className="text-muted-foreground">
                    ...and {testResults.matches.length - 10} more
                  </li>
                )}
              </ul>
            )}
          </div>
        )}

        <div className="flex justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={handleTestRule}
            disabled={testQuery.isFetching}
          >
            {testQuery.isFetching ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <TestTube2 className="w-4 h-4 mr-2" />
            )}
            Test rule
          </Button>

          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              {isEditing ? "Update rule" : "Create rule"}
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
}
