"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc/client";
import { UserPlus } from "lucide-react";
import { MemberList } from "@/components/team/MemberList";
import { PendingInvites } from "@/components/team/PendingInvites";
import { InviteMemberModal } from "@/components/team/InviteMemberModal";

export default function TeamSettingsPage() {
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const { data: context, isLoading } = trpc.team.getContext.useQuery();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Team</h2>
          <p className="text-muted-foreground">Manage who has access to your portfolio</p>
        </div>
        <div className="h-96 rounded-lg bg-muted animate-pulse" />
      </div>
    );
  }

  if (!context?.permissions.canManageMembers && context?.role !== "owner") {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Team</h2>
        <p className="text-muted-foreground">
          Only the portfolio owner can manage team members.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Team</h2>
          <p className="text-muted-foreground">
            Manage who has access to your portfolio
          </p>
        </div>
        <Button onClick={() => setInviteModalOpen(true)}>
          <UserPlus className="w-4 h-4 mr-2" />
          Invite Member
        </Button>
      </div>

      <MemberList />
      <PendingInvites />

      <InviteMemberModal
        open={inviteModalOpen}
        onOpenChange={setInviteModalOpen}
      />
    </div>
  );
}
