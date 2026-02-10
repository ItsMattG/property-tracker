import { test as setup, expect } from "@playwright/test";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import path from "path";

const authFile = path.join(__dirname, ".auth", "user.json");

setup("authenticate", async ({ page }) => {
  setup.setTimeout(120_000);

  // If auth file already exists (pre-authenticated by CI), skip login.
  if (existsSync(authFile)) {
    console.log("Auth file already exists — skipping login");
    return;
  }

  const email = process.env.E2E_USER_EMAIL;
  const password = process.env.E2E_USER_PASSWORD;

  if (!email || !password) {
    console.warn("E2E credentials not set — auth setup skipped");
    mkdirSync(path.dirname(authFile), { recursive: true });
    writeFileSync(authFile, JSON.stringify({ cookies: [], origins: [] }));
    return;
  }

  console.log(`[auth] Navigating to /sign-in...`);
  await page.goto("/sign-in", { waitUntil: "networkidle" });
  console.log(`[auth] Current URL: ${page.url()}`);

  // Wait for form to be ready
  await expect(page.getByLabel(/email/i)).toBeVisible({ timeout: 10_000 });
  console.log(`[auth] Email field visible, filling form...`);

  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);

  console.log(`[auth] Clicking sign in...`);
  await page.getByRole("button", { name: /sign in/i }).click();

  // Wait briefly, then check what happened
  await page.waitForTimeout(5_000);
  const urlAfterClick = page.url();
  console.log(`[auth] URL after click: ${urlAfterClick}`);

  // Check for error messages
  const errorText = await page.locator("text=Invalid").textContent().catch(() => null);
  if (errorText) {
    console.error(`[auth] Login error: ${errorText}`);
    // Capture screenshot for debugging
    await page.screenshot({ path: "test-results/auth-error.png" });
    throw new Error(`Login failed with error: ${errorText}`);
  }

  // If we're already on dashboard, great
  if (urlAfterClick.includes("/dashboard")) {
    console.log(`[auth] Already on dashboard!`);
  } else {
    console.log(`[auth] Not on dashboard yet, waiting...`);
    await page.waitForURL("**/dashboard", { timeout: 60_000 });
  }

  console.log(`[auth] Login successful! URL: ${page.url()}`);

  // Save signed-in state for reuse by authenticated/core-loop projects.
  mkdirSync(path.dirname(authFile), { recursive: true });
  await page.context().storageState({ path: authFile });
});
