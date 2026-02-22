"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, ListFilter, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { DataSkeleton } from "@/components/ui/data-skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";
import { getCategoryLabel } from "@/lib/categories";
import { RuleForm } from "./RuleForm";

const matchTypeLabels: Record<string, string> = {
  contains: "Contains",
  equals: "Equals",
  starts_with: "Starts with",
  regex: "Regex",
};

export function RulesList() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<{
    id: string;
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
  } | null>(null);
  const [deletingRuleId, setDeletingRuleId] = useState<string | null>(null);

  const utils = trpc.useUtils();
  const rulesQuery = trpc.categorizationRules.list.useQuery();

  const toggleMutation = trpc.categorizationRules.update.useMutation({
    onSuccess: () => {
      utils.categorizationRules.list.invalidate();
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const deleteMutation = trpc.categorizationRules.delete.useMutation({
    onSuccess: () => {
      toast.success("Rule deleted");
      utils.categorizationRules.list.invalidate();
      setDeletingRuleId(null);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  function handleToggleActive(ruleId: string, isActive: boolean) {
    toggleMutation.mutate({ id: ruleId, isActive });
  }

  function handleEdit(rule: NonNullable<typeof editingRule>) {
    setEditingRule(rule);
    setIsFormOpen(true);
  }

  function handleCloseForm() {
    setIsFormOpen(false);
    setEditingRule(null);
  }

  if (rulesQuery.isLoading) {
    return <DataSkeleton variant="list" count={3} />;
  }

  if (rulesQuery.error) {
    return <ErrorState message="Failed to load rules" onRetry={() => rulesQuery.refetch()} />;
  }

  const rules = rulesQuery.data ?? [];

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Categorisation Rules</CardTitle>
          <CardDescription>
            Automatically categorise transactions based on merchant name, description, or amount.
            Rules are checked before AI categorisation.
          </CardDescription>
          <CardAction>
            <Button onClick={() => { setEditingRule(null); setIsFormOpen(true); }} size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Add rule
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          {rules.length === 0 ? (
            <EmptyState
              icon={ListFilter}
              title="No categorisation rules"
              description="Create rules to automatically categorise transactions based on patterns."
              action={{
                label: "Create your first rule",
                onClick: () => { setEditingRule(null); setIsFormOpen(true); },
              }}
            />
          ) : (
            <div className="space-y-3">
              {rules.map((rule) => (
                <div
                  key={rule.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium truncate">{rule.name}</span>
                      <Badge variant={rule.isActive ? "default" : "secondary"}>
                        {rule.isActive ? "Active" : "Inactive"}
                      </Badge>
                      {rule.priority > 0 && (
                        <Badge variant="outline">Priority {rule.priority}</Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground space-y-0.5">
                      {rule.merchantPattern && (
                        <p>
                          Merchant {matchTypeLabels[rule.matchType] ?? rule.matchType}:{" "}
                          <code className="bg-muted px-1 rounded text-xs">{rule.merchantPattern}</code>
                        </p>
                      )}
                      {rule.descriptionPattern && (
                        <p>
                          Description {matchTypeLabels[rule.matchType] ?? rule.matchType}:{" "}
                          <code className="bg-muted px-1 rounded text-xs">{rule.descriptionPattern}</code>
                        </p>
                      )}
                      {(rule.amountMin !== null || rule.amountMax !== null) && (
                        <p>
                          Amount: {rule.amountMin !== null ? `$${rule.amountMin}` : "any"} to{" "}
                          {rule.amountMax !== null ? `$${rule.amountMax}` : "any"}
                        </p>
                      )}
                      <p className="flex items-center gap-1">
                        <Zap className="w-3 h-3" />
                        {getCategoryLabel(rule.targetCategory)}
                        {rule.matchCount > 0 && (
                          <span className="text-xs">
                            ({rule.matchCount} match{rule.matchCount !== 1 ? "es" : ""})
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-4 shrink-0">
                    <Switch
                      checked={rule.isActive}
                      onCheckedChange={(checked) => handleToggleActive(rule.id, checked)}
                    />
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleEdit(rule)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setDeletingRuleId(rule.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isFormOpen} onOpenChange={(open) => { if (!open) handleCloseForm(); }}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{editingRule ? "Edit rule" : "Create categorisation rule"}</DialogTitle>
          </DialogHeader>
          <RuleForm
            initialValues={editingRule ?? undefined}
            onSuccess={handleCloseForm}
            onCancel={handleCloseForm}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deletingRuleId}
        onOpenChange={(open) => { if (!open) setDeletingRuleId(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete rule?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this categorisation rule. Existing categorised transactions will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (deletingRuleId) deleteMutation.mutate({ id: deletingRuleId });
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
