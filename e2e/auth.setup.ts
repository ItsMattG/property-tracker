import { test as setup } from "@playwright/test";
import { mkdirSync } from "fs";
import path from "path";

const authFile = path.join(__dirname, ".auth", "user.json");

setup("authenticate", async ({ page }) => {
  const email = process.env.E2E_USER_EMAIL;
  const password = process.env.E2E_USER_PASSWORD;

  if (!email || !password) {
    console.warn("E2E credentials not set - auth setup skipped");
    // Create empty storage state so dependent projects don't fail
    mkdirSync(path.dirname(authFile), { recursive: true });
    await page.context().storageState({ path: authFile });
    return;
  }

  await page.goto("/sign-in");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL("**/dashboard", { timeout: 15000 });

  // Save signed-in state for reuse by authenticated/core-loop projects
  mkdirSync(path.dirname(authFile), { recursive: true });
  await page.context().storageState({ path: authFile });
});
