"use client";

import { useState } from "react";
import { MessageSquarePlus, Bug } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FeatureRequestModal } from "./FeatureRequestModal";
import { BugReportModal } from "./BugReportModal";

export function FeedbackButton() {
  const [featureModalOpen, setFeatureModalOpen] = useState(false);
  const [bugModalOpen, setBugModalOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="w-full justify-start">
            <MessageSquarePlus className="mr-2 h-4 w-4" />
            Feedback
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuItem onClick={() => setFeatureModalOpen(true)}>
            <MessageSquarePlus className="mr-2 h-4 w-4" />
            Request Feature
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setBugModalOpen(true)}>
            <Bug className="mr-2 h-4 w-4" />
            Report Bug
          </DropdownMenuItem>
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
