"use client";

import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";
import { useChatPanel } from "./ChatProvider";

export function ChatButton() {
  const { toggle } = useChatPanel();

  return (
    <Button
      onClick={toggle}
      size="icon-lg"
      className="fixed bottom-6 right-6 z-50 h-12 w-12 rounded-full shadow-lg"
    >
      <MessageCircle className="h-5 w-5" />
      <span className="sr-only">Open AI Assistant</span>
    </Button>
  );
}
