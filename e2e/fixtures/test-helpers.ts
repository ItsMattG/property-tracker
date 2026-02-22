import type { Page } from "@playwright/test";

/**
 * Known benign page errors that don't indicate real bugs.
 * ResizeObserver, hydration warnings, AbortError from navigation, etc.
 */
export const BENIGN_ERROR_PATTERNS = [
  /ResizeObserver/i,
  /hydrat/i,
  /react\.dev\/errors\/418/, // minified hydration mismatch in production builds
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
 * The tour starts with a 500ms delay, so we wait briefly before checking.
 * After dismissing via Escape, we force-remove overlay DOM elements to
 * prevent stale SVG overlays from intercepting pointer events.
 * Returns true if a tour was dismissed.
 */
export async function dismissTourIfVisible(page: Page): Promise<boolean> {
  // Wait for tour to potentially start (it has a 500ms init delay)
  await page.waitForTimeout(1000);

  const tourOverlay = page.locator(".driver-overlay");
  const wasVisible = await tourOverlay.isVisible({ timeout: 2000 }).catch(() => false);

  if (wasVisible) {
    await page.keyboard.press("Escape");
    await tourOverlay.waitFor({ state: "hidden", timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(500);
  }

  // Force-remove any remaining driver.js overlay elements from the DOM
  // to prevent stale overlays from intercepting pointer events
  await page.evaluate(() => {
    document.querySelectorAll(".driver-overlay, .driver-popover").forEach((el) => el.remove());
  });

  return wasVisible;
}

/**
 * Dismiss any open Radix Dialog modals (e.g. milestone celebrations).
 * Radix dialogs add aria-hidden to siblings, which blocks getByRole queries.
 * Returns true if a dialog was dismissed.
 */
export async function dismissDialogsIfVisible(page: Page): Promise<boolean> {
  let dismissed = false;
  // Loop to dismiss multiple queued dialogs (e.g. milestone celebrations)
  for (let i = 0; i < 10; i++) {
    const dialog = page.getByRole("dialog");
    if (!(await dialog.isVisible({ timeout: 1000 }).catch(() => false))) break;
    // Click the close button or "Continue" button inside the dialog
    const closeBtn = dialog.getByRole("button", { name: /close/i });
    const continueBtn = dialog.getByRole("button", { name: /continue/i });
    if (await continueBtn.isVisible().catch(() => false)) {
      await continueBtn.click();
    } else if (await closeBtn.isVisible().catch(() => false)) {
      await closeBtn.click();
    } else {
      await page.keyboard.press("Escape");
    }
    dismissed = true;
    // Brief wait for dialog close animation and next dialog to appear
    await page.waitForTimeout(500);
  }
  return dismissed;
}

/**
 * Dismiss any open Radix Dialog modals (e.g. milestone celebrations).
 * Radix dialogs add aria-hidden to siblings, which blocks getByRole queries.
 * Returns true if a dialog was dismissed.
 */
export async function dismissDialogsIfVisible(page: Page): Promise<boolean> {
  let dismissed = false;
  // Loop to dismiss multiple queued dialogs (e.g. milestone celebrations)
  for (let i = 0; i < 10; i++) {
    const dialog = page.getByRole("dialog");
    if (!(await dialog.isVisible({ timeout: 1000 }).catch(() => false))) break;
    // Click the close button or "Continue" button inside the dialog
    const closeBtn = dialog.getByRole("button", { name: /close/i });
    const continueBtn = dialog.getByRole("button", { name: /continue/i });
    if (await continueBtn.isVisible().catch(() => false)) {
      await continueBtn.click();
    } else if (await closeBtn.isVisible().catch(() => false)) {
      await closeBtn.click();
    } else {
      await page.keyboard.press("Escape");
    }
    dismissed = true;
    // Brief wait for dialog close animation and next dialog to appear
    await page.waitForTimeout(500);
  }
  return dismissed;
}
