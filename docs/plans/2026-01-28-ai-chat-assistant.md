# AI Chat Assistant Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an in-app AI chat assistant that answers questions about the user's property portfolio and helps navigate the app.

**Architecture:** Floating chat button (bottom-right) opens a Sheet panel. Messages stream via Vercel AI SDK through a `/api/chat` route handler. Claude uses tool_use to query user data through existing service/router logic. Conversations persist in PostgreSQL.

**Tech Stack:** Vercel AI SDK (`ai` + `@ai-sdk/anthropic`), Next.js App Router streaming, Claude claude-sonnet-4-20250514, Drizzle ORM, Radix UI Sheet, existing TRPC services for data access.

---

### Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install Vercel AI SDK and Anthropic provider**

```bash
npm install ai @ai-sdk/anthropic
```

**Step 2: Verify installation**

```bash
node -e "require('ai'); require('@ai-sdk/anthropic'); console.log('OK')"
```
Expected: `OK`

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add Vercel AI SDK and Anthropic provider dependencies"
```

---

### Task 2: Database Schema

**Files:**
- Modify: `src/server/db/schema.ts`
- Test: `src/server/db/__tests__/schema-chat.test.ts`

**Step 1: Write the failing test**

```typescript
// src/server/db/__tests__/schema-chat.test.ts
import { describe, it, expect } from "vitest";
import { chatConversations, chatMessages, chatMessageRoleEnum } from "../schema";

describe("Chat schema", () => {
  it("exports chatConversations table", () => {
    expect(chatConversations).toBeDefined();
  });

  it("exports chatMessages table", () => {
    expect(chatMessages).toBeDefined();
  });

  it("exports chatMessageRoleEnum", () => {
    expect(chatMessageRoleEnum).toBeDefined();
  });

  it("chatConversations has expected columns", () => {
    const cols = Object.keys(chatConversations);
    expect(cols).toContain("id");
    expect(cols).toContain("userId");
    expect(cols).toContain("title");
    expect(cols).toContain("createdAt");
    expect(cols).toContain("updatedAt");
  });

  it("chatMessages has expected columns", () => {
    const cols = Object.keys(chatMessages);
    expect(cols).toContain("id");
    expect(cols).toContain("conversationId");
    expect(cols).toContain("role");
    expect(cols).toContain("content");
    expect(cols).toContain("toolCalls");
    expect(cols).toContain("toolResults");
    expect(cols).toContain("createdAt");
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run src/server/db/__tests__/schema-chat.test.ts
```
Expected: FAIL — `chatConversations` is not exported

**Step 3: Write the schema**

Add to `src/server/db/schema.ts` (after existing table definitions, before relations):

```typescript
// Chat AI Assistant
export const chatMessageRoleEnum = pgEnum("chat_message_role", [
  "user",
  "assistant",
]);

export const chatConversations = pgTable(
  "chat_conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    title: text("title"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("chat_conversations_user_id_idx").on(table.userId),
  ]
);

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .references(() => chatConversations.id, { onDelete: "cascade" })
      .notNull(),
    role: chatMessageRoleEnum("role").notNull(),
    content: text("content").notNull(),
    toolCalls: jsonb("tool_calls"),
    toolResults: jsonb("tool_results"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("chat_messages_conversation_id_idx").on(table.conversationId),
  ]
);
```

Also add relations:

```typescript
export const chatConversationsRelations = relations(chatConversations, ({ one, many }) => ({
  user: one(users, {
    fields: [chatConversations.userId],
    references: [users.id],
  }),
  messages: many(chatMessages),
}));

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  conversation: one(chatConversations, {
    fields: [chatMessages.conversationId],
    references: [chatConversations.id],
  }),
}));
```

**Step 4: Run test to verify it passes**

```bash
npx vitest run src/server/db/__tests__/schema-chat.test.ts
```
Expected: PASS

**Step 5: Generate migration**

```bash
npx drizzle-kit generate
```

**Step 6: Commit**

```bash
git add src/server/db/schema.ts src/server/db/__tests__/schema-chat.test.ts drizzle/
git commit -m "feat(chat): add chat_conversations and chat_messages schema"
```

---

### Task 3: Chat Service (Conversation CRUD)

**Files:**
- Create: `src/server/services/chat.ts`
- Test: `src/server/services/__tests__/chat.test.ts`

**Step 1: Write the failing test**

```typescript
// src/server/services/__tests__/chat.test.ts
import { describe, it, expect } from "vitest";
import {
  createConversation,
  getConversation,
  listConversations,
  addMessage,
  deleteConversation,
  generateTitle,
} from "../chat";

describe("Chat service", () => {
  it("exports createConversation", () => {
    expect(createConversation).toBeDefined();
    expect(typeof createConversation).toBe("function");
  });

  it("exports getConversation", () => {
    expect(getConversation).toBeDefined();
    expect(typeof getConversation).toBe("function");
  });

  it("exports listConversations", () => {
    expect(listConversations).toBeDefined();
    expect(typeof listConversations).toBe("function");
  });

  it("exports addMessage", () => {
    expect(addMessage).toBeDefined();
    expect(typeof addMessage).toBe("function");
  });

  it("exports deleteConversation", () => {
    expect(deleteConversation).toBeDefined();
    expect(typeof deleteConversation).toBe("function");
  });

  it("exports generateTitle", () => {
    expect(generateTitle).toBeDefined();
    expect(typeof generateTitle).toBe("function");
  });

  describe("generateTitle", () => {
    it("generates title from first user message", () => {
      const title = generateTitle("What is my total equity across all properties?");
      expect(title).toBe("Total equity across all properties");
    });

    it("truncates long messages", () => {
      const longMsg = "A".repeat(100);
      const title = generateTitle(longMsg);
      expect(title.length).toBeLessThanOrEqual(53); // 50 + "..."
    });

    it("removes question marks", () => {
      const title = generateTitle("How do I add a property?");
      expect(title).not.toContain("?");
    });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run src/server/services/__tests__/chat.test.ts
```
Expected: FAIL — module not found

**Step 3: Implement the service**

```typescript
// src/server/services/chat.ts
import { db } from "@/server/db";
import { chatConversations, chatMessages } from "@/server/db/schema";
import { eq, and, desc } from "drizzle-orm";

export async function createConversation(userId: string, title?: string) {
  const [conversation] = await db
    .insert(chatConversations)
    .values({ userId, title: title || null })
    .returning();
  return conversation;
}

export async function getConversation(conversationId: string, userId: string) {
  const conversation = await db.query.chatConversations.findFirst({
    where: and(
      eq(chatConversations.id, conversationId),
      eq(chatConversations.userId, userId)
    ),
    with: { messages: { orderBy: [chatMessages.createdAt] } },
  });
  return conversation || null;
}

export async function listConversations(userId: string, limit = 20) {
  return db.query.chatConversations.findMany({
    where: eq(chatConversations.userId, userId),
    orderBy: [desc(chatConversations.updatedAt)],
    limit,
    columns: { id: true, title: true, createdAt: true, updatedAt: true },
  });
}

export async function addMessage(
  conversationId: string,
  role: "user" | "assistant",
  content: string,
  toolCalls?: unknown,
  toolResults?: unknown
) {
  const [message] = await db
    .insert(chatMessages)
    .values({
      conversationId,
      role,
      content,
      toolCalls: toolCalls || null,
      toolResults: toolResults || null,
    })
    .returning();

  // Update conversation timestamp
  await db
    .update(chatConversations)
    .set({ updatedAt: new Date() })
    .where(eq(chatConversations.id, conversationId));

  return message;
}

export async function deleteConversation(conversationId: string, userId: string) {
  await db
    .delete(chatConversations)
    .where(
      and(
        eq(chatConversations.id, conversationId),
        eq(chatConversations.userId, userId)
      )
    );
}

export function generateTitle(firstMessage: string): string {
  let title = firstMessage
    .replace(/\?/g, "")
    .replace(/^(what|how|where|when|why|can|do|does|is|are|show|tell|get|list)\s+(is|are|do|me|I|my)\s*/i, "")
    .replace(/^(what|how|where|when|why|can|do|does|is|are|show|tell|get|list)\s+/i, "")
    .trim();

  // Capitalize first letter
  title = title.charAt(0).toUpperCase() + title.slice(1);

  // Truncate
  if (title.length > 50) {
    title = title.slice(0, 50) + "...";
  }

  return title;
}
```

**Step 4: Run test to verify it passes**

```bash
npx vitest run src/server/services/__tests__/chat.test.ts
```
Expected: PASS

**Step 5: Commit**

```bash
git add src/server/services/chat.ts src/server/services/__tests__/chat.test.ts
git commit -m "feat(chat): add chat service for conversation CRUD"
```

---

### Task 4: TRPC Chat Router

**Files:**
- Create: `src/server/routers/chat.ts`
- Test: `src/server/routers/__tests__/chat.test.ts`
- Modify: `src/server/routers/_app.ts`

**Step 1: Write the failing test**

```typescript
// src/server/routers/__tests__/chat.test.ts
import { describe, it, expect } from "vitest";
import { chatRouter } from "../chat";

describe("Chat router", () => {
  it("exports chatRouter", () => {
    expect(chatRouter).toBeDefined();
  });

  it("has listConversations procedure", () => {
    expect(chatRouter.listConversations).toBeDefined();
  });

  it("has getConversation procedure", () => {
    expect(chatRouter.getConversation).toBeDefined();
  });

  it("has deleteConversation procedure", () => {
    expect(chatRouter.deleteConversation).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run src/server/routers/__tests__/chat.test.ts
```
Expected: FAIL

**Step 3: Implement the router**

```typescript
// src/server/routers/chat.ts
import { z } from "zod";
import { router, protectedProcedure, writeProcedure } from "../trpc";
import {
  listConversations,
  getConversation,
  deleteConversation,
} from "../services/chat";

export const chatRouter = router({
  listConversations: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(50).default(20) }).optional())
    .query(async ({ ctx, input }) => {
      return listConversations(ctx.user.id, input?.limit);
    }),

  getConversation: protectedProcedure
    .input(z.object({ conversationId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return getConversation(input.conversationId, ctx.user.id);
    }),

  deleteConversation: writeProcedure
    .input(z.object({ conversationId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await deleteConversation(input.conversationId, ctx.user.id);
      return { success: true };
    }),
});
```

**Step 4: Register in app router**

Add to `src/server/routers/_app.ts`:

Import:
```typescript
import { chatRouter } from "./chat";
```

In the `router({...})` object, add:
```typescript
  chat: chatRouter,
```

**Step 5: Run test to verify it passes**

```bash
npx vitest run src/server/routers/__tests__/chat.test.ts
```
Expected: PASS

**Step 6: Commit**

```bash
git add src/server/routers/chat.ts src/server/routers/__tests__/chat.test.ts src/server/routers/_app.ts
git commit -m "feat(chat): add TRPC router for conversation history"
```

---

### Task 5: Chat Tools Definition

**Files:**
- Create: `src/server/services/chat-tools.ts`
- Test: `src/server/services/__tests__/chat-tools.test.ts`

These tools wrap existing DB queries so Claude can access user data. Each tool takes parameters, runs a query using the existing Drizzle patterns, and returns structured JSON.

**Step 1: Write the failing test**

```typescript
// src/server/services/__tests__/chat-tools.test.ts
import { describe, it, expect } from "vitest";
import { getChatTools } from "../chat-tools";

describe("Chat tools", () => {
  it("exports getChatTools function", () => {
    expect(getChatTools).toBeDefined();
    expect(typeof getChatTools).toBe("function");
  });

  it("returns tool definitions with expected names", () => {
    const tools = getChatTools("fake-user-id");
    const toolNames = Object.keys(tools);

    expect(toolNames).toContain("getPortfolioSummary");
    expect(toolNames).toContain("listProperties");
    expect(toolNames).toContain("getPropertyDetails");
    expect(toolNames).toContain("getTransactions");
    expect(toolNames).toContain("getComplianceStatus");
    expect(toolNames).toContain("getTasks");
    expect(toolNames).toContain("getLoans");
  });

  it("each tool has description and parameters", () => {
    const tools = getChatTools("fake-user-id");
    for (const [name, tool] of Object.entries(tools)) {
      expect(tool).toHaveProperty("description");
      expect(tool).toHaveProperty("parameters");
      expect(tool).toHaveProperty("execute");
      expect(typeof (tool as { execute: unknown }).execute).toBe("function");
    }
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run src/server/services/__tests__/chat-tools.test.ts
```
Expected: FAIL

**Step 3: Implement the tools**

```typescript
// src/server/services/chat-tools.ts
import { z } from "zod";
import { tool } from "ai";
import { db } from "@/server/db";
import {
  properties,
  transactions,
  loans,
  tasks,
  complianceRecords,
  propertyValues,
} from "@/server/db/schema";
import { eq, and, desc, gte, lte, sql } from "drizzle-orm";
import {
  getRequirementsForState,
  type AustralianState,
} from "@/lib/compliance-requirements";
import { calculateComplianceStatus } from "../services/compliance";

export function getChatTools(userId: string) {
  return {
    getPortfolioSummary: tool({
      description:
        "Get a summary of the user's property portfolio including property count, total value, total loans, equity, and income/expense totals for the current financial year.",
      parameters: z.object({}),
      execute: async () => {
        const userProperties = await db.query.properties.findMany({
          where: eq(properties.userId, userId),
          columns: {
            id: true,
            address: true,
            suburb: true,
            state: true,
            purchasePrice: true,
            purchaseDate: true,
            status: true,
          },
        });

        const totalPurchaseValue = userProperties.reduce(
          (sum, p) => sum + Number(p.purchasePrice),
          0
        );

        // Get total loan balances
        const loanResult = await db
          .select({ total: sql<string>`COALESCE(SUM(current_balance::numeric), 0)` })
          .from(loans)
          .where(eq(loans.userId, userId));
        const totalLoans = Number(loanResult[0]?.total || 0);

        // Get latest valuations for total current value
        const valuations = [];
        for (const prop of userProperties) {
          const latest = await db.query.propertyValues.findFirst({
            where: eq(propertyValues.propertyId, prop.id),
            orderBy: [desc(propertyValues.valueDate)],
          });
          if (latest) {
            valuations.push({ propertyId: prop.id, value: Number(latest.estimatedValue) });
          }
        }
        const totalCurrentValue = valuations.reduce((sum, v) => sum + v.value, 0) || totalPurchaseValue;

        // FY dates (July 1 - June 30)
        const now = new Date();
        const fyYear = now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear();
        const fyStart = `${fyYear - 1}-07-01`;
        const fyEnd = `${fyYear}-06-30`;

        // Income and expenses for current FY
        const incomeResult = await db
          .select({ total: sql<string>`COALESCE(SUM(amount::numeric), 0)` })
          .from(transactions)
          .where(
            and(
              eq(transactions.userId, userId),
              eq(transactions.transactionType, "income"),
              gte(transactions.date, fyStart),
              lte(transactions.date, fyEnd)
            )
          );
        const expenseResult = await db
          .select({ total: sql<string>`COALESCE(SUM(ABS(amount::numeric)), 0)` })
          .from(transactions)
          .where(
            and(
              eq(transactions.userId, userId),
              eq(transactions.transactionType, "expense"),
              gte(transactions.date, fyStart),
              lte(transactions.date, fyEnd)
            )
          );

        const totalIncome = Number(incomeResult[0]?.total || 0);
        const totalExpenses = Number(expenseResult[0]?.total || 0);

        return {
          propertyCount: userProperties.length,
          activeProperties: userProperties.filter((p) => p.status === "active").length,
          totalPurchaseValue,
          totalCurrentValue,
          totalLoans,
          totalEquity: totalCurrentValue - totalLoans,
          currentFY: `FY${fyYear}`,
          totalIncome,
          totalExpenses,
          netCashFlow: totalIncome - totalExpenses,
          currency: "AUD",
        };
      },
    }),

    listProperties: tool({
      description:
        "List all properties in the portfolio with address, purchase price, and status.",
      parameters: z.object({}),
      execute: async () => {
        const props = await db.query.properties.findMany({
          where: eq(properties.userId, userId),
          orderBy: [desc(properties.createdAt)],
        });
        return props.map((p) => ({
          id: p.id,
          address: `${p.address}, ${p.suburb} ${p.state} ${p.postcode}`,
          purchasePrice: Number(p.purchasePrice),
          purchaseDate: p.purchaseDate,
          status: p.status,
          entityName: p.entityName,
        }));
      },
    }),

    getPropertyDetails: tool({
      description:
        "Get detailed information about a specific property including financials, loans, and latest valuation. Use listProperties first to get the property ID.",
      parameters: z.object({
        propertyId: z.string().uuid().describe("The property ID to look up"),
      }),
      execute: async ({ propertyId }) => {
        const property = await db.query.properties.findFirst({
          where: and(eq(properties.id, propertyId), eq(properties.userId, userId)),
        });
        if (!property) return { error: "Property not found" };

        const propertyLoans = await db.query.loans.findMany({
          where: eq(loans.propertyId, propertyId),
        });

        const latestValuation = await db.query.propertyValues.findFirst({
          where: eq(propertyValues.propertyId, propertyId),
          orderBy: [desc(propertyValues.valueDate)],
        });

        const totalLoanBalance = propertyLoans.reduce(
          (sum, l) => sum + Number(l.currentBalance),
          0
        );
        const currentValue = latestValuation
          ? Number(latestValuation.estimatedValue)
          : Number(property.purchasePrice);

        return {
          id: property.id,
          address: `${property.address}, ${property.suburb} ${property.state} ${property.postcode}`,
          purchasePrice: Number(property.purchasePrice),
          purchaseDate: property.purchaseDate,
          status: property.status,
          entityName: property.entityName,
          currentValue,
          equity: currentValue - totalLoanBalance,
          loans: propertyLoans.map((l) => ({
            lender: l.lender,
            balance: Number(l.currentBalance),
            rate: Number(l.interestRate),
            type: l.loanType,
            rateType: l.rateType,
            repayment: Number(l.repaymentAmount),
            frequency: l.repaymentFrequency,
          })),
          valuationDate: latestValuation?.valueDate || null,
          currency: "AUD",
        };
      },
    }),

    getTransactions: tool({
      description:
        "Search transactions with optional filters. Returns up to 20 results. Use for questions about income, expenses, specific categories, or date ranges.",
      parameters: z.object({
        propertyId: z.string().uuid().optional().describe("Filter by property ID"),
        category: z.string().optional().describe("Filter by category (e.g. rental_income, insurance, council_rates, water_rates, repairs_maintenance)"),
        startDate: z.string().optional().describe("Filter from date (YYYY-MM-DD)"),
        endDate: z.string().optional().describe("Filter to date (YYYY-MM-DD)"),
      }),
      execute: async ({ propertyId, category, startDate, endDate }) => {
        const conditions = [eq(transactions.userId, userId)];
        if (propertyId) conditions.push(eq(transactions.propertyId, propertyId));
        if (category) conditions.push(eq(transactions.category, category as never));
        if (startDate) conditions.push(gte(transactions.date, startDate));
        if (endDate) conditions.push(lte(transactions.date, endDate));

        const results = await db.query.transactions.findMany({
          where: and(...conditions),
          orderBy: [desc(transactions.date)],
          limit: 20,
          with: { property: { columns: { address: true, suburb: true } } },
        });

        return {
          transactions: results.map((t) => ({
            date: t.date,
            description: t.description,
            amount: Number(t.amount),
            category: t.category,
            type: t.transactionType,
            propertyAddress: t.property
              ? `${t.property.address}, ${t.property.suburb}`
              : "Unassigned",
            isVerified: t.isVerified,
          })),
          count: results.length,
          note: results.length === 20 ? "Showing first 20 results. Narrow your search for more specific results." : undefined,
        };
      },
    }),

    getComplianceStatus: tool({
      description:
        "Get compliance status across the portfolio — overdue items, upcoming due dates, and overall compliance health.",
      parameters: z.object({
        propertyId: z.string().uuid().optional().describe("Filter by property ID, or omit for portfolio-wide"),
      }),
      execute: async ({ propertyId }) => {
        const userProps = propertyId
          ? await db.query.properties.findMany({
              where: and(eq(properties.id, propertyId), eq(properties.userId, userId)),
            })
          : await db.query.properties.findMany({
              where: eq(properties.userId, userId),
            });

        if (userProps.length === 0) return { error: "No properties found" };

        const allRecords = await db.query.complianceRecords.findMany({
          where: eq(complianceRecords.userId, userId),
        });

        const items = [];
        for (const prop of userProps) {
          const reqs = getRequirementsForState(prop.state as AustralianState);
          const propRecords = allRecords.filter((r) => r.propertyId === prop.id);

          for (const req of reqs) {
            const lastRecord = propRecords.find((r) => r.requirementId === req.id);
            let status = "never_completed";
            let nextDueAt = null;

            if (lastRecord) {
              nextDueAt = lastRecord.nextDueAt;
              status = calculateComplianceStatus(new Date(lastRecord.nextDueAt));
            }

            items.push({
              propertyAddress: `${prop.address}, ${prop.suburb}`,
              requirement: req.name,
              status,
              nextDueAt,
            });
          }
        }

        return {
          total: items.length,
          overdue: items.filter((i) => i.status === "overdue"),
          dueSoon: items.filter((i) => i.status === "due_soon"),
          compliant: items.filter((i) => i.status === "compliant").length,
          neverCompleted: items.filter((i) => i.status === "never_completed").length,
        };
      },
    }),

    getTasks: tool({
      description: "Get the user's tasks, optionally filtered by status or property.",
      parameters: z.object({
        status: z
          .enum(["todo", "in_progress", "done"])
          .optional()
          .describe("Filter by task status"),
        propertyId: z.string().uuid().optional().describe("Filter by property"),
      }),
      execute: async ({ status, propertyId }) => {
        const conditions = [eq(tasks.userId, userId)];
        if (status) conditions.push(eq(tasks.status, status));
        if (propertyId) conditions.push(eq(tasks.propertyId, propertyId));

        const results = await db
          .select({
            task: tasks,
            propertyAddress: properties.address,
            propertySuburb: properties.suburb,
          })
          .from(tasks)
          .leftJoin(properties, eq(tasks.propertyId, properties.id))
          .where(and(...conditions))
          .orderBy(desc(tasks.createdAt))
          .limit(20);

        return results.map((r) => ({
          title: r.task.title,
          description: r.task.description,
          status: r.task.status,
          priority: r.task.priority,
          dueDate: r.task.dueDate,
          property: r.propertyAddress
            ? `${r.propertyAddress}, ${r.propertySuburb}`
            : null,
        }));
      },
    }),

    getLoans: tool({
      description: "Get loan details across the portfolio or for a specific property.",
      parameters: z.object({
        propertyId: z.string().uuid().optional().describe("Filter by property"),
      }),
      execute: async ({ propertyId }) => {
        const conditions = [eq(loans.userId, userId)];
        if (propertyId) conditions.push(eq(loans.propertyId, propertyId));

        const results = await db.query.loans.findMany({
          where: and(...conditions),
          with: { property: { columns: { address: true, suburb: true } } },
        });

        return results.map((l) => ({
          lender: l.lender,
          currentBalance: Number(l.currentBalance),
          originalAmount: Number(l.originalAmount),
          interestRate: Number(l.interestRate),
          loanType: l.loanType,
          rateType: l.rateType,
          repaymentAmount: Number(l.repaymentAmount),
          repaymentFrequency: l.repaymentFrequency,
          fixedRateExpiry: l.fixedRateExpiry,
          property: l.property
            ? `${l.property.address}, ${l.property.suburb}`
            : "Unknown",
        }));
      },
    }),
  };
}
```

**Step 4: Run test to verify it passes**

```bash
npx vitest run src/server/services/__tests__/chat-tools.test.ts
```
Expected: PASS

**Step 5: Commit**

```bash
git add src/server/services/chat-tools.ts src/server/services/__tests__/chat-tools.test.ts
git commit -m "feat(chat): add AI chat tools wrapping existing data queries"
```

---

### Task 6: Chat API Route (Streaming)

**Files:**
- Create: `src/app/api/chat/route.ts`

This is the streaming endpoint. It uses the Vercel AI SDK `streamText` function with Claude and our tools.

**Step 1: Implement the route**

```typescript
// src/app/api/chat/route.ts
import { anthropic } from "@ai-sdk/anthropic";
import { streamText } from "ai";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { getChatTools } from "@/server/services/chat-tools";
import {
  createConversation,
  getConversation,
  addMessage,
  generateTitle,
} from "@/server/services/chat";

function buildSystemPrompt(userName: string, propertyCount: number, currentRoute: string) {
  const now = new Date();
  const fyYear = now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear();

  return `You are the PropertyTracker AI Assistant. You help Australian property investors understand their portfolio, find insights in their data, and navigate the app.

Context:
- User: ${userName}
- Portfolio: ${propertyCount} properties
- Current page: ${currentRoute}
- Current date: ${now.toISOString().split("T")[0]}
- Financial year: FY${fyYear} (1 July ${fyYear - 1} – 30 June ${fyYear})

Capabilities:
- Query portfolio data using tools (properties, transactions, loans, valuations, compliance, tasks)
- Explain app features and guide navigation
- Provide general Australian property investment knowledge

Limitations:
- You CANNOT create, edit, or delete any data — read-only access
- You CANNOT access bank connections or trigger syncs
- You CANNOT provide specific financial or tax advice — recommend consulting a tax professional
- You do NOT have access to other users' data

Formatting:
- Keep responses concise — this is a chat panel, not a full page.
- Use markdown (bold, lists, tables) for clarity.
- Financial figures in AUD with commas (e.g., $1,250,000).
- When referencing app pages, give the nav path (e.g., "Properties → 123 Main St → Financials").

App Navigation:
- Dashboard: Portfolio overview and performance charts
- Properties: Add/manage properties, documents, compliance
- Transactions: View/categorize income and expenses
- Reports: Tax position, CGT, depreciation, benchmarking
- Tasks: Property-related to-dos with reminders
- Emails: Forwarded property emails and invoice matching
- Settings: Account, notifications, bank connections, entities`;
}

export async function POST(req: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const user = await db.query.users.findFirst({
    where: eq(users.clerkId, clerkId),
  });
  if (!user) {
    return new Response("User not found", { status: 404 });
  }

  const body = await req.json();
  const { messages, conversationId, currentRoute = "/dashboard" } = body;

  // Get or create conversation
  let convId = conversationId;
  if (!convId) {
    const firstUserMsg = messages.find((m: { role: string }) => m.role === "user");
    const title = firstUserMsg ? generateTitle(firstUserMsg.content) : null;
    const conversation = await createConversation(user.id, title || undefined);
    convId = conversation.id;
  }

  // Save the latest user message
  const lastUserMessage = [...messages].reverse().find((m: { role: string }) => m.role === "user");
  if (lastUserMessage) {
    await addMessage(convId, "user", lastUserMessage.content);
  }

  // Count properties for system prompt
  const { properties: propsTable } = await import("@/server/db/schema");
  const propCount = await db
    .select({ count: eq(propsTable.userId, user.id) })
    .from(propsTable)
    .where(eq(propsTable.userId, user.id));

  const tools = getChatTools(user.id);

  const result = streamText({
    model: anthropic("claude-sonnet-4-20250514"),
    system: buildSystemPrompt(
      user.name || user.email,
      propCount.length,
      currentRoute
    ),
    messages,
    tools,
    maxSteps: 5,
    onFinish: async ({ text }) => {
      if (text) {
        await addMessage(convId, "assistant", text);
      }
    },
  });

  return result.toDataStreamResponse({
    headers: { "x-conversation-id": convId },
  });
}
```

**Step 2: Commit**

```bash
git add src/app/api/chat/route.ts
git commit -m "feat(chat): add streaming chat API route with Claude and tool use"
```

---

### Task 7: Chat UI Components

**Files:**
- Create: `src/components/chat/ChatProvider.tsx`
- Create: `src/components/chat/ChatButton.tsx`
- Create: `src/components/chat/ChatPanel.tsx`
- Create: `src/components/chat/ChatMessageList.tsx`
- Create: `src/components/chat/ChatMessage.tsx`
- Create: `src/components/chat/ChatInput.tsx`

**Step 1: Create ChatProvider (state management)**

```typescript
// src/components/chat/ChatProvider.tsx
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
```

**Step 2: Create ChatMessage**

```typescript
// src/components/chat/ChatMessage.tsx
"use client";

import { cn } from "@/lib/utils";
import type { Message } from "ai";

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-lg px-3 py-2 text-sm",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground"
        )}
      >
        <div className="whitespace-pre-wrap break-words prose prose-sm dark:prose-invert max-w-none">
          {message.content}
        </div>
      </div>
    </div>
  );
}
```

**Step 3: Create ChatMessageList**

```typescript
// src/components/chat/ChatMessageList.tsx
"use client";

import { useEffect, useRef } from "react";
import { ChatMessage } from "./ChatMessage";
import type { Message } from "ai";
import { Loader2 } from "lucide-react";

interface ChatMessageListProps {
  messages: Message[];
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
```

**Step 4: Create ChatInput**

```typescript
// src/components/chat/ChatInput.tsx
"use client";

import { useRef, type KeyboardEvent, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SendHorizonal } from "lucide-react";

interface ChatInputProps {
  input: string;
  setInput: (value: string) => void;
  onSubmit: (e: FormEvent) => void;
  isLoading: boolean;
}

export function ChatInput({ input, setInput, onSubmit, isLoading }: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() && !isLoading) {
        onSubmit(e as unknown as FormEvent);
      }
    }
  };

  return (
    <form onSubmit={onSubmit} className="border-t p-3 flex gap-2">
      <Textarea
        ref={textareaRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask about your portfolio..."
        className="min-h-[40px] max-h-[120px] resize-none text-sm"
        rows={1}
        disabled={isLoading}
      />
      <Button
        type="submit"
        size="icon"
        disabled={!input.trim() || isLoading}
        className="shrink-0"
      >
        <SendHorizonal className="h-4 w-4" />
      </Button>
    </form>
  );
}
```

**Step 5: Create ChatPanel**

```typescript
// src/components/chat/ChatPanel.tsx
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
```

**Step 6: Create ChatButton**

```typescript
// src/components/chat/ChatButton.tsx
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
```

**Step 7: Commit**

```bash
git add src/components/chat/
git commit -m "feat(chat): add chat UI components (panel, button, messages, input)"
```

---

### Task 8: Layout Integration

**Files:**
- Modify: `src/app/(dashboard)/layout.tsx`

**Step 1: Update the dashboard layout**

Add the ChatProvider, ChatButton, and ChatPanel to the dashboard layout:

```typescript
// src/app/(dashboard)/layout.tsx
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { ChatProvider } from "@/components/chat/ChatProvider";
import { ChatButton } from "@/components/chat/ChatButton";
import { ChatPanel } from "@/components/chat/ChatPanel";

// All dashboard pages require auth - skip static generation
export const dynamic = "force-dynamic";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ChatProvider>
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <Header />
          <main className="flex-1 p-6 bg-secondary">{children}</main>
        </div>
      </div>
      <ChatButton />
      <ChatPanel />
    </ChatProvider>
  );
}
```

**Step 2: Commit**

```bash
git add src/app/(dashboard)/layout.tsx
git commit -m "feat(chat): integrate chat button and panel into dashboard layout"
```

---

### Task 9: TypeScript & Lint Fix Pass

**Step 1: Run TypeScript check**

```bash
npx tsc --noEmit
```

Fix any type errors that arise from the new files. Common issues:
- Import paths
- Tool parameter types
- Message type mismatches between AI SDK and our DB schema

**Step 2: Run linter**

```bash
npx eslint src/components/chat/ src/server/services/chat.ts src/server/services/chat-tools.ts src/server/routers/chat.ts src/app/api/chat/ --fix
```

**Step 3: Run all tests**

```bash
npx vitest run
```

Fix any failures.

**Step 4: Commit fixes**

```bash
git add -A
git commit -m "fix(chat): resolve TypeScript and lint errors"
```

---

### Task 10: Manual Testing & Polish

**Step 1: Start the dev server**

```bash
npm run dev
```

**Step 2: Test the chat flow**

1. Navigate to `/dashboard`
2. Click the floating chat button (bottom-right)
3. Verify the panel slides open
4. Type "What is my total equity?" and press Enter
5. Verify streaming response with tool usage
6. Try "List my properties"
7. Try "Show me overdue compliance items"
8. Try "How do I add a property?" (app help)
9. Click "New Chat" button and verify conversation resets
10. Close and reopen panel — verify state persists

**Step 3: Fix any issues found during testing**

Address UI spacing, streaming errors, tool failures, etc.

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat(chat): polish chat assistant UI and fix edge cases"
```

---

## Summary

| Task | Description |
|------|-------------|
| 1 | Install `ai` and `@ai-sdk/anthropic` |
| 2 | Database schema (conversations + messages tables) |
| 3 | Chat service (CRUD for conversations) |
| 4 | TRPC router (conversation history endpoints) |
| 5 | Chat tools (7 read-only tools wrapping existing queries) |
| 6 | API route (`/api/chat` with streaming + tools) |
| 7 | UI components (ChatProvider, ChatButton, ChatPanel, ChatMessage, ChatInput) |
| 8 | Layout integration (inject into dashboard layout) |
| 9 | TypeScript + lint fix pass |
| 10 | Manual testing and polish |
