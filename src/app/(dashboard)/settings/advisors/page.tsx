"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { trpc } from "@/lib/trpc/client";
import { getErrorMessage } from "@/lib/errors";
import {
  Briefcase,
  Clock,
  Loader2,
  Mail,
  Plus,
  Trash2,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

const inviteSchema = z.object({
  email: z.string().email("Enter a valid email address"),
});

type InviteFormValues = z.infer<typeof inviteSchema>;

export default function AdvisorsPage() {
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<{
    id: string;
    email: string;
    type: "member" | "invite";
  } | null>(null);

  const utils = trpc.useUtils();

  const { data: members, isLoading: membersLoading } =
    trpc.team.listMembers.useQuery(undefined, { retry: false });
  const { data: invites, isLoading: invitesLoading } =
    trpc.team.listInvites.useQuery(undefined, { retry: false });

  const isLoading = membersLoading || invitesLoading;

  // Filter to accountant-role only
  const accountantMembers =
    members?.members.filter((m) => m.role === "accountant") || [];
  const accountantInvites =
    invites?.filter((inv) => inv.role === "accountant") || [];

  const form = useForm<InviteFormValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: "" },
  });

  const inviteMutation = trpc.team.sendInvite.useMutation({
    onSuccess: () => {
      toast.success("Invitation sent");
      setShowInviteDialog(false);
      form.reset();
      utils.team.listInvites.invalidate();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const removeMemberMutation = trpc.team.removeMember.useMutation({
    onSuccess: () => {
      toast.success("Accountant removed");
      setRemoveTarget(null);
      utils.team.listMembers.invalidate();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const cancelInviteMutation = trpc.team.cancelInvite.useMutation({
    onSuccess: () => {
      toast.success("Invitation cancelled");
      setRemoveTarget(null);
      utils.team.listInvites.invalidate();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const handleInvite = (values: InviteFormValues) => {
    inviteMutation.mutate({
      email: values.email,
      role: "accountant",
    });
  };

  const handleRemove = () => {
    if (!removeTarget) return;
    if (removeTarget.type === "member") {
      removeMemberMutation.mutate({ memberId: removeTarget.id });
    } else {
      cancelInviteMutation.mutate({ inviteId: removeTarget.id });
    }
  };

  const hasNoAdvisors =
    accountantMembers.length === 0 && accountantInvites.length === 0;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Advisors</h2>
          <p className="text-muted-foreground">
            Manage your connected accountant
          </p>
        </div>
        <Button onClick={() => setShowInviteDialog(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Accountant
        </Button>
      </div>

      {/* Advisors List */}
      <Card>
        <CardHeader>
          <CardTitle>Connected Accountants</CardTitle>
          <CardDescription>
            Your accountant can receive financial reports via the Accountant Pack
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : hasNoAdvisors ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                <Briefcase className="w-6 h-6 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground">
                No accountant connected yet. Add one to send them reports
                directly.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Active members */}
              {accountantMembers.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                      <UserCheck className="w-4 h-4 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      {member.user?.name && (
                        <p className="text-sm font-medium">
                          {member.user.name}
                        </p>
                      )}
                      <p className="text-sm text-muted-foreground">
                        {member.user?.email}
                      </p>
                      {member.joinedAt && (
                        <p className="text-xs text-muted-foreground">
                          Connected {formatDate(member.joinedAt)}
                        </p>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setRemoveTarget({
                        id: member.id,
                        email: member.user?.email || "",
                        type: "member",
                      })
                    }
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}

              {/* Pending invites */}
              {accountantInvites.map((invite) => (
                <div
                  key={invite.id}
                  className="flex items-center justify-between rounded-lg border border-dashed p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                      <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {invite.email}
                      </p>
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        Invite pending
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setRemoveTarget({
                        id: invite.id,
                        email: invite.email,
                        type: "invite",
                      })
                    }
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invite Dialog */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Accountant</DialogTitle>
            <DialogDescription>
              Send an invitation to your accountant. They&apos;ll receive
              read-only access to your financial data.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleInvite)}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Accountant Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="accountant@example.com.au"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => setShowInviteDialog(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={inviteMutation.isPending}>
                  {inviteMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Mail className="w-4 h-4 mr-2" />
                  )}
                  Send Invitation
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Remove Confirmation */}
      <AlertDialog
        open={!!removeTarget}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {removeTarget?.type === "member"
                ? "Remove Accountant"
                : "Cancel Invitation"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {removeTarget?.type === "member"
                ? `Remove ${removeTarget.email} as your accountant? They will lose access to your financial data.`
                : `Cancel the pending invitation to ${removeTarget?.email}?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleRemove}>
              {removeTarget?.type === "member"
                ? "Remove"
                : "Cancel Invitation"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
