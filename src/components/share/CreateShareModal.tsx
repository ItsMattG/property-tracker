"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Copy, Check, Loader2 } from "lucide-react";
import { format } from "date-fns";

interface CreateShareModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const privacyModes = [
  {
    value: "full",
    label: "Full",
    description: "All details visible including addresses and amounts",
  },
  {
    value: "summary",
    label: "Summary",
    description: "Portfolio totals only, no individual properties",
  },
  {
    value: "redacted",
    label: "Redacted",
    description: "Percentages only, suburbs instead of addresses",
  },
] as const;

export function CreateShareModal({ open, onOpenChange }: CreateShareModalProps) {
  const defaultTitle = `Portfolio Summary - ${format(new Date(), "MMMM yyyy")}`;

  const [title, setTitle] = useState(defaultTitle);
  const [privacyMode, setPrivacyMode] = useState<"full" | "summary" | "redacted">("full");
  const [expiresInDays, setExpiresInDays] = useState(14);
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const utils = trpc.useUtils();

  const createMutation = trpc.share.create.useMutation({
    onSuccess: (data) => {
      setCreatedUrl(data.url);
      utils.share.list.invalidate();
      toast.success("Share created");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleCreate = () => {
    createMutation.mutate({ title, privacyMode, expiresInDays });
  };

  const handleCopy = () => {
    if (createdUrl) {
      navigator.clipboard.writeText(createdUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    setCreatedUrl(null);
    setTitle(defaultTitle);
    setPrivacyMode("full");
    setExpiresInDays(14);
    setCopied(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {createdUrl ? "Share Created" : "Create Portfolio Share"}
          </DialogTitle>
          <DialogDescription>
            {createdUrl
              ? "Your shareable link is ready"
              : "Generate a shareable link to your portfolio"}
          </DialogDescription>
        </DialogHeader>

        {createdUrl ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Input value={createdUrl} readOnly className="font-mono text-sm" />
              <Button size="icon" variant="outline" onClick={handleCopy}>
                {copied ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              This link will expire in {expiresInDays} days.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Portfolio Summary"
              />
            </div>

            <div className="space-y-2">
              <Label>Privacy Mode</Label>
              <Select
                value={privacyMode}
                onValueChange={(v) => setPrivacyMode(v as typeof privacyMode)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {privacyModes.map((mode) => (
                    <SelectItem key={mode.value} value={mode.value}>
                      <div>
                        <div className="font-medium">{mode.label}</div>
                        <div className="text-xs text-muted-foreground">
                          {mode.description}
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Expires In</Label>
              <Select
                value={String(expiresInDays)}
                onValueChange={(v) => setExpiresInDays(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 days</SelectItem>
                  <SelectItem value="14">14 days</SelectItem>
                  <SelectItem value="30">30 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <DialogFooter>
          {createdUrl ? (
            <Button onClick={handleClose}>Done</Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={createMutation.isPending}>
                {createMutation.isPending && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                Create Share
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
