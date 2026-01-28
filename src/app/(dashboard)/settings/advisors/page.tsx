"use client";

import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserPlus, Shield, Mail, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function AdvisorsPage() {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"accountant" | "advisor">(
    "accountant"
  );

  const { data: context } = trpc.team.getContext.useQuery();
  const { data: members, refetch: refetchMembers } =
    trpc.team.listMembers.useQuery(undefined, {
      enabled: context?.permissions.canManageMembers ?? false,
    });
  const { data: invites, refetch: refetchInvites } =
    trpc.team.listInvites.useQuery(undefined, {
      enabled: context?.permissions.canManageMembers ?? false,
    });

  const sendInvite = trpc.team.sendInvite.useMutation({
    onSuccess: () => {
      toast.success("Invite sent successfully");
      setInviteOpen(false);
      setInviteEmail("");
      refetchInvites();
    },
    onError: (err) => toast.error(err.message),
  });

  const cancelInvite = trpc.team.cancelInvite.useMutation({
    onSuccess: () => {
      toast.success("Invite cancelled");
      refetchInvites();
    },
  });

  const removeMember = trpc.team.removeMember.useMutation({
    onSuccess: () => {
      toast.success("Advisor removed");
      refetchMembers();
    },
  });

  const advisorMembers = (members?.members ?? []).filter(
    (m) => m.role === "accountant" || m.role === "advisor"
  );

  const advisorInvites = (invites ?? []).filter(
    (i) => i.role === "accountant" || i.role === "advisor"
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Advisors</h2>
          <p className="text-muted-foreground">
            Invite accountants and financial advisors to view your portfolio
          </p>
        </div>
        {context?.permissions.canManageMembers && (
          <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="w-4 h-4 mr-2" />
                Invite Advisor
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite an Advisor</DialogTitle>
                <DialogDescription>
                  They will receive read-only access to your portfolio data,
                  tax reports, and audit checks.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div>
                  <Label htmlFor="email">Email address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="advisor@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="role">Role</Label>
                  <Select
                    value={inviteRole}
                    onValueChange={(v) =>
                      setInviteRole(v as "accountant" | "advisor")
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="accountant">
                        Accountant — read-only + document upload
                      </SelectItem>
                      <SelectItem value="advisor">
                        Advisor — read-only access
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  className="w-full"
                  onClick={() =>
                    sendInvite.mutate({
                      email: inviteEmail,
                      role: inviteRole,
                    })
                  }
                  disabled={!inviteEmail || sendInvite.isPending}
                >
                  Send Invite
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Current advisors */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Current Advisors
          </CardTitle>
        </CardHeader>
        <CardContent>
          {advisorMembers.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No advisors yet. Invite your accountant or financial advisor.
            </p>
          ) : (
            <div className="space-y-3">
              {advisorMembers.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between border rounded-lg px-4 py-3"
                >
                  <div>
                    <p className="font-medium">
                      {member.user?.name || member.user?.email}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {member.user?.email}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{member.role}</Badge>
                    {context?.permissions.canManageMembers && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          removeMember.mutate({ memberId: member.id })
                        }
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending invites */}
      {advisorInvites.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Pending Invites
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {advisorInvites.map((invite) => (
                <div
                  key={invite.id}
                  className="flex items-center justify-between border rounded-lg px-4 py-3"
                >
                  <div>
                    <p className="font-medium">{invite.email}</p>
                    <p className="text-xs text-muted-foreground">
                      Invited as {invite.role}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      cancelInvite.mutate({ inviteId: invite.id })
                    }
                  >
                    Cancel
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
