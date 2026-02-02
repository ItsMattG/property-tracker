import { db } from "@/server/db";
import { emailConnections, type EmailConnection } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { createOAuth2Client } from "@/lib/gmail/config";
import { encrypt, decrypt } from "@/lib/encryption";

/**
 * Refreshes the access token for an email connection if expired or near expiry.
 * Returns the current (or refreshed) access token.
 */
export async function getValidAccessToken(
  connection: EmailConnection
): Promise<string> {
  const now = new Date();
  const expiryBuffer = 5 * 60 * 1000; // 5 minutes buffer

  // Check if token is still valid
  if (connection.tokenExpiresAt.getTime() > now.getTime() + expiryBuffer) {
    return decrypt(connection.accessTokenEncrypted);
  }

  // Token expired or expiring soon - refresh it
  return refreshAccessToken(connection);
}

/**
 * Refreshes the access token using the refresh token.
 */
export async function refreshAccessToken(
  connection: EmailConnection
): Promise<string> {
  const oauth2Client = createOAuth2Client();
  const refreshToken = decrypt(connection.refreshTokenEncrypted);

  oauth2Client.setCredentials({ refresh_token: refreshToken });

  try {
    const { credentials } = await oauth2Client.refreshAccessToken();

    if (!credentials.access_token) {
      throw new Error("No access token in refresh response");
    }

    const expiresAt = credentials.expiry_date
      ? new Date(credentials.expiry_date)
      : new Date(Date.now() + 3600000);

    // Update the stored tokens
    await db
      .update(emailConnections)
      .set({
        accessTokenEncrypted: encrypt(credentials.access_token),
        tokenExpiresAt: expiresAt,
        lastError: null,
        updatedAt: new Date(),
        // Update refresh token if a new one was provided
        ...(credentials.refresh_token && {
          refreshTokenEncrypted: encrypt(credentials.refresh_token),
        }),
      })
      .where(eq(emailConnections.id, connection.id));

    return credentials.access_token;
  } catch (error) {
    // Mark connection as needing reauth
    await db
      .update(emailConnections)
      .set({
        status: "needs_reauth",
        lastError:
          error instanceof Error ? error.message : "Token refresh failed",
        updatedAt: new Date(),
      })
      .where(eq(emailConnections.id, connection.id));

    throw error;
  }
}

/**
 * Marks a connection as needing reauthorization.
 */
export async function markNeedsReauth(
  connectionId: number,
  error: string
): Promise<void> {
  await db
    .update(emailConnections)
    .set({
      status: "needs_reauth",
      lastError: error,
      updatedAt: new Date(),
    })
    .where(eq(emailConnections.id, connectionId));
}

/**
 * Updates the last sync timestamp for a connection.
 */
export async function updateLastSync(connectionId: number): Promise<void> {
  await db
    .update(emailConnections)
    .set({
      lastSyncAt: new Date(),
      lastError: null,
      updatedAt: new Date(),
    })
    .where(eq(emailConnections.id, connectionId));
}
