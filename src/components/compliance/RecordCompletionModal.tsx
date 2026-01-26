"use client";

import { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";

interface RecordCompletionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId: string;
  requirementId: string;
  requirementName: string;
  onSuccess?: () => void;
}

export function RecordCompletionModal({
  open,
  onOpenChange,
  propertyId,
  requirementId,
  requirementName,
  onSuccess,
}: RecordCompletionModalProps) {
  const [date, setDate] = useState<Date>(new Date());
  const [notes, setNotes] = useState("");

  const utils = trpc.useUtils();

  const recordMutation = trpc.compliance.recordCompletion.useMutation({
    onSuccess: (data) => {
      toast.success(`Recorded completion. Next due: ${format(new Date(data.nextDueAt), "dd MMM yyyy")}`);
      utils.compliance.getPropertyCompliance.invalidate({ propertyId });
      utils.compliance.getPortfolioCompliance.invalidate();
      onOpenChange(false);
      setDate(new Date());
      setNotes("");
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = () => {
    recordMutation.mutate({
      propertyId,
      requirementId,
      completedAt: format(date, "yyyy-MM-dd"),
      notes: notes || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record Completion</DialogTitle>
          <DialogDescription>
            Record when this compliance requirement was completed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <p className="text-sm text-muted-foreground">Requirement</p>
            <p className="font-medium">{requirementName}</p>
          </div>

          <div className="space-y-2">
            <Label>Completion Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "PPP") : "Select date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => d && setDate(d)}
                  disabled={(d) => d > new Date()}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Textarea
              placeholder="e.g., Replaced batteries in all alarms"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={recordMutation.isPending}>
            {recordMutation.isPending ? "Saving..." : "Record Completion"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
