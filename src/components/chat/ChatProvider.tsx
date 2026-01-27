"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface ChatContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  conversationId: string | null;
  setConversationId: (id: string | null) => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  return (
    <ChatContext.Provider
      value={{ isOpen, open, close, toggle, conversationId, setConversationId }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChatPanel() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChatPanel must be used within ChatProvider");
  return ctx;
}
