import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { bankAccounts, transactions } from "@/server/db/schema";
import { eq } from "drizzle-orm";

// Basiq webhook event types
type BasiqWebhookEvent = {
  type: string;
  data: {
    connectionId?: string;
    accountId?: string;
    userId?: string;
    status?: string;
  };
};

export async function POST(request: NextRequest) {
  try {
    const event: BasiqWebhookEvent = await request.json();

    console.log("Received Basiq webhook:", event.type);

    switch (event.type) {
      case "connection.created":
      case "connection.updated":
        // Handle connection status updates
        if (event.data.connectionId) {
          await handleConnectionUpdate(event.data.connectionId, event.data.status);
        }
        break;

      case "transactions.created":
      case "transactions.updated":
        // Handle new transactions
        if (event.data.accountId) {
          await handleTransactionSync(event.data.accountId);
        }
        break;

      case "connection.deleted":
        // Handle disconnection
        if (event.data.connectionId) {
          await handleConnectionDeleted(event.data.connectionId);
        }
        break;

      default:
        console.log("Unhandled webhook event type:", event.type);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Basiq webhook error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}

async function handleConnectionUpdate(connectionId: string, status?: string) {
  // Update connection status in our database
  const isConnected = status === "active" || status === "connected";

  await db
    .update(bankAccounts)
    .set({
      isConnected,
      lastSyncedAt: new Date(),
    })
    .where(eq(bankAccounts.basiqConnectionId, connectionId));
}

async function handleTransactionSync(accountId: string) {
  // In a full implementation, this would:
  // 1. Fetch new transactions from Basiq API
  // 2. Map them to our schema
  // 3. Insert into database with auto-categorization

  // For now, just update the last synced timestamp
  await db
    .update(bankAccounts)
    .set({
      lastSyncedAt: new Date(),
    })
    .where(eq(bankAccounts.basiqAccountId, accountId));
}

async function handleConnectionDeleted(connectionId: string) {
  // Mark connection as disconnected
  await db
    .update(bankAccounts)
    .set({
      isConnected: false,
    })
    .where(eq(bankAccounts.basiqConnectionId, connectionId));
}

// Verify webhook authenticity (in production)
function verifyWebhookSignature(
  payload: string,
  signature: string | null
): boolean {
  // TODO: Implement signature verification using Basiq's webhook secret
  // For now, accept all requests in development
  return true;
}
