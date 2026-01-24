"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Crown, MoreHorizontal, UserCog, UserMinus } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

const roleLabels: Record<string, string> = {
  owner: "Owner",
  partner: "Partner",
  accountant: "Accountant",
};

const roleBadgeVariants: Record<string, "default" | "secondary" | "outline"> = {
  owner: "default",
  partner: "secondary",
  accountant: "outline",
};

export function MemberList() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.team.listMembers.useQuery();
  const { data: context } = trpc.team.getContext.useQuery();

  const [memberToRemove, setMemberToRemove] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const changeRoleMutation = trpc.team.changeRole.useMutation({
    onSuccess: () => {
      toast.success("Member role updated");
      utils.team.listMembers.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update role");
    },
  });

  const removeMemberMutation = trpc.team.removeMember.useMutation({
    onSuccess: () => {
      toast.success("Member removed from portfolio");
      utils.team.listMembers.invalidate();
      setMemberToRemove(null);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to remove member");
    },
  });

  const handleRoleChange = (memberId: string, role: "partner" | "accountant") => {
    changeRoleMutation.mutate({ memberId, role });
  };

  const handleRemoveMember = () => {
    if (memberToRemove) {
      removeMemberMutation.mutate({ memberId: memberToRemove.id });
    }
  };

  const canManageMembers = context?.permissions.canManageMembers || context?.role === "owner";

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Team Members</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                  <div className="h-3 w-48 bg-muted animate-pulse rounded" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Team Members</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Owner */}
            {data?.owner && (
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <Crown className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {data.owner.name || data.owner.email}
                      </span>
                      <Badge variant={roleBadgeVariants.owner}>
                        {roleLabels.owner}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {data.owner.email}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Members */}
            {data?.members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between py-2 border-t"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
                    <span className="text-sm font-medium">
                      {(member.user?.name || member.user?.email || "?")
                        .charAt(0)
                        .toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {member.user?.name || member.user?.email}
                      </span>
                      <Badge variant={roleBadgeVariants[member.role] || "outline"}>
                        {roleLabels[member.role] || member.role}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {member.user?.email}
                      {member.joinedAt && (
                        <span className="ml-2">
                          - Joined{" "}
                          {formatDistanceToNow(new Date(member.joinedAt), {
                            addSuffix: true,
                          })}
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                {canManageMembers && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Open menu</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => handleRoleChange(member.id, "partner")}
                        disabled={member.role === "partner" || changeRoleMutation.isPending}
                      >
                        <UserCog className="mr-2 h-4 w-4" />
                        Set as Partner
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleRoleChange(member.id, "accountant")}
                        disabled={member.role === "accountant" || changeRoleMutation.isPending}
                      >
                        <UserCog className="mr-2 h-4 w-4" />
                        Set as Accountant
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() =>
                          setMemberToRemove({
                            id: member.id,
                            name: member.user?.name || member.user?.email || "this member",
                          })
                        }
                      >
                        <UserMinus className="mr-2 h-4 w-4" />
                        Remove Member
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            ))}

            {(!data?.members || data.members.length === 0) && (
              <p className="text-sm text-muted-foreground py-4 text-center border-t">
                No team members yet. Invite someone to collaborate on your portfolio.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <AlertDialog
        open={!!memberToRemove}
        onOpenChange={(open) => !open && setMemberToRemove(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Team Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {memberToRemove?.name} from your
              portfolio? They will lose access to all portfolio data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleRemoveMember}
            >
              {removeMemberMutation.isPending ? "Removing..." : "Remove Member"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
