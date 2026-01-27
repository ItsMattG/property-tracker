"use client";

import { useState, useRef, useCallback } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { usePathname } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { SquarePen } from "lucide-react";
import { useChatPanel } from "./ChatProvider";
import { ChatMessageList } from "./ChatMessageList";
import { ChatInput } from "./ChatInput";

export function ChatPanel() {
  const { isOpen, close, conversationId, setConversationId } = useChatPanel();
  const pathname = usePathname();
  const [input, setInput] = useState("");
  const transportRef = useRef<DefaultChatTransport<UIMessage> | null>(null);

  // Create transport lazily (stable reference)
  const getTransport = useCallback(() => {
    if (!transportRef.current) {
      transportRef.current = new DefaultChatTransport({
        api: "/api/chat",
        body: () => ({
          conversationId,
          currentRoute: pathname,
        }),
      });
    }
    return transportRef.current;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const {
    messages,
    setMessages,
    sendMessage,
    status,
  } = useChat({
    transport: getTransport(),
  });

  const isLoading = status === "streaming" || status === "submitted";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    const text = input;
    setInput("");
    sendMessage({ text });
  };

  const handleNewChat = () => {
    setMessages([]);
    setConversationId(null);
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && close()}>
      <SheetContent
        side="right"
        showCloseButton
        className="w-full sm:max-w-md flex flex-col p-0"
      >
        <SheetHeader className="px-4 pt-4 pb-2 border-b">
          <div className="flex items-center justify-between">
            <div>
              <SheetTitle className="text-base">AI Assistant</SheetTitle>
              <SheetDescription className="text-xs">
                Ask about your portfolio
              </SheetDescription>
            </div>
            <Button variant="ghost" size="icon-sm" onClick={handleNewChat} title="New chat">
              <SquarePen className="h-4 w-4" />
            </Button>
          </div>
        </SheetHeader>

        <ChatMessageList messages={messages} isLoading={isLoading} />

        <ChatInput
          input={input}
          setInput={setInput}
          onSubmit={handleSubmit}
          isLoading={isLoading}
        />
      </SheetContent>
    </Sheet>
  );
}
