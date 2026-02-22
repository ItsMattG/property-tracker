import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { bankAccounts } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { createHmac, timingSafeEqual } from "crypto";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

const WEBHOOK_SECRET = process.env.BASIQ_WEBHOOK_SECRET;

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

function verifyWebhookSignature(
  payload: string,
  signature: string | null
): boolean {
  if (!WEBHOOK_SECRET || !signature) {
    return false;
  }

  const expectedSignature = createHmac("sha256", WEBHOOK_SECRET)
    .update(payload)
    .digest("hex");

  try {
    return timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.text();
    const signature = request.headers.get("x-basiq-signature");

    // Verify signature when secret is configured (required in production)
    if (WEBHOOK_SECRET) {
      if (!verifyWebhookSignature(payload, signature)) {
        return NextResponse.json(
          { error: "Invalid signature" },
          { status: 401 }
        );
      }
    } else if (process.env.NODE_ENV === "production") {
      logger.error("BASIQ_WEBHOOK_SECRET not configured in production", undefined, { domain: "webhooks", provider: "basiq" });
      return NextResponse.json(
        { error: "Webhook not configured" },
        { status: 500 }
      );
    }

    const event: BasiqWebhookEvent = JSON.parse(payload);

    switch (event.type) {
      case "connection.created":
      case "connection.updated":
        if (event.data.connectionId) {
          await handleConnectionUpdate(
            event.data.connectionId,
            event.data.status
          );
        }
        break;

      case "transactions.created":
      case "transactions.updated":
        if (event.data.accountId) {
          await handleTransactionSync(event.data.accountId);
        }
        break;

      case "connection.deleted":
        if (event.data.connectionId) {
          await handleConnectionDeleted(event.data.connectionId);
        }
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}

async function handleConnectionUpdate(connectionId: string, status?: string) {
  const isConnected = status === "active" || status === "connected";
  await db
    .update(bankAccounts)
    .set({ isConnected, lastSyncedAt: new Date() })
    .where(eq(bankAccounts.basiqConnectionId, connectionId));
}

async function handleTransactionSync(accountId: string) {
  await db
    .update(bankAccounts)
    .set({ lastSyncedAt: new Date() })
    .where(eq(bankAccounts.basiqAccountId, accountId));
}

async function handleConnectionDeleted(connectionId: string) {
  await db
    .update(bankAccounts)
    .set({ isConnected: false })
    .where(eq(bankAccounts.basiqConnectionId, connectionId));
}
