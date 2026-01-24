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
import { Mail } from "lucide-react";

interface InviteMemberModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const roleDescriptions = {
  partner: "Full access to view and edit all portfolio data",
  accountant: "Read-only access for viewing financial data and reports",
};

export function InviteMemberModal({ open, onOpenChange }: InviteMemberModalProps) {
  const utils = trpc.useUtils();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"partner" | "accountant">("partner");

  const sendInviteMutation = trpc.team.sendInvite.useMutation({
    onSuccess: () => {
      toast.success("Invitation sent successfully");
      utils.team.listInvites.invalidate();
      handleClose();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to send invitation");
    },
  });

  const handleClose = () => {
    setEmail("");
    setRole("partner");
    onOpenChange(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      toast.error("Please enter an email address");
      return;
    }

    sendInviteMutation.mutate({ email, role });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite Team Member</DialogTitle>
          <DialogDescription>
            Send an invitation to collaborate on your portfolio. They will receive
            an email with a link to join.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="colleague@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select value={role} onValueChange={(value: "partner" | "accountant") => setRole(value)}>
              <SelectTrigger id="role" className="w-full">
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="partner">Partner</SelectItem>
                <SelectItem value="accountant">Accountant</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              {roleDescriptions[role]}
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={sendInviteMutation.isPending}>
              {sendInviteMutation.isPending ? "Sending..." : "Send Invitation"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
