"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { trpc } from "@/lib/trpc/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
import { Loader2, CheckCircle } from "lucide-react";
import { useState } from "react";

const bugSchema = z.object({
  description: z
    .string()
    .min(10, "Description must be at least 10 characters")
    .max(2000, "Description must be less than 2000 characters"),
  stepsToReproduce: z
    .string()
    .max(2000, "Steps must be less than 2000 characters")
    .optional(),
  severity: z.enum(["low", "medium", "high", "critical"]),
});

type BugFormData = z.infer<typeof bugSchema>;

type Props = {
  open: boolean;
  onClose: () => void;
};

function getBrowserInfo(): Record<string, string> {
  if (typeof window === "undefined") return {};
  return {
    userAgent: navigator.userAgent,
    language: navigator.language,
    platform: navigator.platform,
    screenWidth: String(window.screen.width),
    screenHeight: String(window.screen.height),
    windowWidth: String(window.innerWidth),
    windowHeight: String(window.innerHeight),
  };
}

export function BugReportModal({ open, onClose }: Props) {
  const [submitted, setSubmitted] = useState(false);

  const form = useForm<BugFormData>({
    resolver: zodResolver(bugSchema),
    defaultValues: {
      description: "",
      stepsToReproduce: "",
      severity: "medium",
    },
  });

  const submitMutation = trpc.feedback.submitBug.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      form.reset();
    },
  });

  const onSubmit = form.handleSubmit((data) => {
    submitMutation.mutate({
      ...data,
      browserInfo: getBrowserInfo(),
      currentPage: typeof window !== "undefined" ? window.location.pathname : undefined,
    });
  });

  const handleClose = () => {
    setSubmitted(false);
    onClose();
  };

  if (submitted) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          <div className="flex flex-col items-center gap-4 py-8">
            <CheckCircle className="h-12 w-12 text-green-500" />
            <DialogTitle>Bug Report Submitted</DialogTitle>
            <p className="text-center text-muted-foreground">
              Thank you for reporting this issue. We&apos;ll investigate and get
              back to you if we need more information.
            </p>
            <Button onClick={handleClose}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Report a Bug</DialogTitle>
          <DialogDescription>
            Help us improve by reporting issues you encounter. Your browser
            information will be automatically included.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4">
            <FormField
              control={form.control}
              name="severity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Severity</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select severity" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="low">Low - Minor issue</SelectItem>
                      <SelectItem value="medium">
                        Medium - Affects usability
                      </SelectItem>
                      <SelectItem value="high">
                        High - Major feature broken
                      </SelectItem>
                      <SelectItem value="critical">
                        Critical - Cannot use app
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>What happened?</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe the bug you encountered..."
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="stepsToReproduce"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Steps to Reproduce (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={"1. Go to...\n2. Click on...\n3. See error..."}
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitMutation.isPending}>
                {submitMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Submit Report
              </Button>
            </div>

            {submitMutation.error && (
              <p className="text-sm text-destructive">
                {submitMutation.error.message}
              </p>
            )}
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
