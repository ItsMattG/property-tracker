"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc/client";
import { formatCurrency, formatDate } from "@/lib/utils";
import { toast } from "sonner";
import { Trash2, History } from "lucide-react";

interface ValuationHistoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId: string;
}

const getSourceLabel = (source: string): string => {
  const labels: Record<string, string> = {
    manual: "Manual",
    mock: "Estimated",
    corelogic: "CoreLogic",
    proptrack: "PropTrack",
  };
  return labels[source] || source;
};

const getSourceVariant = (source: string): "default" | "secondary" | "outline" => {
  switch (source) {
    case "corelogic":
    case "proptrack":
      return "default";
    case "manual":
      return "secondary";
    default:
      return "outline";
  }
};

export function ValuationHistoryModal({
  open,
  onOpenChange,
  propertyId,
}: ValuationHistoryModalProps) {
  const utils = trpc.useUtils();

  const { data: valuations, isLoading } = trpc.propertyValue.list.useQuery(
    { propertyId },
    { enabled: open }
  );

  const deleteMutation = trpc.propertyValue.delete.useMutation({
    onSuccess: () => {
      toast.success("Valuation deleted successfully");
      utils.propertyValue.list.invalidate({ propertyId });
      utils.propertyValue.getCurrent.invalidate({ propertyId });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete valuation");
    },
  });

  const handleDelete = (id: string) => {
    deleteMutation.mutate({ id });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            Valuation History
          </DialogTitle>
          <DialogDescription>
            View all recorded property valuations.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto -mx-6 px-6">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="animate-pulse p-4 border rounded-lg space-y-2"
                >
                  <div className="h-5 bg-muted rounded w-1/3" />
                  <div className="h-4 bg-muted rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : !valuations || valuations.length === 0 ? (
            <div className="text-center py-8">
              <History className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">No valuation history yet.</p>
              <p className="text-sm text-muted-foreground">
                Add a manual valuation or refresh to get an estimate.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {valuations.map((valuation) => (
                <div
                  key={valuation.id}
                  className="p-4 border rounded-lg space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-lg">
                          {formatCurrency(parseFloat(valuation.estimatedValue))}
                        </span>
                        <Badge variant={getSourceVariant(valuation.source)}>
                          {getSourceLabel(valuation.source)}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(valuation.valueDate)}
                      </p>
                    </div>

                    {valuation.source === "manual" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                        onClick={() => handleDelete(valuation.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="w-4 h-4" />
                        <span className="sr-only">Delete valuation</span>
                      </Button>
                    )}
                  </div>

                  {valuation.confidenceLow && valuation.confidenceHigh && (
                    <p className="text-sm text-muted-foreground">
                      Range: {formatCurrency(parseFloat(valuation.confidenceLow))} -{" "}
                      {formatCurrency(parseFloat(valuation.confidenceHigh))}
                    </p>
                  )}

                  {valuation.notes && (
                    <p className="text-sm text-muted-foreground border-t pt-2 mt-2">
                      {valuation.notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
