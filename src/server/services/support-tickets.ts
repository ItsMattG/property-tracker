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
