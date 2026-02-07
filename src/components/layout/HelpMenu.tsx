"use client";

import { useState } from "react";
import { CircleHelp, MessageSquarePlus, Bug, Sparkles, Map } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { FeatureRequestModal } from "@/components/feedback/FeatureRequestModal";
import { BugReportModal } from "@/components/feedback/BugReportModal";
import { usePathname } from "next/navigation";
import { useTour } from "@/hooks/useTour";
import { TOUR_PAGE_MAP } from "@/config/tours";
import { trpc } from "@/lib/trpc/client";
import { featureFlags } from "@/config/feature-flags";

interface HelpMenuProps {
  onWhatsNewClick?: () => void;
}

export function HelpMenu({ onWhatsNewClick }: HelpMenuProps) {
  const [featureModalOpen, setFeatureModalOpen] = useState(false);
  const [bugModalOpen, setBugModalOpen] = useState(false);

  const pathname = usePathname();
  const tourId = pathname ? TOUR_PAGE_MAP[pathname] : undefined;
  const { startTour } = useTour({ tourId: tourId || "", autoStart: false });

  const { data: unreadCount } = trpc.changelog.getUnreadCount.useQuery(
    undefined,
    { refetchInterval: 300000, enabled: featureFlags.whatsNew }
  );
  const hasUnread = featureFlags.whatsNew && (unreadCount ?? 0) > 0;

  return (
    <>
      <DropdownMenu modal={false}>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative cursor-pointer"
                aria-label="Help & feedback"
              >
                <CircleHelp className="h-5 w-5" />
                {hasUnread && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary" />
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>Help & feedback</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="end" className="w-52">
          {tourId && (
            <>
              <DropdownMenuItem onClick={startTour}>
                <Map className="mr-2 h-4 w-4" />
                Take a page tour
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem onClick={() => setFeatureModalOpen(true)}>
            <MessageSquarePlus className="mr-2 h-4 w-4" />
            Request feature
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setBugModalOpen(true)}>
            <Bug className="mr-2 h-4 w-4" />
            Report bug
          </DropdownMenuItem>
          {featureFlags.whatsNew && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onWhatsNewClick}>
                <Sparkles className="mr-2 h-4 w-4" />
                What&apos;s new
                {hasUnread && (
                  <span className="ml-auto flex h-2 w-2 rounded-full bg-primary" />
                )}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <FeatureRequestModal
        open={featureModalOpen}
        onClose={() => setFeatureModalOpen(false)}
      />
      <BugReportModal
        open={bugModalOpen}
        onClose={() => setBugModalOpen(false)}
      />
    </>
  );
}
