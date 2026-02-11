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
 * Navigate to a URL with retry on transient staging errors.
 * Retries on net::ERR_ABORTED and page.goto timeouts.
 */
export async function safeGoto(
  page: Page,
  url: string,
  options?: { maxRetries?: number; timeout?: number }
): Promise<void> {
  const maxRetries = options?.maxRetries ?? 2;
  // 15s per attempt allows 3 attempts within the 60s CI test timeout
  const timeout = options?.timeout ?? 15000;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout });
      return; // Success
    } catch (error) {
      const msg = (error as Error).message || "";
      const isRetryable =
        msg.includes("ERR_ABORTED") ||
        msg.includes("Timeout") ||
        msg.includes("timeout");
      if (isRetryable && attempt < maxRetries) {
        // Wait briefly then retry
        await page.waitForTimeout(2000);
        continue;
      }
      throw error; // Re-throw if not retryable or out of retries
    }
  }
}

/**
 * Dismiss the driver.js onboarding tour overlay if visible.
 * Returns true if a tour was dismissed.
 */
export async function dismissTourIfVisible(page: Page): Promise<boolean> {
  const tourOverlay = page.locator(".driver-overlay");
  if (await tourOverlay.isVisible({ timeout: 3000 }).catch(() => false)) {
    await page.keyboard.press("Escape");
    await tourOverlay.waitFor({ state: "hidden", timeout: 5000 }).catch(() => {});
    // Give React time to settle after tour dismissal
    await page.waitForTimeout(1000);
    return true;
  }
  return false;
}
