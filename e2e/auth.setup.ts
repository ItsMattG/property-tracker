import { test as setup } from "@playwright/test";
import { mkdirSync } from "fs";
import path from "path";

const authFile = path.join(__dirname, ".auth", "user.json");

setup("authenticate", async ({ request }) => {
  const email = process.env.E2E_USER_EMAIL;
  const password = process.env.E2E_USER_PASSWORD;

  if (!email || !password) {
    console.warn("E2E credentials not set - auth setup skipped");
    mkdirSync(path.dirname(authFile), { recursive: true });
    // Write minimal empty storage state
    const { writeFileSync } = await import("fs");
    writeFileSync(authFile, JSON.stringify({ cookies: [], origins: [] }));
    return;
  }

  // API-based login: POST directly to BetterAuth sign-in endpoint
  // This is faster and more reliable than browser-based form login,
  // especially when multiple shards authenticate simultaneously.
  const response = await request.post("/api/auth/sign-in/email", {
    data: { email, password },
  });

  if (!response.ok()) {
    throw new Error(
      `Auth API login failed (${response.status()}): ${await response.text()}`
    );
  }

  // The API response sets session cookies on the request context.
  // Save them as storageState for authenticated/core-loop projects.
  mkdirSync(path.dirname(authFile), { recursive: true });
  await request.storageState({ path: authFile });
});
