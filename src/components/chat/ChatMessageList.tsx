"use client";

import { useEffect, useRef } from "react";
import { ChatMessage } from "./ChatMessage";
import type { UIMessage } from "ai";
import { Loader2 } from "lucide-react";

interface ChatMessageListProps {
  messages: UIMessage[];
  isLoading: boolean;
}

export function ChatMessageList({ messages, isLoading }: ChatMessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 text-center">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            Ask me anything about your portfolio
          </p>
          <div className="text-xs text-muted-foreground space-y-1">
            <p>&ldquo;What is my total equity?&rdquo;</p>
            <p>&ldquo;Show me overdue compliance items&rdquo;</p>
            <p>&ldquo;Which property has the highest yield?&rdquo;</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.map((message) => (
        <ChatMessage key={message.id} message={message} />
      ))}
      {isLoading && (
        <div className="flex justify-start">
          <div className="bg-muted rounded-lg px-3 py-2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
