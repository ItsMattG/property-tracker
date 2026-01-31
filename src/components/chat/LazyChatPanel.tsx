"use client";

import dynamic from "next/dynamic";

const ChatPanel = dynamic(
  () => import("@/components/chat/ChatPanel").then((m) => ({ default: m.ChatPanel })),
  { ssr: false }
);

export function LazyChatPanel() {
  return <ChatPanel />;
}
