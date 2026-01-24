"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Mail, RefreshCw, X, Clock } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";

const roleLabels: Record<string, string> = {
  partner: "Partner",
  accountant: "Accountant",
};

export function PendingInvites() {
  const utils = trpc.useUtils();
  const { data: invites, isLoading } = trpc.team.listInvites.useQuery();
  const { data: context } = trpc.team.getContext.useQuery();

  const [inviteToCancel, setInviteToCancel] = useState<{
    id: string;
    email: string;
  } | null>(null);

  const resendInviteMutation = trpc.team.resendInvite.useMutation({
    onSuccess: () => {
      toast.success("Invitation resent");
      utils.team.listInvites.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to resend invitation");
    },
  });

  const cancelInviteMutation = trpc.team.cancelInvite.useMutation({
    onSuccess: () => {
      toast.success("Invitation cancelled");
      utils.team.listInvites.invalidate();
      setInviteToCancel(null);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to cancel invitation");
    },
  });

  const handleResend = (inviteId: string) => {
    resendInviteMutation.mutate({ inviteId });
  };

  const handleCancel = () => {
    if (inviteToCancel) {
      cancelInviteMutation.mutate({ inviteId: inviteToCancel.id });
    }
  };

  const isExpired = (expiresAt: Date | string) => {
    return new Date() > new Date(expiresAt);
  };

  const canManageMembers = context?.permissions.canManageMembers || context?.role === "owner";

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Pending Invitations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-48 bg-muted animate-pulse rounded" />
                  <div className="h-3 w-32 bg-muted animate-pulse rounded" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!invites || invites.length === 0) {
    return null;
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Pending Invitations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {invites.map((invite) => {
              const expired = isExpired(invite.expiresAt);

              return (
                <div
                  key={invite.id}
                  className="flex items-center justify-between py-2 border-b last:border-b-0"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                      <Mail className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{invite.email}</span>
                        <Badge variant="outline">
                          {roleLabels[invite.role] || invite.role}
                        </Badge>
                        {expired && (
                          <Badge variant="destructive">Expired</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>
                          {expired
                            ? `Expired ${formatDistanceToNow(new Date(invite.expiresAt), { addSuffix: true })}`
                            : `Expires ${format(new Date(invite.expiresAt), "MMM d, yyyy")}`}
                        </span>
                        <span className="mx-1">-</span>
                        <span>
                          Sent{" "}
                          {formatDistanceToNow(new Date(invite.createdAt), {
                            addSuffix: true,
                          })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {canManageMembers && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleResend(invite.id)}
                        disabled={resendInviteMutation.isPending}
                      >
                        <RefreshCw className="h-4 w-4 mr-1" />
                        Resend
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setInviteToCancel({ id: invite.id, email: invite.email })
                        }
                      >
                        <X className="h-4 w-4" />
                        <span className="sr-only">Cancel invite</span>
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <AlertDialog
        open={!!inviteToCancel}
        onOpenChange={(open) => !open && setInviteToCancel(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Invitation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel the invitation to{" "}
              {inviteToCancel?.email}? They will no longer be able to use the
              invite link.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Invitation</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleCancel}>
              {cancelInviteMutation.isPending
                ? "Cancelling..."
                : "Cancel Invitation"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
