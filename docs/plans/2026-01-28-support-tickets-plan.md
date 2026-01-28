# Enhanced Support Ticket System — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a support ticket system with categories, urgency, enhanced status workflow, sequential ticket IDs, and threaded notes.

**Architecture:** New `support_tickets` and `ticket_notes` DB tables with enums. tRPC router with user and admin procedures. Settings pages for user ticket list and admin management.

**Tech Stack:** TypeScript, Vitest, tRPC, Drizzle ORM, Next.js App Router, shadcn/ui, Lucide icons.

---

### Task 1: Schema — Enums, Tables, Relations, Types

**Files:**
- Modify: `src/server/db/schema.ts`

**Step 1: Add enums after existing bug report enums (after line ~428)**

Find the line with `export const bugReportSeverityEnum` and add after its closing bracket:

```typescript
export const ticketCategoryEnum = pgEnum("ticket_category", [
  "bug",
  "question",
  "feature_request",
  "account_issue",
]);

export const ticketStatusEnum = pgEnum("ticket_status", [
  "open",
  "in_progress",
  "waiting_on_customer",
  "resolved",
  "closed",
]);

export const ticketUrgencyEnum = pgEnum("ticket_urgency", [
  "low",
  "medium",
  "high",
  "critical",
]);
```

**Step 2: Add tables at end of file (before type exports)**

Find the last table definition and add:

```typescript
// --- Support Tickets ---

export const supportTickets = pgTable(
  "support_tickets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    ticketNumber: serial("ticket_number").notNull(),
    category: ticketCategoryEnum("category").notNull(),
    subject: varchar("subject", { length: 200 }).notNull(),
    description: text("description").notNull(),
    urgency: ticketUrgencyEnum("urgency").notNull(),
    status: ticketStatusEnum("status").default("open").notNull(),
    browserInfo: jsonb("browser_info"),
    currentPage: varchar("current_page", { length: 500 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("support_tickets_user_id_idx").on(table.userId),
    index("support_tickets_status_idx").on(table.status),
    index("support_tickets_urgency_idx").on(table.urgency),
    index("support_tickets_category_idx").on(table.category),
  ]
);

export const ticketNotes = pgTable(
  "ticket_notes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ticketId: uuid("ticket_id")
      .references(() => supportTickets.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    content: text("content").notNull(),
    isInternal: boolean("is_internal").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("ticket_notes_ticket_id_idx").on(table.ticketId),
  ]
);

export const supportTicketsRelations = relations(supportTickets, ({ many }) => ({
  notes: many(ticketNotes),
}));

export const ticketNotesRelations = relations(ticketNotes, ({ one }) => ({
  ticket: one(supportTickets, {
    fields: [ticketNotes.ticketId],
    references: [supportTickets.id],
  }),
}));
```

**Step 3: Add type exports at end of file**

```typescript
// Support Ticket Types
export type SupportTicket = typeof supportTickets.$inferSelect;
export type NewSupportTicket = typeof supportTickets.$inferInsert;
export type TicketNote = typeof ticketNotes.$inferSelect;
export type NewTicketNote = typeof ticketNotes.$inferInsert;
```

**Step 4: Generate and run migration**

Run: `npx drizzle-kit generate` then `npx drizzle-kit push`

**Step 5: Commit**

```bash
git add src/server/db/schema.ts drizzle/
git commit -m "feat(tickets): add support tickets schema with enums and relations"
```

---

### Task 2: Support Ticket Service (TDD)

**Files:**
- Create: `src/server/services/__tests__/support-tickets.test.ts`
- Create: `src/server/services/support-tickets.ts`

**Step 1: Write tests**

Create `src/server/services/__tests__/support-tickets.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { formatTicketNumber, getUrgencyWeight, sortTicketsByPriority } from "../support-tickets";

describe("formatTicketNumber", () => {
  it("formats single digit", () => {
    expect(formatTicketNumber(1)).toBe("TICK-001");
  });

  it("formats triple digit", () => {
    expect(formatTicketNumber(123)).toBe("TICK-123");
  });

  it("formats four digit", () => {
    expect(formatTicketNumber(1234)).toBe("TICK-1234");
  });
});

describe("getUrgencyWeight", () => {
  it("returns correct weights", () => {
    expect(getUrgencyWeight("critical")).toBe(4);
    expect(getUrgencyWeight("high")).toBe(3);
    expect(getUrgencyWeight("medium")).toBe(2);
    expect(getUrgencyWeight("low")).toBe(1);
  });
});

describe("sortTicketsByPriority", () => {
  it("sorts by urgency descending then date descending", () => {
    const tickets = [
      { id: "a", urgency: "low", createdAt: new Date("2026-01-01") },
      { id: "b", urgency: "critical", createdAt: new Date("2026-01-01") },
      { id: "c", urgency: "high", createdAt: new Date("2026-01-02") },
      { id: "d", urgency: "high", createdAt: new Date("2026-01-01") },
    ];

    const sorted = sortTicketsByPriority(tickets);
    expect(sorted.map((t) => t.id)).toEqual(["b", "c", "d", "a"]);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/server/services/__tests__/support-tickets.test.ts`
Expected: FAIL — module not found.

**Step 3: Write the service**

Create `src/server/services/support-tickets.ts`:

```typescript
import { eq, and, desc } from "drizzle-orm";
import { db } from "@/server/db";
import { supportTickets, ticketNotes } from "@/server/db/schema";

// --- Pure functions (exported for testing) ---

export function formatTicketNumber(num: number): string {
  return `TICK-${String(num).padStart(3, "0")}`;
}

export function getUrgencyWeight(urgency: string): number {
  const weights: Record<string, number> = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
  };
  return weights[urgency] ?? 0;
}

export function sortTicketsByPriority<
  T extends { urgency: string; createdAt: Date },
>(tickets: T[]): T[] {
  return [...tickets].sort((a, b) => {
    const urgencyDiff = getUrgencyWeight(b.urgency) - getUrgencyWeight(a.urgency);
    if (urgencyDiff !== 0) return urgencyDiff;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
}

// --- DB functions ---

export async function createTicket(input: {
  userId: string;
  category: "bug" | "question" | "feature_request" | "account_issue";
  subject: string;
  description: string;
  urgency: "low" | "medium" | "high" | "critical";
  browserInfo?: unknown;
  currentPage?: string;
}) {
  const [ticket] = await db
    .insert(supportTickets)
    .values({
      userId: input.userId,
      category: input.category,
      subject: input.subject,
      description: input.description,
      urgency: input.urgency,
      browserInfo: input.browserInfo,
      currentPage: input.currentPage,
    })
    .returning();

  return ticket;
}

export async function getUserTickets(userId: string) {
  return db.query.supportTickets.findMany({
    where: eq(supportTickets.userId, userId),
    orderBy: [desc(supportTickets.createdAt)],
    with: {
      notes: {
        where: eq(ticketNotes.isInternal, false),
        orderBy: [desc(ticketNotes.createdAt)],
      },
    },
  });
}

export async function getTicketById(ticketId: string, includeInternal: boolean) {
  return db.query.supportTickets.findFirst({
    where: eq(supportTickets.id, ticketId),
    with: {
      notes: {
        ...(includeInternal ? {} : { where: eq(ticketNotes.isInternal, false) }),
        orderBy: [desc(ticketNotes.createdAt)],
      },
    },
  });
}

export async function getAllTickets(filters?: {
  status?: string;
  urgency?: string;
  category?: string;
}) {
  const conditions = [];
  if (filters?.status) {
    conditions.push(
      eq(supportTickets.status, filters.status as "open" | "in_progress" | "waiting_on_customer" | "resolved" | "closed"),
    );
  }
  if (filters?.urgency) {
    conditions.push(
      eq(supportTickets.urgency, filters.urgency as "low" | "medium" | "high" | "critical"),
    );
  }
  if (filters?.category) {
    conditions.push(
      eq(supportTickets.category, filters.category as "bug" | "question" | "feature_request" | "account_issue"),
    );
  }

  return db.query.supportTickets.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    orderBy: [desc(supportTickets.createdAt)],
    with: {
      notes: true,
    },
  });
}

export async function updateTicketStatus(
  ticketId: string,
  status: "open" | "in_progress" | "waiting_on_customer" | "resolved" | "closed",
) {
  const [updated] = await db
    .update(supportTickets)
    .set({ status, updatedAt: new Date() })
    .where(eq(supportTickets.id, ticketId))
    .returning();
  return updated;
}

export async function addTicketNote(input: {
  ticketId: string;
  userId: string;
  content: string;
  isInternal: boolean;
}) {
  const [note] = await db
    .insert(ticketNotes)
    .values({
      ticketId: input.ticketId,
      userId: input.userId,
      content: input.content,
      isInternal: input.isInternal,
    })
    .returning();
  return note;
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/server/services/__tests__/support-tickets.test.ts`
Expected: All 6 tests PASS.

**Step 5: Commit**

```bash
git add src/server/services/support-tickets.ts src/server/services/__tests__/support-tickets.test.ts
git commit -m "feat(tickets): add support tickets service with TDD tests"
```

---

### Task 3: tRPC Router

**Files:**
- Create: `src/server/routers/supportTickets.ts`
- Modify: `src/server/routers/_app.ts`

**Step 1: Create the router**

Create `src/server/routers/supportTickets.ts`:

```typescript
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import {
  createTicket,
  getUserTickets,
  getTicketById,
  getAllTickets,
  updateTicketStatus,
  addTicketNote,
  formatTicketNumber,
} from "../services/support-tickets";

function requireAdmin(userId: string) {
  const adminIds = (process.env.ADMIN_USER_IDS ?? "").split(",").filter(Boolean);
  if (!adminIds.includes(userId)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
}

export const supportTicketsRouter = router({
  // --- User procedures ---

  create: protectedProcedure
    .input(
      z.object({
        category: z.enum(["bug", "question", "feature_request", "account_issue"]),
        subject: z.string().min(5).max(200),
        description: z.string().min(10).max(5000),
        urgency: z.enum(["low", "medium", "high", "critical"]),
        browserInfo: z.unknown().optional(),
        currentPage: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const ticket = await createTicket({
        userId: ctx.user.id,
        ...input,
      });
      return {
        ...ticket,
        displayId: formatTicketNumber(ticket.ticketNumber),
      };
    }),

  list: protectedProcedure
    .input(
      z.object({
        status: z.string().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const tickets = await getUserTickets(ctx.user.id);
      let filtered = tickets;
      if (input?.status) {
        filtered = tickets.filter((t) => t.status === input.status);
      }
      return filtered.map((t) => ({
        ...t,
        displayId: formatTicketNumber(t.ticketNumber),
      }));
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const ticket = await getTicketById(input.id, false);
      if (!ticket || ticket.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return {
        ...ticket,
        displayId: formatTicketNumber(ticket.ticketNumber),
      };
    }),

  addNote: protectedProcedure
    .input(
      z.object({
        ticketId: z.string().uuid(),
        content: z.string().min(1).max(5000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const ticket = await getTicketById(input.ticketId, false);
      if (!ticket || ticket.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return addTicketNote({
        ticketId: input.ticketId,
        userId: ctx.user.id,
        content: input.content,
        isInternal: false,
      });
    }),

  // --- Admin procedures ---

  adminList: protectedProcedure
    .input(
      z.object({
        status: z.string().optional(),
        urgency: z.string().optional(),
        category: z.string().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      requireAdmin(ctx.user.id);
      const tickets = await getAllTickets(input ?? undefined);
      return tickets.map((t) => ({
        ...t,
        displayId: formatTicketNumber(t.ticketNumber),
      }));
    }),

  adminGet: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      requireAdmin(ctx.user.id);
      const ticket = await getTicketById(input.id, true);
      if (!ticket) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return {
        ...ticket,
        displayId: formatTicketNumber(ticket.ticketNumber),
      };
    }),

  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        status: z.enum(["open", "in_progress", "waiting_on_customer", "resolved", "closed"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireAdmin(ctx.user.id);
      return updateTicketStatus(input.id, input.status);
    }),

  addAdminNote: protectedProcedure
    .input(
      z.object({
        ticketId: z.string().uuid(),
        content: z.string().min(1).max(5000),
        isInternal: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireAdmin(ctx.user.id);
      return addTicketNote({
        ticketId: input.ticketId,
        userId: ctx.user.id,
        content: input.content,
        isInternal: input.isInternal,
      });
    }),
});
```

**Step 2: Register in `_app.ts`**

Add import:
```typescript
import { supportTicketsRouter } from "./supportTickets";
```

Add to router object:
```typescript
  supportTickets: supportTicketsRouter,
```

**Step 3: Commit**

```bash
git add src/server/routers/supportTickets.ts src/server/routers/_app.ts
git commit -m "feat(tickets): add support tickets tRPC router"
```

---

### Task 4: User Support Page

**Files:**
- Create: `src/components/support/SupportTicketList.tsx`
- Create: `src/components/support/NewTicketModal.tsx`
- Create: `src/app/(dashboard)/settings/support/page.tsx`

**Step 1: Create the ticket list component**

Create `src/components/support/SupportTicketList.tsx`:

```typescript
"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc/client";
import { NewTicketModal } from "./NewTicketModal";
import { ChevronDown, Loader2, Plus, Send, Ticket } from "lucide-react";
import { cn } from "@/lib/utils";

const statusLabels: Record<string, string> = {
  open: "Open",
  in_progress: "In Progress",
  waiting_on_customer: "Waiting on You",
  resolved: "Resolved",
  closed: "Closed",
};

const statusColors: Record<string, string> = {
  open: "bg-blue-100 text-blue-800",
  in_progress: "bg-amber-100 text-amber-800",
  waiting_on_customer: "bg-purple-100 text-purple-800",
  resolved: "bg-green-100 text-green-800",
  closed: "bg-gray-100 text-gray-800",
};

const urgencyColors: Record<string, string> = {
  low: "bg-gray-100 text-gray-800",
  medium: "bg-blue-100 text-blue-800",
  high: "bg-amber-100 text-amber-800",
  critical: "bg-red-100 text-red-800",
};

const categoryLabels: Record<string, string> = {
  bug: "Bug",
  question: "Question",
  feature_request: "Feature Request",
  account_issue: "Account Issue",
};

export function SupportTicketList() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [replyContent, setReplyContent] = useState<Record<string, string>>({});

  const { data: tickets, isLoading, refetch } = trpc.supportTickets.list.useQuery(
    statusFilter !== "all" ? { status: statusFilter } : undefined,
  );
  const addNote = trpc.supportTickets.addNote.useMutation({
    onSuccess: () => refetch(),
  });

  const handleReply = (ticketId: string) => {
    const content = replyContent[ticketId]?.trim();
    if (!content) return;
    addNote.mutate({ ticketId, content });
    setReplyContent((prev) => ({ ...prev, [ticketId]: "" }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Filter:</span>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tickets</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="waiting_on_customer">Waiting on You</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => setShowNewTicket(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Ticket
        </Button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {tickets && tickets.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground text-center">
              No support tickets found. Create one if you need help.
            </p>
          </CardContent>
        </Card>
      )}

      {tickets?.map((ticket) => (
        <Collapsible key={ticket.id}>
          <Card>
            <CollapsibleTrigger className="w-full text-left">
              <CardHeader className="flex flex-row items-center justify-between">
                <div className="flex items-center gap-3">
                  <Ticket className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground font-mono">
                        {ticket.displayId}
                      </span>
                      <CardTitle className="text-base">{ticket.subject}</CardTitle>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className={cn("text-xs", categoryLabels[ticket.category] && "")}>
                        {categoryLabels[ticket.category] ?? ticket.category}
                      </Badge>
                      <Badge variant="outline" className={cn("text-xs", urgencyColors[ticket.urgency])}>
                        {ticket.urgency}
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={cn("text-xs", statusColors[ticket.status])}>
                    {statusLabels[ticket.status] ?? ticket.status}
                  </Badge>
                  <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform [[data-state=open]>&]:rotate-180" />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-4">
                <p className="text-sm whitespace-pre-wrap">{ticket.description}</p>

                {ticket.notes.length > 0 && (
                  <div className="space-y-3 border-t pt-4">
                    <p className="text-sm font-medium">Conversation</p>
                    {ticket.notes.map((note) => (
                      <div key={note.id} className="text-sm bg-muted/50 rounded-lg p-3">
                        <p className="whitespace-pre-wrap">{note.content}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(note.createdAt).toLocaleDateString("en-AU")}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {ticket.status !== "closed" && ticket.status !== "resolved" && (
                  <div className="flex gap-2 border-t pt-4">
                    <Textarea
                      placeholder="Add a reply..."
                      value={replyContent[ticket.id] ?? ""}
                      onChange={(e) =>
                        setReplyContent((prev) => ({ ...prev, [ticket.id]: e.target.value }))
                      }
                      className="min-h-[60px]"
                    />
                    <Button
                      size="sm"
                      onClick={() => handleReply(ticket.id)}
                      disabled={!replyContent[ticket.id]?.trim() || addNote.isPending}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      ))}

      <NewTicketModal
        open={showNewTicket}
        onOpenChange={setShowNewTicket}
        onCreated={() => refetch()}
      />
    </div>
  );
}
```

**Step 2: Create the new ticket modal**

Create `src/components/support/NewTicketModal.tsx`:

```typescript
"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc/client";
import { Loader2 } from "lucide-react";

interface NewTicketModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export function NewTicketModal({ open, onOpenChange, onCreated }: NewTicketModalProps) {
  const [category, setCategory] = useState<string>("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [urgency, setUrgency] = useState<string>("");

  const create = trpc.supportTickets.create.useMutation({
    onSuccess: () => {
      onCreated();
      onOpenChange(false);
      setCategory("");
      setSubject("");
      setDescription("");
      setUrgency("");
    },
  });

  const canSubmit =
    category && subject.length >= 5 && description.length >= 10 && urgency;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>New Support Ticket</DialogTitle>
          <DialogDescription>
            Describe your issue and we'll get back to you.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Select category..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bug">Bug Report</SelectItem>
                <SelectItem value="question">Question</SelectItem>
                <SelectItem value="feature_request">Feature Request</SelectItem>
                <SelectItem value="account_issue">Account Issue</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Subject</Label>
            <Input
              placeholder="Brief summary of your issue"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={200}
            />
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              placeholder="Describe the issue in detail..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[120px]"
              maxLength={5000}
            />
          </div>

          <div className="space-y-2">
            <Label>Urgency</Label>
            <Select value={urgency} onValueChange={setUrgency}>
              <SelectTrigger>
                <SelectValue placeholder="Select urgency..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low - Minor issue</SelectItem>
                <SelectItem value="medium">Medium - Affects usability</SelectItem>
                <SelectItem value="high">High - Major feature broken</SelectItem>
                <SelectItem value="critical">Critical - Cannot use app</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={() =>
              create.mutate({
                category: category as "bug" | "question" | "feature_request" | "account_issue",
                subject,
                description,
                urgency: urgency as "low" | "medium" | "high" | "critical",
                currentPage: window.location.pathname,
                browserInfo: {
                  userAgent: navigator.userAgent,
                  language: navigator.language,
                  platform: navigator.platform,
                },
              })
            }
            disabled={!canSubmit || create.isPending}
            className="w-full"
          >
            {create.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Submit Ticket
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 3: Create the user support page**

Create `src/app/(dashboard)/settings/support/page.tsx`:

```typescript
import { SupportTicketList } from "@/components/support/SupportTicketList";

export const dynamic = "force-dynamic";

export default function SupportPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Support</h2>
        <p className="text-muted-foreground">
          View and manage your support tickets
        </p>
      </div>
      <SupportTicketList />
    </div>
  );
}
```

**Step 4: Commit**

```bash
git add src/components/support/ src/app/\(dashboard\)/settings/support/page.tsx
git commit -m "feat(tickets): add user support ticket page and components"
```

---

### Task 5: Admin Support Page & Sidebar Links

**Files:**
- Create: `src/components/support/AdminTicketList.tsx`
- Create: `src/app/(dashboard)/settings/support-admin/page.tsx`
- Modify: `src/components/layout/Sidebar.tsx`

**Step 1: Create admin ticket list**

Create `src/components/support/AdminTicketList.tsx`:

```typescript
"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc/client";
import { ChevronDown, Loader2, Send, Ticket } from "lucide-react";
import { cn } from "@/lib/utils";

const statusLabels: Record<string, string> = {
  open: "Open",
  in_progress: "In Progress",
  waiting_on_customer: "Waiting on Customer",
  resolved: "Resolved",
  closed: "Closed",
};

const statusColors: Record<string, string> = {
  open: "bg-blue-100 text-blue-800",
  in_progress: "bg-amber-100 text-amber-800",
  waiting_on_customer: "bg-purple-100 text-purple-800",
  resolved: "bg-green-100 text-green-800",
  closed: "bg-gray-100 text-gray-800",
};

const urgencyColors: Record<string, string> = {
  low: "bg-gray-100 text-gray-800",
  medium: "bg-blue-100 text-blue-800",
  high: "bg-amber-100 text-amber-800",
  critical: "bg-red-100 text-red-800",
};

const categoryLabels: Record<string, string> = {
  bug: "Bug",
  question: "Question",
  feature_request: "Feature Request",
  account_issue: "Account Issue",
};

export function AdminTicketList() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [urgencyFilter, setUrgencyFilter] = useState<string>("all");
  const [noteContent, setNoteContent] = useState<Record<string, string>>({});
  const [noteInternal, setNoteInternal] = useState<Record<string, boolean>>({});

  const { data: tickets, isLoading, refetch } = trpc.supportTickets.adminList.useQuery({
    status: statusFilter !== "all" ? statusFilter : undefined,
    urgency: urgencyFilter !== "all" ? urgencyFilter : undefined,
  });

  const updateStatus = trpc.supportTickets.updateStatus.useMutation({
    onSuccess: () => refetch(),
  });

  const addNote = trpc.supportTickets.addAdminNote.useMutation({
    onSuccess: () => refetch(),
  });

  const handleAddNote = (ticketId: string) => {
    const content = noteContent[ticketId]?.trim();
    if (!content) return;
    addNote.mutate({
      ticketId,
      content,
      isInternal: noteInternal[ticketId] ?? false,
    });
    setNoteContent((prev) => ({ ...prev, [ticketId]: "" }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Status:</span>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="waiting_on_customer">Waiting</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Urgency:</span>
          <Select value={urgencyFilter} onValueChange={setUrgencyFilter}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {tickets && tickets.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground text-center">No tickets found.</p>
          </CardContent>
        </Card>
      )}

      {tickets?.map((ticket) => (
        <Collapsible key={ticket.id}>
          <Card>
            <CollapsibleTrigger className="w-full text-left">
              <CardHeader className="flex flex-row items-center justify-between">
                <div className="flex items-center gap-3">
                  <Ticket className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground font-mono">
                        {ticket.displayId}
                      </span>
                      <CardTitle className="text-base">{ticket.subject}</CardTitle>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {categoryLabels[ticket.category] ?? ticket.category}
                      </Badge>
                      <Badge variant="outline" className={cn("text-xs", urgencyColors[ticket.urgency])}>
                        {ticket.urgency}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(ticket.createdAt).toLocaleDateString("en-AU")}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={cn("text-xs", statusColors[ticket.status])}>
                    {statusLabels[ticket.status] ?? ticket.status}
                  </Badge>
                  <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform [[data-state=open]>&]:rotate-180" />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-4">
                <p className="text-sm whitespace-pre-wrap">{ticket.description}</p>

                {/* Status controls */}
                <div className="flex items-center gap-2 border-t pt-4">
                  <span className="text-sm text-muted-foreground">Set status:</span>
                  <Select
                    value={ticket.status}
                    onValueChange={(v) =>
                      updateStatus.mutate({
                        id: ticket.id,
                        status: v as "open" | "in_progress" | "waiting_on_customer" | "resolved" | "closed",
                      })
                    }
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="waiting_on_customer">Waiting on Customer</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Notes */}
                {ticket.notes.length > 0 && (
                  <div className="space-y-3 border-t pt-4">
                    <p className="text-sm font-medium">Notes</p>
                    {ticket.notes.map((note) => (
                      <div
                        key={note.id}
                        className={cn(
                          "text-sm rounded-lg p-3",
                          note.isInternal
                            ? "bg-yellow-50 border border-yellow-200"
                            : "bg-muted/50",
                        )}
                      >
                        {note.isInternal && (
                          <p className="text-xs font-medium text-yellow-700 mb-1">Internal Note</p>
                        )}
                        <p className="whitespace-pre-wrap">{note.content}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(note.createdAt).toLocaleDateString("en-AU")}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add note */}
                <div className="space-y-2 border-t pt-4">
                  <div className="flex gap-2">
                    <Textarea
                      placeholder="Add a note..."
                      value={noteContent[ticket.id] ?? ""}
                      onChange={(e) =>
                        setNoteContent((prev) => ({ ...prev, [ticket.id]: e.target.value }))
                      }
                      className="min-h-[60px]"
                    />
                    <div className="flex flex-col gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleAddNote(ticket.id)}
                        disabled={!noteContent[ticket.id]?.trim() || addNote.isPending}
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={noteInternal[ticket.id] ?? false}
                      onChange={(e) =>
                        setNoteInternal((prev) => ({ ...prev, [ticket.id]: e.target.checked }))
                      }
                    />
                    Internal note (not visible to user)
                  </label>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      ))}
    </div>
  );
}
```

**Step 2: Create admin page**

Create `src/app/(dashboard)/settings/support-admin/page.tsx`:

```typescript
import { AdminTicketList } from "@/components/support/AdminTicketList";

export const dynamic = "force-dynamic";

export default function SupportAdminPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Support Tickets (Admin)</h2>
        <p className="text-muted-foreground">
          Manage all support tickets
        </p>
      </div>
      <AdminTicketList />
    </div>
  );
}
```

**Step 3: Add sidebar links**

In `src/components/layout/Sidebar.tsx`, add `Ticket` to the Lucide import and add two entries to `settingsItems`:

```typescript
  { href: "/settings/support", label: "Support", icon: Ticket },
  { href: "/settings/support-admin", label: "Support Admin", icon: Ticket },
```

**Step 4: Commit**

```bash
git add src/components/support/AdminTicketList.tsx src/app/\(dashboard\)/settings/support-admin/page.tsx src/components/layout/Sidebar.tsx
git commit -m "feat(tickets): add admin ticket management and sidebar links"
```

---

### Task 6: Type Check and Final Verification

**Files:** None (verification only)

**Step 1: Run TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 2: Run unit tests**

Run: `npx vitest run`
Expected: All tests pass (including the 6 new support-tickets tests).

**Step 3: Run linter on changed files**

Run: `npx eslint src/server/services/support-tickets.ts src/server/routers/supportTickets.ts src/components/support/SupportTicketList.tsx src/components/support/NewTicketModal.tsx src/components/support/AdminTicketList.tsx src/app/\(dashboard\)/settings/support/page.tsx src/app/\(dashboard\)/settings/support-admin/page.tsx src/components/layout/Sidebar.tsx`
Expected: No errors or warnings.

**Step 4: Fix any issues, then commit if needed**
