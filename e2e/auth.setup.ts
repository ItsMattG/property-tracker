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

  // Attempt sign-in first
  console.log(`[auth] Navigating to /sign-in...`);
  await page.goto("/sign-in", { waitUntil: "networkidle" });

  await expect(page.getByLabel(/email/i)).toBeVisible({ timeout: 15_000 });
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();

  // Wait for either dashboard redirect or error message
  const result = await Promise.race([
    page
      .waitForURL("**/dashboard", { timeout: 30_000 })
      .then(() => "dashboard" as const),
    page
      .locator("text=Invalid email or password")
      .waitFor({ state: "visible", timeout: 30_000 })
      .then(() => "invalid-credentials" as const),
  ]);

  if (result === "dashboard") {
    console.log("[auth] Sign-in successful!");
  } else {
    // User doesn't exist on this environment — create via sign-up
    console.log("[auth] User not found — creating account via sign-up...");

    await page.goto("/sign-up", { waitUntil: "networkidle" });
    await expect(page.getByLabel(/name/i)).toBeVisible({ timeout: 15_000 });

    await page.getByLabel(/name/i).fill("E2E Test User");
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).fill(password);
    await page.getByRole("button", { name: /create account/i }).click();

    // After sign-up, BetterAuth auto-logs in and redirects to /dashboard
    await page.waitForURL("**/dashboard", { timeout: 30_000 });
    console.log("[auth] Account created and signed in!");
  }

  // Save signed-in state for reuse by other projects/shards
  mkdirSync(path.dirname(authFile), { recursive: true });
  await page.context().storageState({ path: authFile });
  console.log("[auth] Auth state saved.");
});
