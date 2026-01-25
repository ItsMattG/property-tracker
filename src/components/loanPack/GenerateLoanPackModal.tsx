"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Check, Copy, Loader2 } from "lucide-react";

interface GenerateLoanPackModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  brokerId?: string;
}

export function GenerateLoanPackModal({ open, onOpenChange, brokerId }: GenerateLoanPackModalProps) {
  const [expiryDays, setExpiryDays] = useState("7");
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const utils = trpc.useUtils();

  const createMutation = trpc.loanPack.create.useMutation({
    onSuccess: (data) => {
      setGeneratedUrl(data.url);
      utils.loanPack.list.invalidate();
      utils.broker.list.invalidate();
      if (brokerId) {
        utils.broker.get.invalidate({ id: brokerId });
      }
    },
  });

  const handleGenerate = () => {
    createMutation.mutate({ expiresInDays: parseInt(expiryDays), brokerId });
  };

  const handleCopy = async () => {
    if (generatedUrl) {
      await navigator.clipboard.writeText(generatedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    setGeneratedUrl(null);
    setCopied(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Generate Loan Application Pack</DialogTitle>
          <DialogDescription>Create a shareable report with your portfolio data for your mortgage broker.</DialogDescription>
        </DialogHeader>

        {!generatedUrl ? (
          <>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="expiry">Link Expiry</Label>
                <Select value={expiryDays} onValueChange={setExpiryDays}>
                  <SelectTrigger id="expiry"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">3 days</SelectItem>
                    <SelectItem value="7">7 days</SelectItem>
                    <SelectItem value="14">14 days</SelectItem>
                    <SelectItem value="30">30 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="text-sm text-muted-foreground">
                <p>The report will include:</p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Property details and valuations</li>
                  <li>Loan balances and rates</li>
                  <li>Income and expense summary</li>
                  <li>Compliance status</li>
                  <li>Equity milestones</li>
                </ul>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button onClick={handleGenerate} disabled={createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Generate Report
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Share Link</Label>
                <div className="flex gap-2">
                  <Input value={generatedUrl} readOnly className="font-mono text-sm" />
                  <Button variant="outline" size="icon" onClick={handleCopy}>
                    {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">Share this link with your mortgage broker. The link will expire in {expiryDays} days.</p>
            </div>
            <DialogFooter><Button onClick={handleClose}>Done</Button></DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
