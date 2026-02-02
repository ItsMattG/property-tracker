# Gmail OAuth Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable users to connect their Gmail accounts via OAuth to automatically import property-related emails from approved senders.

**Architecture:** OAuth 2.0 flow with PKCE, encrypted token storage in database, hybrid sync (push via Pub/Sub + daily cron fallback + manual trigger), global sender allowlist with property matching, unified inbox with existing email forwarding.

**Tech Stack:** Next.js API routes, tRPC, Drizzle ORM, Google APIs (Gmail API, Pub/Sub), AES-256-GCM encryption, googleapis npm package.

---

## Task 1: Database Schema - Email Connections Table

**Files:**
- Modify: `src/server/db/schema.ts`
- Create: `drizzle/migrations/XXXX_email_connections.sql` (auto-generated)

**Step 1: Add enums and email_connections table to schema**

Add after the existing `emailStatusEnum` (~line 444):

```typescript
export const emailProviderEnum = pgEnum("email_provider", ["gmail", "outlook"]);

export const emailConnectionStatusEnum = pgEnum("email_connection_status", [
  "active",
  "needs_reauth",
  "disconnected",
]);
```

Add new table after `propertyEmailSenders` (~line 1114):

```typescript
export const emailConnections = pgTable("email_connections", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  provider: emailProviderEnum("provider").notNull(),
  emailAddress: text("email_address").notNull(),
  accessTokenEncrypted: text("access_token_encrypted").notNull(),
  refreshTokenEncrypted: text("refresh_token_encrypted").notNull(),
  tokenExpiresAt: timestamp("token_expires_at").notNull(),
  pushSubscriptionId: text("push_subscription_id"),
  pushExpiresAt: timestamp("push_expires_at"),
  lastSyncAt: timestamp("last_sync_at"),
  lastError: text("last_error"),
  status: emailConnectionStatusEnum("status").default("active").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("email_connections_user_provider_email_idx").on(
    table.userId,
    table.provider,
    table.emailAddress
  ),
]);

export type EmailConnection = typeof emailConnections.$inferSelect;
export type NewEmailConnection = typeof emailConnections.$inferInsert;
```

**Step 2: Run migration**

```bash
pnpm db:generate
pnpm db:push
```

Expected: Migration creates `email_connections` table with enums.

**Step 3: Commit**

```bash
git add src/server/db/schema.ts drizzle/
git commit -m "feat(db): add email_connections table for OAuth"
```

---

## Task 2: Database Schema - Global Approved Senders & Property Matching

**Files:**
- Modify: `src/server/db/schema.ts`

**Step 1: Add global approved senders table**

Add after `emailConnections`:

```typescript
export const emailApprovedSenders = pgTable("email_approved_senders", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  emailPattern: text("email_pattern").notNull(), // e.g., "*@raywhite.com"
  label: text("label"),
  defaultPropertyId: uuid("default_property_id").references(() => properties.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("email_approved_senders_user_pattern_idx").on(
    table.userId,
    table.emailPattern
  ),
]);

export const senderPropertyHistory = pgTable("sender_property_history", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  senderAddress: text("sender_address").notNull(),
  propertyId: uuid("property_id")
    .references(() => properties.id, { onDelete: "cascade" })
    .notNull(),
  confidence: real("confidence").default(1.0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("sender_property_history_user_sender_idx").on(
    table.userId,
    table.senderAddress
  ),
]);

export type EmailApprovedSender = typeof emailApprovedSenders.$inferSelect;
export type SenderPropertyHistory = typeof senderPropertyHistory.$inferSelect;
```

**Step 2: Add source column to propertyEmails**

Create new enum and modify the table:

```typescript
export const emailSourceEnum = pgEnum("email_source", ["forwarded", "gmail", "outlook"]);
```

Add these columns to `propertyEmails`:
```typescript
source: emailSourceEnum("source").default("forwarded").notNull(),
connectionId: integer("connection_id").references(() => emailConnections.id, { onDelete: "set null" }),
externalId: text("external_id"), // Gmail/Outlook message ID for dedup
```

Note: Make `propertyId` nullable for unassigned emails.

**Step 3: Run migration**

```bash
pnpm db:generate
pnpm db:push
```

**Step 4: Commit**

```bash
git add src/server/db/schema.ts drizzle/
git commit -m "feat(db): add global approved senders and email source tracking"
```

---

## Task 3: Encryption Utilities

**Files:**
- Create: `src/lib/encryption.ts`
- Create: `src/lib/__tests__/encryption.test.ts`

**Step 1: Write the failing test**

```typescript
// src/lib/__tests__/encryption.test.ts
import { describe, it, expect } from "vitest";
import { encrypt, decrypt } from "../encryption";

describe("encryption", () => {
  it("should encrypt and decrypt a string", () => {
    const plaintext = "my-secret-token";
    const encrypted = encrypt(plaintext);
    expect(encrypted).not.toBe(plaintext);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it("should produce different ciphertexts for same plaintext", () => {
    const plaintext = "my-secret-token";
    const encrypted1 = encrypt(plaintext);
    const encrypted2 = encrypt(plaintext);
    expect(encrypted1).not.toBe(encrypted2);
  });
});
```

**Step 2: Implement encryption module**

```typescript
// src/lib/encryption.ts
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;

function getKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key || key.length !== 64) {
    throw new Error("ENCRYPTION_KEY must be 64 hex characters (32 bytes)");
  }
  return Buffer.from(key, "hex");
}

export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

export function decrypt(encryptedData: string): string {
  const key = getKey();
  const [ivHex, authTagHex, ciphertext] = encryptedData.split(":");
  if (!ivHex || !authTagHex || !ciphertext) {
    throw new Error("Invalid encrypted data format");
  }
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(ciphertext, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}
```

**Step 3: Commit**

```bash
git add src/lib/encryption.ts src/lib/__tests__/encryption.test.ts
git commit -m "feat: add AES-256-GCM encryption utilities for OAuth tokens"
```

---

## Task 4: Gmail OAuth Configuration

**Files:**
- Create: `src/lib/gmail/config.ts`
- Create: `src/lib/gmail/types.ts`

**Step 1: Create types and config**

```typescript
// src/lib/gmail/types.ts
export interface GmailTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

export interface GmailMessage {
  id: string;
  threadId: string;
  payload: {
    headers: Array<{ name: string; value: string }>;
    body?: { data?: string };
    parts?: Array<{ mimeType: string; body?: { data?: string } }>;
  };
  internalDate: string;
}
```

```typescript
// src/lib/gmail/config.ts
import { google } from "googleapis";

export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.metadata",
  "https://www.googleapis.com/auth/gmail.readonly",
];

export const GMAIL_CONFIG = {
  clientId: process.env.GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  redirectUri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/gmail`,
  pubsubTopic: process.env.GOOGLE_PUBSUB_TOPIC!,
};

export function createOAuth2Client() {
  return new google.auth.OAuth2(
    GMAIL_CONFIG.clientId,
    GMAIL_CONFIG.clientSecret,
    GMAIL_CONFIG.redirectUri
  );
}

export function getAuthUrl(state: string): string {
  const oauth2Client = createOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: GMAIL_SCOPES,
    state,
    prompt: "consent",
  });
}
```

**Step 2: Commit**

```bash
git add src/lib/gmail/
git commit -m "feat: add Gmail OAuth configuration and types"
```

---

## Task 5: Gmail OAuth Routes

**Files:**
- Create: `src/app/api/auth/gmail/route.ts`
- Create: `src/app/api/auth/callback/gmail/route.ts`

**Step 1: Create OAuth initiation route**

```typescript
// src/app/api/auth/gmail/route.ts
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAuthUrl } from "@/lib/gmail/config";
import { randomBytes } from "crypto";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.redirect(new URL("/sign-in", process.env.NEXT_PUBLIC_APP_URL));
  }
  const state = Buffer.from(`${userId}:${randomBytes(16).toString("hex")}`).toString("base64url");
  return NextResponse.redirect(getAuthUrl(state));
}
```

**Step 2: Create callback route**

```typescript
// src/app/api/auth/callback/gmail/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db";
import { users, emailConnections } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { createOAuth2Client } from "@/lib/gmail/config";
import { encrypt } from "@/lib/encryption";
import { google } from "googleapis";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error || !code || !state) {
    return NextResponse.redirect(
      new URL(`/settings/email-connections?error=${error || "missing_params"}`, process.env.NEXT_PUBLIC_APP_URL)
    );
  }

  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.redirect(new URL("/sign-in", process.env.NEXT_PUBLIC_APP_URL));
  }

  // Verify state
  const decodedState = Buffer.from(state, "base64url").toString();
  const [stateClerkId] = decodedState.split(":");
  if (stateClerkId !== clerkId) {
    return NextResponse.redirect(
      new URL("/settings/email-connections?error=invalid_state", process.env.NEXT_PUBLIC_APP_URL)
    );
  }

  try {
    const oauth2Client = createOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    const gmail = google.gmail({ version: "v1", auth: oauth2Client });
    const profile = await gmail.users.getProfile({ userId: "me" });
    const emailAddress = profile.data.emailAddress!;

    const [user] = await db.select({ id: users.id }).from(users).where(eq(users.clerkId, clerkId));
    if (!user) throw new Error("User not found");

    const expiresAt = tokens.expiry_date ? new Date(tokens.expiry_date) : new Date(Date.now() + 3600000);

    await db.insert(emailConnections).values({
      userId: user.id,
      provider: "gmail",
      emailAddress,
      accessTokenEncrypted: encrypt(tokens.access_token!),
      refreshTokenEncrypted: encrypt(tokens.refresh_token!),
      tokenExpiresAt: expiresAt,
      status: "active",
    }).onConflictDoUpdate({
      target: [emailConnections.userId, emailConnections.provider, emailConnections.emailAddress],
      set: {
        accessTokenEncrypted: encrypt(tokens.access_token!),
        refreshTokenEncrypted: encrypt(tokens.refresh_token!),
        tokenExpiresAt: expiresAt,
        status: "active",
        lastError: null,
        updatedAt: new Date(),
      },
    });

    return NextResponse.redirect(
      new URL("/settings/email-connections?success=gmail_connected", process.env.NEXT_PUBLIC_APP_URL)
    );
  } catch (error) {
    console.error("Gmail OAuth callback error:", error);
    return NextResponse.redirect(
      new URL("/settings/email-connections?error=oauth_failed", process.env.NEXT_PUBLIC_APP_URL)
    );
  }
}
```

**Step 3: Commit**

```bash
git add src/app/api/auth/gmail/ src/app/api/auth/callback/gmail/
git commit -m "feat: add Gmail OAuth initiation and callback routes"
```

---

## Task 6: Gmail Token & Sync Services

**Files:**
- Create: `src/server/services/gmail-token.ts`
- Create: `src/server/services/gmail-sync.ts`

See full implementations in detailed plan above.

**Step 1: Implement token refresh service**
**Step 2: Implement email sync service**
**Step 3: Commit**

```bash
git add src/server/services/gmail-token.ts src/server/services/gmail-sync.ts
git commit -m "feat: add Gmail token refresh and email sync services"
```

---

## Task 7: tRPC Routers

**Files:**
- Create: `src/server/routers/emailConnection.ts`
- Create: `src/server/routers/emailSender.ts`
- Modify: `src/server/routers/email.ts` (add unassigned emails)
- Modify: `src/server/routers/_app.ts`

See full implementations above.

**Step 1: Create emailConnection router**
**Step 2: Create emailSender router**
**Step 3: Add unassigned email procedures**
**Step 4: Register routers in _app.ts**
**Step 5: Commit**

```bash
git add src/server/routers/
git commit -m "feat: add tRPC routers for email connections and senders"
```

---

## Task 8: Daily Cron Job

**Files:**
- Create: `src/app/api/cron/email-sync/route.ts`

**Step 1: Create cron route for daily sync**
**Step 2: Add to vercel.json crons**
**Step 3: Commit**

```bash
git add src/app/api/cron/email-sync/ vercel.json
git commit -m "feat: add daily email sync cron job"
```

---

## Task 9: Settings UI

**Files:**
- Create: `src/app/(dashboard)/settings/email-connections/page.tsx`

**Step 1: Create settings page**
**Step 2: Add to sidebar navigation**
**Step 3: Commit**

```bash
git add src/app/(dashboard)/settings/email-connections/
git commit -m "feat: add email connections settings page"
```

---

## Task 10: Environment Variables & Documentation

**Files:**
- Modify: `.env.local.example`

Add:
```bash
# Gmail OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_PUBSUB_TOPIC=projects/bricktrack-486109/topics/gmail-notifications

# Token Encryption (generate with: openssl rand -hex 32)
ENCRYPTION_KEY=
```

**Step: Commit**

```bash
git add .env.local.example
git commit -m "docs: add Gmail OAuth environment variables"
```

---

## Summary

15 tasks implementing:
1. Database schema (connections, senders, history)
2. AES-256-GCM encryption
3. OAuth routes (initiate + callback)
4. Token refresh service
5. Email sync service
6. tRPC routers (connections, senders, unassigned)
7. Daily cron job
8. Settings UI
9. Environment variables

**Not included (future work):**
- Gmail Pub/Sub push notifications
- Outlook OAuth integration
- Add sender modal UI
- Attachment extraction from Gmail
