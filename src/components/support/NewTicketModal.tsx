"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc/client";
import { Loader2 } from "lucide-react";

interface NewTicketModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export function NewTicketModal({ open, onOpenChange, onCreated }: NewTicketModalProps) {
  const [category, setCategory] = useState<string>("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [urgency, setUrgency] = useState<string>("");

  const create = trpc.supportTickets.create.useMutation({
    onSuccess: () => {
      onCreated();
      onOpenChange(false);
      setCategory("");
      setSubject("");
      setDescription("");
      setUrgency("");
    },
  });

  const canSubmit =
    category && subject.length >= 5 && description.length >= 10 && urgency;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>New Support Ticket</DialogTitle>
          <DialogDescription>
            Describe your issue and we&apos;ll get back to you.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Select category..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bug">Bug Report</SelectItem>
                <SelectItem value="question">Question</SelectItem>
                <SelectItem value="feature_request">Feature Request</SelectItem>
                <SelectItem value="account_issue">Account Issue</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Subject</Label>
            <Input
              placeholder="Brief summary of your issue"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={200}
            />
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              placeholder="Describe the issue in detail..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[120px]"
              maxLength={5000}
            />
          </div>

          <div className="space-y-2">
            <Label>Urgency</Label>
            <Select value={urgency} onValueChange={setUrgency}>
              <SelectTrigger>
                <SelectValue placeholder="Select urgency..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low - Minor issue</SelectItem>
                <SelectItem value="medium">Medium - Affects usability</SelectItem>
                <SelectItem value="high">High - Major feature broken</SelectItem>
                <SelectItem value="critical">Critical - Cannot use app</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={() =>
              create.mutate({
                category: category as "bug" | "question" | "feature_request" | "account_issue",
                subject,
                description,
                urgency: urgency as "low" | "medium" | "high" | "critical",
                currentPage: window.location.pathname,
                browserInfo: {
                  userAgent: navigator.userAgent,
                  language: navigator.language,
                  platform: navigator.platform,
                },
              })
            }
            disabled={!canSubmit || create.isPending}
            className="w-full"
          >
            {create.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Submit Ticket
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
