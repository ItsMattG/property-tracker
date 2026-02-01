import { Webhook } from "svix";
import { headers } from "next/headers";
import { WebhookEvent } from "@clerk/nextjs/server";
import { addDays } from "date-fns";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: Request) {
  // Get the headers
  const headersList = await headers();
  const svix_id = headersList.get("svix-id");
  const svix_timestamp = headersList.get("svix-timestamp");
  const svix_signature = headersList.get("svix-signature");

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response("Error: Missing svix headers", {
      status: 400,
    });
  }

  // Get the body
  const payload = await req.json();
  const body = JSON.stringify(payload);

  // Create a new Svix instance with your secret
  const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET || "");

  let evt: WebhookEvent;

  // Verify the payload with the headers
  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error("Error verifying webhook:", err);
    return new Response("Error: Verification failed", {
      status: 400,
    });
  }

  // Handle the webhook
  const eventType = evt.type;

  if (eventType === "user.created") {
    const { id, email_addresses, first_name, last_name } = evt.data;
    const primaryEmail = email_addresses.find(
      (e) => e.id === evt.data.primary_email_address_id
    );

    if (!primaryEmail) {
      console.error("No primary email found for user:", id);
      return new Response("Error: No primary email", { status: 400 });
    }

    const name = [first_name, last_name].filter(Boolean).join(" ") || null;

    try {
      const now = new Date();
      await db.insert(users).values({
        clerkId: id,
        email: primaryEmail.email_address,
        name,
        trialStartedAt: now,
        trialEndsAt: addDays(now, 14),
        trialPlan: "pro",
      });

      console.log("User created with 14-day Pro trial:", id);
    } catch (error) {
      console.error("Error creating user:", error);
      return new Response("Error: Database insert failed", { status: 500 });
    }
  }

  if (eventType === "user.updated") {
    const { id, email_addresses, first_name, last_name } = evt.data;
    const primaryEmail = email_addresses.find(
      (e) => e.id === evt.data.primary_email_address_id
    );

    if (!primaryEmail) {
      console.error("No primary email found for user:", id);
      return new Response("Error: No primary email", { status: 400 });
    }

    const name = [first_name, last_name].filter(Boolean).join(" ") || null;

    try {
      await db
        .update(users)
        .set({
          email: primaryEmail.email_address,
          name,
          updatedAt: new Date(),
        })
        .where(eq(users.clerkId, id));

      console.log("User updated in database:", id);
    } catch (error) {
      console.error("Error updating user:", error);
      return new Response("Error: Database update failed", { status: 500 });
    }
  }

  if (eventType === "user.deleted") {
    const { id } = evt.data;

    if (!id) {
      return new Response("Error: No user ID", { status: 400 });
    }

    try {
      // The cascade delete will handle properties, transactions, etc.
      await db.delete(users).where(eq(users.clerkId, id));

      console.log("User deleted from database:", id);
    } catch (error) {
      console.error("Error deleting user:", error);
      return new Response("Error: Database delete failed", { status: 500 });
    }
  }

  return new Response("Webhook processed", { status: 200 });
}
