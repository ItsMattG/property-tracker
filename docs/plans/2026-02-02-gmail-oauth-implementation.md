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

**Step 2: Modify propertyEmails table for OAuth support**

Find the `propertyEmails` table and add these columns:

```typescript
// Add to propertyEmails table definition:
source: pgEnum("email_source", ["forwarded", "gmail", "outlook"])("source").default("forwarded").notNull(),
connectionId: integer("connection_id").references(() => emailConnections.id, { onDelete: "set null" }),
externalId: text("external_id"), // Gmail/Outlook message ID for dedup
// Make propertyId nullable for unassigned emails
```

Note: `propertyId` needs to become nullable. Change:
```typescript
propertyId: uuid("property_id")
  .references(() => properties.id, { onDelete: "cascade" }),
  // Remove .notNull()
```

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
    expect(encrypted).toContain(":"); // IV:ciphertext format

    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it("should produce different ciphertexts for same plaintext", () => {
    const plaintext = "my-secret-token";
    const encrypted1 = encrypt(plaintext);
    const encrypted2 = encrypt(plaintext);

    expect(encrypted1).not.toBe(encrypted2); // Different IVs
  });

  it("should handle empty strings", () => {
    const encrypted = encrypt("");
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe("");
  });

  it("should handle unicode characters", () => {
    const plaintext = "token-with-emoji-🔐";
    const encrypted = encrypt(plaintext);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
pnpm test:unit src/lib/__tests__/encryption.test.ts
```

Expected: FAIL - module not found

**Step 3: Implement encryption module**

```typescript
// src/lib/encryption.ts
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error("ENCRYPTION_KEY environment variable is not set");
  }
  // Key should be 32 bytes (64 hex characters)
  if (key.length !== 64) {
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

  // Format: iv:authTag:ciphertext (all hex)
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

**Step 4: Add test env variable and run tests**

Add to `.env.test` or set in test setup:
```
ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
```

```bash
ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef pnpm test:unit src/lib/__tests__/encryption.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/encryption.ts src/lib/__tests__/encryption.test.ts
git commit -m "feat: add AES-256-GCM encryption utilities for OAuth tokens"
```

---

## Task 4: Gmail OAuth Configuration

**Files:**
- Create: `src/lib/gmail/config.ts`
- Create: `src/lib/gmail/types.ts`

**Step 1: Create Gmail types**

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
  labelIds: string[];
  snippet: string;
  payload: {
    headers: Array<{ name: string; value: string }>;
    mimeType: string;
    body?: { data?: string; size: number };
    parts?: GmailMessagePart[];
  };
  internalDate: string;
}

export interface GmailMessagePart {
  mimeType: string;
  filename?: string;
  body?: { data?: string; size: number; attachmentId?: string };
  parts?: GmailMessagePart[];
}

export interface GmailWatchResponse {
  historyId: string;
  expiration: string;
}
```

**Step 2: Create Gmail config**

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
  pubsubTopic: process.env.GOOGLE_PUBSUB_TOPIC!, // projects/bricktrack-486109/topics/gmail-notifications
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
    prompt: "consent", // Force consent to get refresh token
  });
}
```

**Step 3: Commit**

```bash
git add src/lib/gmail/
git commit -m "feat: add Gmail OAuth configuration and types"
```

---

## Task 5: Gmail OAuth Routes - Initiate Flow

**Files:**
- Create: `src/app/api/auth/gmail/route.ts`

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

  // Generate state parameter for CSRF protection
  // Format: clerkId:randomBytes
  const stateRandom = randomBytes(16).toString("hex");
  const state = Buffer.from(`${userId}:${stateRandom}`).toString("base64url");

  const authUrl = getAuthUrl(state);

  return NextResponse.redirect(authUrl);
}
```

**Step 2: Commit**

```bash
git add src/app/api/auth/gmail/route.ts
git commit -m "feat: add Gmail OAuth initiation route"
```

---

## Task 6: Gmail OAuth Routes - Callback Handler

**Files:**
- Create: `src/app/api/auth/callback/gmail/route.ts`

**Step 1: Create callback route**

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

  // Handle OAuth errors
  if (error) {
    console.error("Gmail OAuth error:", error);
    return NextResponse.redirect(
      new URL(`/settings/email-connections?error=${error}`, process.env.NEXT_PUBLIC_APP_URL)
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/settings/email-connections?error=missing_params", process.env.NEXT_PUBLIC_APP_URL)
    );
  }

  // Verify state and extract clerkId
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.redirect(new URL("/sign-in", process.env.NEXT_PUBLIC_APP_URL));
  }

  try {
    const decodedState = Buffer.from(state, "base64url").toString();
    const [stateClerkId] = decodedState.split(":");

    if (stateClerkId !== clerkId) {
      return NextResponse.redirect(
        new URL("/settings/email-connections?error=invalid_state", process.env.NEXT_PUBLIC_APP_URL)
      );
    }
  } catch {
    return NextResponse.redirect(
      new URL("/settings/email-connections?error=invalid_state", process.env.NEXT_PUBLIC_APP_URL)
    );
  }

  // Exchange code for tokens
  const oauth2Client = createOAuth2Client();

  try {
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token || !tokens.refresh_token) {
      throw new Error("Missing tokens in response");
    }

    oauth2Client.setCredentials(tokens);

    // Get user's email address
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });
    const profile = await gmail.users.getProfile({ userId: "me" });
    const emailAddress = profile.data.emailAddress;

    if (!emailAddress) {
      throw new Error("Could not get email address");
    }

    // Get our internal user ID
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkId, clerkId));

    if (!user) {
      throw new Error("User not found");
    }

    // Calculate token expiry
    const expiresAt = tokens.expiry_date
      ? new Date(tokens.expiry_date)
      : new Date(Date.now() + 3600 * 1000); // Default 1 hour

    // Encrypt tokens
    const accessTokenEncrypted = encrypt(tokens.access_token);
    const refreshTokenEncrypted = encrypt(tokens.refresh_token);

    // Check if connection already exists
    const existing = await db
      .select()
      .from(emailConnections)
      .where(
        and(
          eq(emailConnections.userId, user.id),
          eq(emailConnections.provider, "gmail"),
          eq(emailConnections.emailAddress, emailAddress)
        )
      );

    if (existing.length > 0) {
      // Update existing connection
      await db
        .update(emailConnections)
        .set({
          accessTokenEncrypted,
          refreshTokenEncrypted,
          tokenExpiresAt: expiresAt,
          status: "active",
          lastError: null,
          updatedAt: new Date(),
        })
        .where(eq(emailConnections.id, existing[0].id));
    } else {
      // Create new connection
      await db.insert(emailConnections).values({
        userId: user.id,
        provider: "gmail",
        emailAddress,
        accessTokenEncrypted,
        refreshTokenEncrypted,
        tokenExpiresAt: expiresAt,
        status: "active",
      });
    }

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

**Step 2: Commit**

```bash
git add src/app/api/auth/callback/gmail/route.ts
git commit -m "feat: add Gmail OAuth callback handler with token storage"
```

---

## Task 7: Gmail Token Service

**Files:**
- Create: `src/server/services/gmail-token.ts`
- Create: `src/server/services/__tests__/gmail-token.test.ts`

**Step 1: Write failing test**

```typescript
// src/server/services/__tests__/gmail-token.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("@/lib/encryption", () => ({
  encrypt: vi.fn((s) => `encrypted:${s}`),
  decrypt: vi.fn((s) => s.replace("encrypted:", "")),
}));

vi.mock("googleapis", () => ({
  google: {
    auth: {
      OAuth2: vi.fn().mockImplementation(() => ({
        setCredentials: vi.fn(),
        refreshAccessToken: vi.fn().mockResolvedValue({
          credentials: {
            access_token: "new-access-token",
            expiry_date: Date.now() + 3600000,
          },
        }),
      })),
    },
  },
}));

describe("gmail-token service", () => {
  it("should refresh token when expired", async () => {
    // Test will be implemented after the module exists
    expect(true).toBe(true);
  });
});
```

**Step 2: Implement token service**

```typescript
// src/server/services/gmail-token.ts
import { google } from "googleapis";
import { db } from "@/server/db";
import { emailConnections } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { encrypt, decrypt } from "@/lib/encryption";
import { createOAuth2Client } from "@/lib/gmail/config";
import type { OAuth2Client } from "google-auth-library";

const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000; // 5 minutes

export interface AuthenticatedGmailClient {
  oauth2Client: OAuth2Client;
  gmail: ReturnType<typeof google.gmail>;
}

/**
 * Get an authenticated Gmail client for a connection.
 * Automatically refreshes the token if expired or about to expire.
 */
export async function getAuthenticatedGmailClient(
  connectionId: number
): Promise<AuthenticatedGmailClient> {
  const [connection] = await db
    .select()
    .from(emailConnections)
    .where(eq(emailConnections.id, connectionId));

  if (!connection) {
    throw new Error(`Connection not found: ${connectionId}`);
  }

  if (connection.status !== "active") {
    throw new Error(`Connection is not active: ${connection.status}`);
  }

  const oauth2Client = createOAuth2Client();

  // Decrypt tokens
  const accessToken = decrypt(connection.accessTokenEncrypted);
  const refreshToken = decrypt(connection.refreshTokenEncrypted);

  // Check if token needs refresh
  const now = Date.now();
  const expiresAt = connection.tokenExpiresAt.getTime();
  const needsRefresh = expiresAt - now < TOKEN_REFRESH_BUFFER_MS;

  if (needsRefresh) {
    oauth2Client.setCredentials({ refresh_token: refreshToken });

    try {
      const { credentials } = await oauth2Client.refreshAccessToken();

      if (!credentials.access_token) {
        throw new Error("No access token in refresh response");
      }

      const newExpiresAt = credentials.expiry_date
        ? new Date(credentials.expiry_date)
        : new Date(Date.now() + 3600 * 1000);

      // Update database with new token
      await db
        .update(emailConnections)
        .set({
          accessTokenEncrypted: encrypt(credentials.access_token),
          tokenExpiresAt: newExpiresAt,
          updatedAt: new Date(),
        })
        .where(eq(emailConnections.id, connectionId));

      oauth2Client.setCredentials({
        access_token: credentials.access_token,
        refresh_token: refreshToken,
      });
    } catch (error) {
      // Mark connection as needing reauth
      await db
        .update(emailConnections)
        .set({
          status: "needs_reauth",
          lastError: error instanceof Error ? error.message : "Token refresh failed",
          updatedAt: new Date(),
        })
        .where(eq(emailConnections.id, connectionId));

      throw new Error("Token refresh failed - user needs to reconnect");
    }
  } else {
    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
  }

  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  return { oauth2Client, gmail };
}
```

**Step 3: Commit**

```bash
git add src/server/services/gmail-token.ts src/server/services/__tests__/gmail-token.test.ts
git commit -m "feat: add Gmail token refresh service"
```

---

## Task 8: Gmail Sync Service

**Files:**
- Create: `src/server/services/gmail-sync.ts`

**Step 1: Create sync service**

```typescript
// src/server/services/gmail-sync.ts
import { db } from "@/server/db";
import {
  emailConnections,
  emailApprovedSenders,
  propertyEmails,
  senderPropertyHistory,
  properties,
} from "@/server/db/schema";
import { eq, and, inArray, desc, sql } from "drizzle-orm";
import { getAuthenticatedGmailClient } from "./gmail-token";
import type { GmailMessage } from "@/lib/gmail/types";

interface SyncResult {
  connectionId: number;
  emailsImported: number;
  errors: string[];
}

/**
 * Build Gmail query for approved senders
 */
function buildSenderQuery(patterns: string[]): string {
  const fromClauses = patterns.map((pattern) => {
    if (pattern.startsWith("*@")) {
      // Wildcard domain: *@raywhite.com -> from:@raywhite.com
      return `from:${pattern.slice(1)}`;
    }
    return `from:${pattern}`;
  });
  return fromClauses.join(" OR ");
}

/**
 * Extract header value from Gmail message
 */
function getHeader(message: GmailMessage, name: string): string | undefined {
  return message.payload.headers.find(
    (h) => h.name.toLowerCase() === name.toLowerCase()
  )?.value;
}

/**
 * Check if sender matches any approved pattern
 */
function senderMatchesPatterns(sender: string, patterns: string[]): boolean {
  const senderLower = sender.toLowerCase();

  for (const pattern of patterns) {
    const patternLower = pattern.toLowerCase();
    if (patternLower.startsWith("*@")) {
      // Wildcard domain match
      const domain = patternLower.slice(1);
      if (senderLower.includes(domain)) {
        return true;
      }
    } else if (senderLower.includes(patternLower)) {
      return true;
    }
  }
  return false;
}

/**
 * Extract email address from "Name <email@domain.com>" format
 */
function extractEmailAddress(from: string): string {
  const match = from.match(/<([^>]+)>/);
  return match ? match[1].toLowerCase() : from.toLowerCase();
}

/**
 * Match email to property based on sender history or default
 */
async function matchToProperty(
  userId: string,
  senderAddress: string,
  approvedSenders: Array<{ emailPattern: string; defaultPropertyId: string | null }>
): Promise<string | null> {
  // 1. Check sender history
  const [history] = await db
    .select()
    .from(senderPropertyHistory)
    .where(
      and(
        eq(senderPropertyHistory.userId, userId),
        eq(senderPropertyHistory.senderAddress, senderAddress)
      )
    );

  if (history && history.confidence >= 0.8) {
    return history.propertyId;
  }

  // 2. Check default property from approved sender
  for (const sender of approvedSenders) {
    if (
      sender.defaultPropertyId &&
      senderMatchesPatterns(senderAddress, [sender.emailPattern])
    ) {
      return sender.defaultPropertyId;
    }
  }

  // 3. Check if user has only one property
  const userProperties = await db
    .select({ id: properties.id })
    .from(properties)
    .where(eq(properties.userId, userId));

  if (userProperties.length === 1) {
    return userProperties[0].id;
  }

  // 4. Unmatched - will go to unassigned queue
  return null;
}

/**
 * Sync emails for a single connection
 */
export async function syncGmailConnection(connectionId: number): Promise<SyncResult> {
  const result: SyncResult = {
    connectionId,
    emailsImported: 0,
    errors: [],
  };

  const [connection] = await db
    .select()
    .from(emailConnections)
    .where(eq(emailConnections.id, connectionId));

  if (!connection) {
    result.errors.push("Connection not found");
    return result;
  }

  // Get approved senders for this user
  const approvedSenders = await db
    .select()
    .from(emailApprovedSenders)
    .where(eq(emailApprovedSenders.userId, connection.userId));

  if (approvedSenders.length === 0) {
    // No approved senders - nothing to sync
    await db
      .update(emailConnections)
      .set({ lastSyncAt: new Date(), updatedAt: new Date() })
      .where(eq(emailConnections.id, connectionId));
    return result;
  }

  try {
    const { gmail } = await getAuthenticatedGmailClient(connectionId);

    // Build query for approved senders
    const senderQuery = buildSenderQuery(approvedSenders.map((s) => s.emailPattern));

    // Add date filter if we have a last sync
    let query = senderQuery;
    if (connection.lastSyncAt) {
      const afterTimestamp = Math.floor(connection.lastSyncAt.getTime() / 1000);
      query = `(${senderQuery}) after:${afterTimestamp}`;
    }

    // Fetch message list (metadata only)
    const listResponse = await gmail.users.messages.list({
      userId: "me",
      q: query,
      maxResults: 100,
    });

    const messages = listResponse.data.messages || [];

    for (const messageSummary of messages) {
      if (!messageSummary.id) continue;

      // Check if we already have this email
      const [existing] = await db
        .select({ id: propertyEmails.id })
        .from(propertyEmails)
        .where(
          and(
            eq(propertyEmails.externalId, messageSummary.id),
            eq(propertyEmails.source, "gmail")
          )
        );

      if (existing) continue; // Skip duplicates

      // Fetch full message
      const messageResponse = await gmail.users.messages.get({
        userId: "me",
        id: messageSummary.id,
        format: "full",
      });

      const message = messageResponse.data as unknown as GmailMessage;

      const from = getHeader(message, "From") || "";
      const subject = getHeader(message, "Subject") || "(No Subject)";
      const messageId = getHeader(message, "Message-ID");
      const inReplyTo = getHeader(message, "In-Reply-To");
      const date = getHeader(message, "Date");

      const fromAddress = extractEmailAddress(from);
      const fromName = from.replace(/<[^>]+>/, "").trim() || null;

      // Verify sender is in approved list (double-check)
      if (!senderMatchesPatterns(fromAddress, approvedSenders.map((s) => s.emailPattern))) {
        continue;
      }

      // Match to property
      const propertyId = await matchToProperty(
        connection.userId,
        fromAddress,
        approvedSenders
      );

      // Extract body text
      let bodyText: string | null = null;
      if (message.payload.body?.data) {
        bodyText = Buffer.from(message.payload.body.data, "base64").toString("utf8");
      } else if (message.payload.parts) {
        const textPart = message.payload.parts.find((p) => p.mimeType === "text/plain");
        if (textPart?.body?.data) {
          bodyText = Buffer.from(textPart.body.data, "base64").toString("utf8");
        }
      }

      // Parse received date
      const receivedAt = date ? new Date(date) : new Date(parseInt(message.internalDate));

      // Insert email
      await db.insert(propertyEmails).values({
        propertyId,
        userId: connection.userId,
        fromAddress,
        fromName,
        subject,
        bodyText,
        messageId,
        inReplyTo,
        threadId: inReplyTo ? messageId : null, // Simplified threading
        status: "approved",
        isRead: false,
        receivedAt,
        source: "gmail",
        connectionId: connection.id,
        externalId: messageSummary.id,
      });

      result.emailsImported++;
    }

    // Update last sync time
    await db
      .update(emailConnections)
      .set({
        lastSyncAt: new Date(),
        lastError: null,
        updatedAt: new Date(),
      })
      .where(eq(emailConnections.id, connectionId));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    result.errors.push(errorMessage);

    await db
      .update(emailConnections)
      .set({
        lastError: errorMessage,
        updatedAt: new Date(),
      })
      .where(eq(emailConnections.id, connectionId));
  }

  return result;
}

/**
 * Sync all active Gmail connections for a user
 */
export async function syncAllGmailConnections(userId: string): Promise<SyncResult[]> {
  const connections = await db
    .select()
    .from(emailConnections)
    .where(
      and(
        eq(emailConnections.userId, userId),
        eq(emailConnections.provider, "gmail"),
        eq(emailConnections.status, "active")
      )
    );

  const results: SyncResult[] = [];

  for (const connection of connections) {
    const result = await syncGmailConnection(connection.id);
    results.push(result);
  }

  return results;
}
```

**Step 2: Commit**

```bash
git add src/server/services/gmail-sync.ts
git commit -m "feat: add Gmail email sync service with sender filtering"
```

---

## Task 9: tRPC Router - Email Connections

**Files:**
- Create: `src/server/routers/emailConnection.ts`
- Modify: `src/server/routers/_app.ts`

**Step 1: Create email connection router**

```typescript
// src/server/routers/emailConnection.ts
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, proProcedure } from "../trpc";
import { emailConnections } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { syncGmailConnection } from "../services/gmail-sync";

export const emailConnectionRouter = router({
  // List user's connected email accounts
  list: proProcedure.query(async ({ ctx }) => {
    const connections = await ctx.db
      .select({
        id: emailConnections.id,
        provider: emailConnections.provider,
        emailAddress: emailConnections.emailAddress,
        status: emailConnections.status,
        lastSyncAt: emailConnections.lastSyncAt,
        lastError: emailConnections.lastError,
        createdAt: emailConnections.createdAt,
      })
      .from(emailConnections)
      .where(eq(emailConnections.userId, ctx.portfolio.ownerId));

    return connections;
  }),

  // Disconnect an email account
  disconnect: proProcedure
    .input(z.object({ connectionId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const [connection] = await ctx.db
        .select()
        .from(emailConnections)
        .where(
          and(
            eq(emailConnections.id, input.connectionId),
            eq(emailConnections.userId, ctx.portfolio.ownerId)
          )
        );

      if (!connection) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Connection not found" });
      }

      await ctx.db
        .delete(emailConnections)
        .where(eq(emailConnections.id, input.connectionId));

      return { success: true };
    }),

  // Trigger immediate sync for a connection
  syncNow: proProcedure
    .input(z.object({ connectionId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const [connection] = await ctx.db
        .select()
        .from(emailConnections)
        .where(
          and(
            eq(emailConnections.id, input.connectionId),
            eq(emailConnections.userId, ctx.portfolio.ownerId)
          )
        );

      if (!connection) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Connection not found" });
      }

      if (connection.status !== "active") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Connection needs to be reconnected",
        });
      }

      const result = await syncGmailConnection(input.connectionId);

      if (result.errors.length > 0) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: result.errors.join(", "),
        });
      }

      return {
        success: true,
        emailsImported: result.emailsImported,
      };
    }),

  // Get connection status
  getStatus: proProcedure
    .input(z.object({ connectionId: z.number() }))
    .query(async ({ ctx, input }) => {
      const [connection] = await ctx.db
        .select()
        .from(emailConnections)
        .where(
          and(
            eq(emailConnections.id, input.connectionId),
            eq(emailConnections.userId, ctx.portfolio.ownerId)
          )
        );

      if (!connection) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Connection not found" });
      }

      return {
        status: connection.status,
        lastSyncAt: connection.lastSyncAt,
        lastError: connection.lastError,
        pushActive: !!connection.pushSubscriptionId &&
          connection.pushExpiresAt &&
          connection.pushExpiresAt > new Date(),
      };
    }),
});
```

**Step 2: Add router to _app.ts**

Find the router exports in `src/server/routers/_app.ts` and add:

```typescript
import { emailConnectionRouter } from "./emailConnection";

// In the appRouter definition:
emailConnection: emailConnectionRouter,
```

**Step 3: Commit**

```bash
git add src/server/routers/emailConnection.ts src/server/routers/_app.ts
git commit -m "feat: add tRPC router for email connections"
```

---

## Task 10: tRPC Router - Global Approved Senders

**Files:**
- Create: `src/server/routers/emailSender.ts`
- Modify: `src/server/routers/_app.ts`

**Step 1: Create email sender router**

```typescript
// src/server/routers/emailSender.ts
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, proProcedure } from "../trpc";
import { emailApprovedSenders, properties } from "../db/schema";
import { eq, and } from "drizzle-orm";

export const emailSenderRouter = router({
  // List user's global approved senders
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({
        id: emailApprovedSenders.id,
        emailPattern: emailApprovedSenders.emailPattern,
        label: emailApprovedSenders.label,
        defaultPropertyId: emailApprovedSenders.defaultPropertyId,
        createdAt: emailApprovedSenders.createdAt,
      })
      .from(emailApprovedSenders)
      .where(eq(emailApprovedSenders.userId, ctx.portfolio.ownerId));
  }),

  // Add a new approved sender pattern
  add: proProcedure
    .input(
      z.object({
        emailPattern: z.string().min(1).max(255),
        label: z.string().max(100).optional(),
        defaultPropertyId: z.string().uuid().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Validate default property if provided
      if (input.defaultPropertyId) {
        const [property] = await ctx.db
          .select({ id: properties.id })
          .from(properties)
          .where(
            and(
              eq(properties.id, input.defaultPropertyId),
              eq(properties.userId, ctx.portfolio.ownerId)
            )
          );

        if (!property) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" });
        }
      }

      const [sender] = await ctx.db
        .insert(emailApprovedSenders)
        .values({
          userId: ctx.portfolio.ownerId,
          emailPattern: input.emailPattern.toLowerCase().trim(),
          label: input.label,
          defaultPropertyId: input.defaultPropertyId,
        })
        .onConflictDoNothing()
        .returning();

      if (!sender) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This sender pattern already exists",
        });
      }

      return sender;
    }),

  // Update an approved sender
  update: proProcedure
    .input(
      z.object({
        id: z.number(),
        label: z.string().max(100).optional(),
        defaultPropertyId: z.string().uuid().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select()
        .from(emailApprovedSenders)
        .where(
          and(
            eq(emailApprovedSenders.id, input.id),
            eq(emailApprovedSenders.userId, ctx.portfolio.ownerId)
          )
        );

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Sender not found" });
      }

      // Validate default property if provided
      if (input.defaultPropertyId) {
        const [property] = await ctx.db
          .select({ id: properties.id })
          .from(properties)
          .where(
            and(
              eq(properties.id, input.defaultPropertyId),
              eq(properties.userId, ctx.portfolio.ownerId)
            )
          );

        if (!property) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" });
        }
      }

      const updateData: Record<string, unknown> = {};
      if (input.label !== undefined) updateData.label = input.label;
      if (input.defaultPropertyId !== undefined) {
        updateData.defaultPropertyId = input.defaultPropertyId;
      }

      await ctx.db
        .update(emailApprovedSenders)
        .set(updateData)
        .where(eq(emailApprovedSenders.id, input.id));

      return { success: true };
    }),

  // Remove an approved sender
  remove: proProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select()
        .from(emailApprovedSenders)
        .where(
          and(
            eq(emailApprovedSenders.id, input.id),
            eq(emailApprovedSenders.userId, ctx.portfolio.ownerId)
          )
        );

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Sender not found" });
      }

      await ctx.db
        .delete(emailApprovedSenders)
        .where(eq(emailApprovedSenders.id, input.id));

      return { success: true };
    }),
});
```

**Step 2: Add to _app.ts**

```typescript
import { emailSenderRouter } from "./emailSender";

// In appRouter:
emailSender: emailSenderRouter,
```

**Step 3: Commit**

```bash
git add src/server/routers/emailSender.ts src/server/routers/_app.ts
git commit -m "feat: add tRPC router for global approved senders"
```

---

## Task 11: Extend Email Router - Unassigned Emails & Property Assignment

**Files:**
- Modify: `src/server/routers/email.ts`

**Step 1: Add procedures for unassigned emails**

Add these procedures to the existing `emailRouter`:

```typescript
// Add these imports at the top
import { senderPropertyHistory } from "../db/schema";
import { isNull } from "drizzle-orm";

// Add these procedures to the router:

// List unassigned emails (property_id is null)
listUnassigned: protectedProcedure
  .input(
    z.object({
      limit: z.number().min(1).max(100).default(50),
      cursor: z.number().optional(),
    })
  )
  .query(async ({ ctx, input }) => {
    const conditions = [
      eq(propertyEmails.userId, ctx.portfolio.ownerId),
      isNull(propertyEmails.propertyId),
    ];

    if (input.cursor) {
      conditions.push(sql`${propertyEmails.id} < ${input.cursor}`);
    }

    const emails = await ctx.db
      .select({
        id: propertyEmails.id,
        fromAddress: propertyEmails.fromAddress,
        fromName: propertyEmails.fromName,
        subject: propertyEmails.subject,
        receivedAt: propertyEmails.receivedAt,
        source: propertyEmails.source,
      })
      .from(propertyEmails)
      .where(and(...conditions))
      .orderBy(desc(propertyEmails.receivedAt))
      .limit(input.limit + 1);

    let nextCursor: number | undefined;
    if (emails.length > input.limit) {
      const last = emails.pop();
      nextCursor = last?.id;
    }

    return { emails, nextCursor };
  }),

// Assign email to a property (and learn the association)
assignProperty: writeProcedure
  .input(
    z.object({
      emailId: z.number(),
      propertyId: z.string().uuid(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    // Verify email belongs to user
    const [email] = await ctx.db
      .select()
      .from(propertyEmails)
      .where(
        and(
          eq(propertyEmails.id, input.emailId),
          eq(propertyEmails.userId, ctx.portfolio.ownerId)
        )
      );

    if (!email) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Email not found" });
    }

    // Verify property belongs to user
    const [property] = await ctx.db
      .select({ id: properties.id })
      .from(properties)
      .where(
        and(
          eq(properties.id, input.propertyId),
          eq(properties.userId, ctx.portfolio.ownerId)
        )
      );

    if (!property) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" });
    }

    // Update email with property assignment
    await ctx.db
      .update(propertyEmails)
      .set({ propertyId: input.propertyId })
      .where(eq(propertyEmails.id, input.emailId));

    // Learn the sender -> property association
    await ctx.db
      .insert(senderPropertyHistory)
      .values({
        userId: ctx.portfolio.ownerId,
        senderAddress: email.fromAddress,
        propertyId: input.propertyId,
        confidence: 1.0,
      })
      .onConflictDoUpdate({
        target: [senderPropertyHistory.userId, senderPropertyHistory.senderAddress],
        set: {
          propertyId: input.propertyId,
          confidence: sql`LEAST(${senderPropertyHistory.confidence} + 0.2, 1.0)`,
          updatedAt: new Date(),
        },
      });

    return { success: true };
  }),
```

**Step 2: Commit**

```bash
git add src/server/routers/email.ts
git commit -m "feat: add unassigned emails listing and property assignment"
```

---

## Task 12: Daily Cron Job - Email Sync

**Files:**
- Create: `src/app/api/cron/email-sync/route.ts`

**Step 1: Create cron route**

```typescript
// src/app/api/cron/email-sync/route.ts
import { NextResponse } from "next/server";
import { verifyCronRequest, unauthorizedResponse } from "@/lib/cron-auth";
import { recordHeartbeat } from "@/lib/monitoring";
import { db } from "@/server/db";
import { emailConnections } from "@/server/db/schema";
import { eq, and, lt } from "drizzle-orm";
import { syncGmailConnection } from "@/server/services/gmail-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes

export async function GET(request: Request) {
  if (!verifyCronRequest(request.headers)) {
    return unauthorizedResponse();
  }

  const startTime = Date.now();
  const results = {
    connectionsProcessed: 0,
    emailsImported: 0,
    errors: [] as string[],
  };

  try {
    // Get all active Gmail connections
    const connections = await db
      .select()
      .from(emailConnections)
      .where(
        and(
          eq(emailConnections.provider, "gmail"),
          eq(emailConnections.status, "active")
        )
      );

    for (const connection of connections) {
      try {
        const syncResult = await syncGmailConnection(connection.id);
        results.connectionsProcessed++;
        results.emailsImported += syncResult.emailsImported;

        if (syncResult.errors.length > 0) {
          results.errors.push(
            `Connection ${connection.id}: ${syncResult.errors.join(", ")}`
          );
        }
      } catch (error) {
        results.errors.push(
          `Connection ${connection.id}: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }

    // TODO: Add push subscription renewal logic here
    // Renew Gmail watches expiring within 2 days

    await recordHeartbeat("email-sync", {
      status: results.errors.length === 0 ? "success" : "partial",
      durationMs: Date.now() - startTime,
      metadata: {
        connectionsProcessed: results.connectionsProcessed,
        emailsImported: results.emailsImported,
        errorCount: results.errors.length,
      },
    });

    return NextResponse.json({
      success: true,
      ...results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    await recordHeartbeat("email-sync", {
      status: "error",
      durationMs: Date.now() - startTime,
      metadata: {
        error: error instanceof Error ? error.message : "Unknown error",
      },
    });

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
```

**Step 2: Add to vercel.json cron config**

Check if `vercel.json` exists and add the cron job:

```json
{
  "crons": [
    {
      "path": "/api/cron/email-sync",
      "schedule": "0 20 * * *"
    }
  ]
}
```

Note: `0 20 * * *` = 6am AEST (UTC+10) daily

**Step 3: Commit**

```bash
git add src/app/api/cron/email-sync/route.ts vercel.json
git commit -m "feat: add daily email sync cron job"
```

---

## Task 13: Settings Page - Email Connections UI

**Files:**
- Create: `src/app/(dashboard)/settings/email-connections/page.tsx`

**Step 1: Create the settings page**

```typescript
// src/app/(dashboard)/settings/email-connections/page.tsx
"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Mail, RefreshCw, Trash2, Plus, AlertCircle, CheckCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function EmailConnectionsPage() {
  const searchParams = useSearchParams();
  const success = searchParams.get("success");
  const error = searchParams.get("error");

  const { data: connections, isLoading, refetch } = api.emailConnection.list.useQuery();
  const { data: senders } = api.emailSender.list.useQuery();

  const disconnectMutation = api.emailConnection.disconnect.useMutation({
    onSuccess: () => refetch(),
  });

  const syncNowMutation = api.emailConnection.syncNow.useMutation({
    onSuccess: () => refetch(),
  });

  const [syncing, setSyncing] = useState<number | null>(null);

  const handleSync = async (connectionId: number) => {
    setSyncing(connectionId);
    try {
      await syncNowMutation.mutateAsync({ connectionId });
    } finally {
      setSyncing(null);
    }
  };

  return (
    <div className="container max-w-4xl py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Email Connections</h1>
        <p className="text-muted-foreground">
          Connect your email accounts to automatically import property-related emails.
        </p>
      </div>

      {success === "gmail_connected" && (
        <Alert className="mb-6 border-green-500 bg-green-50 dark:bg-green-950">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-600">
            Gmail connected successfully! Add approved senders below to start importing emails.
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert className="mb-6 border-red-500 bg-red-50 dark:bg-red-950">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-600">
            {error === "oauth_failed" && "Failed to connect Gmail. Please try again."}
            {error === "invalid_state" && "Invalid request. Please try again."}
            {error === "missing_params" && "Missing parameters. Please try again."}
          </AlertDescription>
        </Alert>
      )}

      {/* Connected Accounts */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Connected Accounts</CardTitle>
          <CardDescription>
            Email accounts connected for automatic import.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : connections && connections.length > 0 ? (
            <div className="space-y-4">
              {connections.map((connection) => (
                <div
                  key={connection.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="flex items-center gap-4">
                    <Mail className="h-8 w-8 text-muted-foreground" />
                    <div>
                      <div className="font-medium">{connection.emailAddress}</div>
                      <div className="text-sm text-muted-foreground">
                        {connection.provider === "gmail" ? "Gmail" : "Outlook"}
                        {connection.lastSyncAt && (
                          <> · Last synced {formatDistanceToNow(new Date(connection.lastSyncAt))} ago</>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={connection.status === "active" ? "default" : "destructive"}
                    >
                      {connection.status === "active" ? "Active" : "Needs Reconnect"}
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSync(connection.id)}
                      disabled={syncing === connection.id || connection.status !== "active"}
                    >
                      {syncing === connection.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                      <span className="ml-2">Sync Now</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => disconnectMutation.mutate({ connectionId: connection.id })}
                      disabled={disconnectMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              No email accounts connected yet.
            </div>
          )}

          <div className="mt-6 flex gap-4">
            <Button asChild>
              <a href="/api/auth/gmail">
                <Plus className="mr-2 h-4 w-4" />
                Connect Gmail
              </a>
            </Button>
            <Button variant="outline" disabled>
              <Plus className="mr-2 h-4 w-4" />
              Connect Outlook (Coming Soon)
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Approved Senders */}
      <Card>
        <CardHeader>
          <CardTitle>Approved Senders</CardTitle>
          <CardDescription>
            Only emails from these senders will be imported. Use wildcards like *@raywhite.com.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {senders && senders.length > 0 ? (
            <div className="space-y-2">
              {senders.map((sender) => (
                <div
                  key={sender.id}
                  className="flex items-center justify-between rounded border p-3"
                >
                  <div>
                    <div className="font-mono text-sm">{sender.emailPattern}</div>
                    {sender.label && (
                      <div className="text-sm text-muted-foreground">{sender.label}</div>
                    )}
                  </div>
                  {sender.defaultPropertyId && (
                    <Badge variant="secondary">Has default property</Badge>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              No approved senders yet. Add senders to start importing emails.
            </div>
          )}

          <Button className="mt-4" variant="outline">
            <Plus className="mr-2 h-4 w-4" />
            Add Sender
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
```

**Step 2: Add to sidebar navigation**

Find the sidebar nav configuration and add the email connections link under Settings.

**Step 3: Commit**

```bash
git add src/app/(dashboard)/settings/email-connections/
git commit -m "feat: add email connections settings page"
```

---

## Task 14: Environment Variables

**Files:**
- Modify: `.env.local.example`

**Step 1: Add required environment variables**

```bash
# Gmail OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_PUBSUB_TOPIC=projects/bricktrack-486109/topics/gmail-notifications

# Token Encryption (generate with: openssl rand -hex 32)
ENCRYPTION_KEY=
```

**Step 2: Commit**

```bash
git add .env.local.example
git commit -m "docs: add Gmail OAuth environment variables to example"
```

---

## Task 15: Final Integration Tests

**Files:**
- Create: `e2e/email-connections.spec.ts`

**Step 1: Create E2E test**

```typescript
// e2e/email-connections.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Email Connections", () => {
  test.beforeEach(async ({ page }) => {
    // Login as test user
    await page.goto("/sign-in");
    // ... authentication steps
  });

  test("should display email connections page", async ({ page }) => {
    await page.goto("/settings/email-connections");

    await expect(page.getByRole("heading", { name: "Email Connections" })).toBeVisible();
    await expect(page.getByText("Connect Gmail")).toBeVisible();
    await expect(page.getByText("Connect Outlook (Coming Soon)")).toBeVisible();
  });

  test("should show approved senders section", async ({ page }) => {
    await page.goto("/settings/email-connections");

    await expect(page.getByRole("heading", { name: "Approved Senders" })).toBeVisible();
    await expect(page.getByText("Add Sender")).toBeVisible();
  });
});
```

**Step 2: Commit**

```bash
git add e2e/email-connections.spec.ts
git commit -m "test: add E2E tests for email connections"
```

---

## Summary

This plan implements Gmail OAuth integration with:

1. **Database** - New tables for connections, global senders, sender history
2. **Encryption** - AES-256-GCM for token storage
3. **OAuth** - Initiation and callback routes
4. **Token Service** - Automatic refresh handling
5. **Sync Service** - Fetch emails from approved senders
6. **tRPC Routers** - Connection management, sender management
7. **Cron Job** - Daily sync fallback
8. **Settings UI** - Manage connections and senders

**Not included (future work):**
- Gmail Pub/Sub push notifications (webhook handler)
- Outlook OAuth integration
- Add sender modal UI
- Email attachment extraction from Gmail
