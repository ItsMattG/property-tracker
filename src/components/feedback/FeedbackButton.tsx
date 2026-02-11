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
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" title="Feedback" aria-label="Feedback">
            <MessageSquarePlus className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
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
