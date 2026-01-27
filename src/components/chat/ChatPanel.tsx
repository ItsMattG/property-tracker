"use client";

import { useChat } from "ai/react";
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

  const {
    messages,
    input,
    setInput,
    handleSubmit,
    isLoading,
    setMessages,
  } = useChat({
    api: "/api/chat",
    body: {
      conversationId,
      currentRoute: pathname,
    },
    onResponse: (response) => {
      const newConvId = response.headers.get("x-conversation-id");
      if (newConvId && !conversationId) {
        setConversationId(newConvId);
      }
    },
  });

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
