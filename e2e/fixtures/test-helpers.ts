import type { Page } from "@playwright/test";

/**
 * Known benign page errors that don't indicate real bugs.
 * ResizeObserver, hydration warnings, AbortError from navigation, etc.
 */
export const BENIGN_ERROR_PATTERNS = [
  /ResizeObserver/i,
  /hydrat/i,
  /AbortError/i,
  /cancelled/i,
  /Loading chunk/i,
  /Script error/i,
];

export function isBenignError(err: Error | string): boolean {
  const msg = typeof err === "string" ? err : err.message;
  return BENIGN_ERROR_PATTERNS.some((p) => p.test(msg));
}

/**
 * Navigate to a URL with retry on net::ERR_ABORTED.
 * Staging can intermittently abort page loads; this retries up to `maxRetries` times.
 */
export async function safeGoto(
  page: Page,
  url: string,
  options?: { maxRetries?: number; timeout?: number }
): Promise<void> {
  const maxRetries = options?.maxRetries ?? 2;
  const timeout = options?.timeout ?? 30000;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout });
      return; // Success
    } catch (error) {
      const msg = (error as Error).message || "";
      if (msg.includes("ERR_ABORTED") && attempt < maxRetries) {
        // Wait briefly then retry
        await page.waitForTimeout(2000);
        continue;
      }
      throw error; // Re-throw if not ERR_ABORTED or out of retries
    }
  }
}
