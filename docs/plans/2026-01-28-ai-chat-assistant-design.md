# AI Chat Assistant — Design

**Date:** 2026-01-28
**Phase:** V0.3 Phase 7.3
**Status:** Draft

---

## Overview

An in-app AI chat assistant that helps users understand their property portfolio, answer questions about their data, and navigate the app. Accessible via a floating button on every dashboard page, opening a slide-out panel.

**Primary capability:** Context-aware property insights — "What's my total equity?", "Which property has the highest yield?", "Show me expenses for 123 Main St this year."

**Secondary capability:** App help — "How do I add a property?", "Where can I see my compliance calendar?"

---

## Architecture

### Tech Stack Additions

- **Vercel AI SDK (`ai` + `@ai-sdk/anthropic`)** — Provides `useChat` React hook, streaming response helpers, and tool-use support. Works natively with Next.js App Router route handlers.
- **No new infrastructure** — No WebSockets, no Redis. The AI SDK handles streaming via standard HTTP (SSE under the hood).

### Data Flow

```
User types message
  → useChat hook sends POST to /api/chat
  → Route handler builds context (user, portfolio, current page)
  → Claude receives system prompt + tools + message history
  → Claude streams response (may call tools mid-stream)
  → Tool calls execute server-side (query DB via existing services)
  → Tool results fed back to Claude
  → Final streamed response rendered in chat panel
  → Conversation persisted to DB on completion
```

### Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Streaming library | Vercel AI SDK | Native Next.js integration, `useChat` hook handles UI state, built-in tool-use support |
| Model | claude-sonnet-4-20250514 | Good balance of speed and capability for conversational use |
| Data access | Claude tool_use | More reliable than RAG for structured data; calls existing service functions directly |
| App knowledge | System prompt | No RAG needed — app features are static enough to embed in the prompt |
| Conversation storage | PostgreSQL (Drizzle) | Consistent with rest of app; no need for separate store |
| Real-time | SSE (via AI SDK) | No WebSocket server needed; AI SDK handles this transparently |
| Scope | Read-only | v1 cannot create/edit/delete data; reduces risk surface |

---

## Database Schema

Two new tables:

```sql
-- Conversations group messages into threads
chat_conversations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title         text,              -- Auto-generated from first message
  created_at    timestamp DEFAULT now(),
  updated_at    timestamp DEFAULT now()
)

-- Individual messages in a conversation
chat_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  role            text NOT NULL,    -- 'user' | 'assistant' | 'tool'
  content         text NOT NULL,
  tool_calls      jsonb,            -- Tool call details if role=assistant with tools
  tool_result     jsonb,            -- Tool result if role=tool
  created_at      timestamp DEFAULT now()
)

-- Indexes
CREATE INDEX idx_chat_conversations_user ON chat_conversations(user_id);
CREATE INDEX idx_chat_messages_conversation ON chat_messages(conversation_id);
```

---

## Tools (Claude Function Calling)

The assistant gets read-only tools that wrap existing service/query functions. Each tool returns structured data that Claude can interpret and explain to the user.

### v1 Tools

| Tool | Description | Data Source |
|------|-------------|-------------|
| `getPortfolioSummary` | Total properties, equity, rental income, expenses, cash flow | Portfolio stats queries |
| `getProperties` | List properties with key metrics (value, rent, yield, equity) | Property service |
| `getPropertyDetails` | Full details for a single property (address, financials, loans, compliance) | Property + loan + compliance services |
| `getTransactions` | Query transactions with filters (property, category, date range, amount) | Transaction service |
| `getTransactionSummary` | Aggregated income/expense/net by category for a property or portfolio | Transaction aggregation |
| `getTaxPosition` | Current tax year position (income, deductions, estimated tax) | Tax position service |
| `getComplianceStatus` | Upcoming compliance items, overdue items, by property | Compliance service |
| `getTasks` | Open tasks filtered by property, priority, or due date | Task service |
| `getLoans` | Loan details (balance, rate, repayment, offset) by property | Loan service |
| `getPropertyValuation` | Latest AVM valuation and capital growth history | AVM service |

### Tool Design Principles

- **Wrap existing queries** — Don't write new DB queries; call existing service functions or TRPC router logic.
- **Return structured JSON** — Let Claude format the response naturally for the user.
- **Include units and labels** — Return `{ totalEquity: 450000, currency: "AUD" }` not just `450000`.
- **Limit result sizes** — Cap list results (e.g., max 20 transactions) to keep context manageable.
- **No mutations** — Tools are strictly read-only in v1.

---

## System Prompt

The system prompt establishes the assistant's identity and provides static app knowledge:

```
You are the PropertyTracker AI Assistant. You help Australian property investors
understand their portfolio, find insights in their data, and navigate the app.

Context:
- User: {userName}
- Portfolio: {propertyCount} properties, owned by {ownerName}
- Current page: {currentRoute}
- Current date: {today}
- Financial year: {currentFY} (July 1 - June 30)

Capabilities:
- Query portfolio data (properties, transactions, loans, valuations, compliance, tax)
- Explain app features and guide navigation
- Provide general property investment knowledge (Australian context)

Limitations:
- You CANNOT create, edit, or delete any data
- You CANNOT access bank connections or trigger syncs
- You CANNOT provide specific financial or tax advice — recommend consulting a tax professional
- You do NOT have access to other users' data

Formatting:
- Use concise responses. This is a chat panel, not a full page.
- Use markdown formatting (bold, lists, tables) for clarity.
- When showing financial figures, use AUD with commas (e.g., $1,250,000).
- When referencing app pages, provide the navigation path (e.g., "Go to Properties → 123 Main St → Financials").

App Navigation Guide:
- Dashboard: Overview of portfolio performance
- Properties: Add/manage properties, view details, documents, compliance
- Transactions: View/categorize income and expenses
- Reports: Tax position, CGT, depreciation, benchmarking
- Tasks: Manage property-related to-dos
- Emails: View forwarded property emails and matched invoices
- Settings: Account, notifications, bank connections, entity management
```

---

## UI Components

### 1. ChatButton (Floating Trigger)

- Fixed position: bottom-right corner (`fixed bottom-6 right-6`)
- Circular button with chat icon (MessageCircle from Lucide)
- Notification dot when there's a new suggestion or tip
- `z-50` to float above page content
- Hidden on public pages (blog, landing, auth)

### 2. ChatPanel (Slide-Out)

- Uses Radix UI `<Sheet>` component (side="right")
- Width: ~420px on desktop, full-width on mobile
- Header: "AI Assistant" title + close button + "New Chat" button
- Body: Scrollable message list, auto-scrolls to bottom
- Footer: Text input + send button
- Keyboard: Enter to send, Shift+Enter for newline

### 3. ChatMessage

- User messages: Right-aligned, primary color background
- Assistant messages: Left-aligned, muted background
- Support markdown rendering (bold, lists, tables, code)
- Tool-use indicator: Subtle "Looking up your data..." while tools execute
- Typing indicator: Animated dots while streaming

### 4. ConversationList (in panel header)

- Dropdown or collapsible section showing recent conversations
- Click to load a previous conversation
- "New Chat" starts a fresh conversation

### Component Tree

```
<DashboardLayout>
  <Sidebar />
  <Header />
  <main>{children}</main>
  <ChatButton onClick={openPanel} />        ← New
  <ChatPanel open={isOpen} onClose={...}>   ← New
    <ChatPanelHeader>
      <ConversationSelector />
      <NewChatButton />
    </ChatPanelHeader>
    <ChatMessageList>
      <ChatMessage role="assistant" />
      <ChatMessage role="user" />
      ...
    </ChatMessageList>
    <ChatInput onSend={...} />
  </ChatPanel>
</DashboardLayout>
```

---

## API Route

### `POST /api/chat`

A Next.js App Router route handler using the Vercel AI SDK:

```typescript
// src/app/api/chat/route.ts
import { anthropic } from '@ai-sdk/anthropic';
import { streamText } from 'ai';

export async function POST(req: Request) {
  // 1. Authenticate (Clerk)
  // 2. Parse request body (messages, conversationId, currentRoute)
  // 3. Load/create conversation
  // 4. Build system prompt with user context
  // 5. Define tools with server-side implementations
  // 6. Call streamText() with Claude
  // 7. Persist messages on completion
  // 8. Return streaming response
}
```

**Authentication:** Same Clerk auth pattern as other API routes — `auth()` from `@clerk/nextjs/server`.

**Rate limiting:** Basic per-user rate limit (e.g., 30 messages/minute) to prevent abuse. Implement as simple in-memory counter initially.

---

## File Structure

```
src/
├── app/
│   └── api/
│       └── chat/
│           └── route.ts              # Streaming chat endpoint
├── components/
│   └── chat/
│       ├── ChatButton.tsx            # Floating trigger button
│       ├── ChatPanel.tsx             # Slide-out panel (Sheet)
│       ├── ChatMessageList.tsx       # Scrollable message area
│       ├── ChatMessage.tsx           # Individual message bubble
│       ├── ChatInput.tsx             # Text input + send
│       └── ChatProvider.tsx          # Context provider (open/close state, conversation)
├── server/
│   ├── services/
│   │   └── chat.ts                  # Conversation CRUD, message persistence
│   └── routers/
│       └── chat.ts                  # TRPC router for conversation history
└── hooks/
    └── useChatPanel.ts              # Panel open/close state hook
```

---

## TRPC Router (Conversation History)

A lightweight router for managing conversations (the actual chat streaming goes through the `/api/chat` REST endpoint, not TRPC, since TRPC doesn't support streaming well).

```typescript
chatRouter = {
  // List user's recent conversations
  listConversations: protectedProcedure
    .query(...)

  // Get messages for a conversation
  getConversation: protectedProcedure
    .input(z.object({ conversationId: z.string().uuid() }))
    .query(...)

  // Delete a conversation
  deleteConversation: writeProcedure
    .input(z.object({ conversationId: z.string().uuid() }))
    .mutation(...)
}
```

---

## Implementation Plan (High Level)

1. **Database** — Add schema tables, generate migration
2. **Dependencies** — Install `ai` and `@ai-sdk/anthropic`
3. **Chat service** — Conversation/message CRUD
4. **TRPC router** — Conversation history endpoints
5. **Tools** — Define tool schemas + server-side implementations wrapping existing services
6. **API route** — `/api/chat` with streaming, auth, tools, persistence
7. **UI components** — ChatButton, ChatPanel, ChatMessage, ChatInput, ChatProvider
8. **Layout integration** — Add ChatButton + ChatPanel to dashboard layout
9. **System prompt** — Write and tune the prompt with user context
10. **Tests** — Unit tests for tools, integration test for chat flow

---

## Out of Scope (v1)

- **Write actions** — No creating/editing/deleting via chat
- **RAG over documents** — No searching uploaded PDFs/documents
- **Voice input** — Text only
- **Multi-user chat** — No shared conversations
- **Suggested prompts** — Could add later as starter chips
- **Mobile app integration** — Web only in v1 (mobile can come via JWT auth on the same endpoint)
- **Usage metering/billing** — No per-message costs to users in v1

---

## Future Enhancements (v2+)

- **Write actions** — "Create a task to fix the leaky tap at 123 Main St"
- **Suggested prompts** — Context-aware starter questions based on current page
- **Document search** — RAG over uploaded documents
- **Proactive insights** — "I noticed your insurance for X expired" as chat suggestions
- **Mobile support** — JWT auth on `/api/chat` for React Native app
- **Usage analytics** — Track popular questions, tool usage, satisfaction
