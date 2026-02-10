import { test as setup } from "@playwright/test";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import path from "path";

const authFile = path.join(__dirname, ".auth", "user.json");

setup("authenticate", async ({ page }) => {
  // If auth file already exists (pre-authenticated by CI), skip login.
  // This allows a single CI job to authenticate once and share the session
  // across all shards via artifact download.
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

  // Browser-based login via the sign-in form.
  // BetterAuth requires CSRF tokens that the form provides automatically.
  await page.goto("/sign-in");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL("**/dashboard", { timeout: 30_000 });

  // Save signed-in state for reuse by authenticated/core-loop projects.
  mkdirSync(path.dirname(authFile), { recursive: true });
  await page.context().storageState({ path: authFile });
});
