"use client";

import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc/client";

interface WhatsNewButtonProps {
  onClick: () => void;
}

export function WhatsNewButton({ onClick }: WhatsNewButtonProps) {
  const { data: unreadCount } = trpc.changelog.getUnreadCount.useQuery(undefined, {
    refetchInterval: 300000, // 5 minutes
  });

  const hasUnread = (unreadCount ?? 0) > 0;

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      className="relative"
      aria-label="What's new"
    >
      <Sparkles className="h-5 w-5" />
      {hasUnread && (
        <span className="absolute -top-1 -right-1 flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-primary" />
        </span>
      )}
    </Button>
  );
}
